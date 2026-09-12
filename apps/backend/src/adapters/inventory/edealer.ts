// ============================================================
// EDEALER SFTP INVENTORY ADAPTER
// Implements InventoryAdapter interface
// Vendor agnostic — swap via AdapterFactory
// ============================================================

import { InventoryAdapter, NormalizedVehicle, VehicleFilters, SyncResult } from './types';
import { supabase } from '../../services/supabase';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class EdealerAdapter implements InventoryAdapter {
  name = 'edealer';

  async sync(dealerId: string): Promise<SyncResult> {
    console.log(`📦 eDealer SFTP sync starting for dealer: ${dealerId}`);

    try {
      const { data: dealer } = await supabase
        .from('dealers')
        .select('*')
        .eq('id', dealerId)
        .single();

      if (!dealer) throw new Error(`Dealer not found: ${dealerId}`);

      const csvData = await this.downloadFromSFTP();
      const rows = this.parseCSV(csvData);
      console.log(`📋 Total rows in feed: ${rows.length}`);

      const edealerId = process.env.EDEALER_ID_NEWROADS_MAZDA;
      const dealerRows = rows.filter(row =>
        !edealerId || row['Dealer_ID'] === edealerId
      );
      console.log(`🚗 Rows for this dealer: ${dealerRows.length}`);

      let added = 0;
      let updated = 0;
      let errors = 0;

      for (const row of dealerRows) {
        try {
          const vehicle = this.normalizeRow(row, dealerId);

          const { error } = await supabase
            .from('vehicles')
            .upsert(vehicle, {
              onConflict: 'vin',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error(`❌ Upsert error VIN ${vehicle.vin}:`, error.message);
            errors++;
          } else {
            added++;
          }
        } catch (err: any) {
          console.error('❌ Row error:', err.message);
          errors++;
        }
      }

      await supabase.from('inventory_sync_status').insert({
        dealer_id: dealerId,
        source: 'edealer',
        last_sync_at: new Date(),
        vehicles_synced: dealerRows.length,
        vehicles_added: added,
        vehicles_updated: updated,
        status: errors > 0 ? 'partial' : 'success',
      });

      console.log(`✅ Sync complete: ${added} vehicles loaded, ${errors} errors`);

      return { added, updated, removed: 0, errors, source: 'edealer', timestamp: new Date() };

    } catch (err: any) {
      console.error('❌ SFTP sync failed:', err.message);
      throw err;
    }
  }

  private async downloadFromSFTP(): Promise<string> {
    const SftpClient = require('ssh2-sftp-client');
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: process.env.SFTP_HOST,
        port: parseInt(process.env.SFTP_PORT || '22'),
        username: process.env.SFTP_USERNAME,
        password: process.env.SFTP_PASSWORD,
      });

      console.log('✅ SFTP connected');

      const filename = process.env.EDEALER_FILENAME_NEWROADS_MAZDA;
      const remotePath = `./${filename}`;
      console.log(`📥 Downloading: ${remotePath}`);

      const buffer = await sftp.get(remotePath);
      await sftp.end();

      return buffer.toString('utf8');

    } catch (err: any) {
      await sftp.end().catch(() => {});
      throw new Error(`SFTP download failed: ${err.message}`);
    }
  }

     private parseCSV(csvData: string): Record<string, string>[] {
    const { execSync } = require('child_process');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'parse_csv.py');
    
    try {
      const result = execSync(`python3 "${scriptPath}"`, {
        input: csvData,
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf8',
      });
      
      const records = JSON.parse(result);
      console.log(`📋 Parsed ${records.length} vehicle rows`);
      
      if (records.length > 0) {
        console.log('✅ Price check:', {
          VIN: records[0]['VIN'],
          Starting_Price: records[0]['Starting_Price'],
          Selling_Price: records[0]['Selling_Price'],
        });
      }
      
      return records;
    } catch (err: any) {
      console.error('❌ Python parser error FULL:', err);
      // Fall back to csv-parse
      const { parse } = require('csv-parse/sync');
      const normalized = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const records = parse(normalized, {
        delimiter: ',',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
        quote: '"',
      });
      console.log(`📋 Fallback parsed ${records.length} rows`);
      if (records.length > 0) {
        console.log('Fallback price check:', records[0]['Starting_Price'], records[0]['Selling_Price']);
      }
      return records;
    }
  }

  private normalizeRow(row: Record<string, string>, dealerId: string): any {
    // Parse images — pipe separated
    const imageUrls = row['Images']
      ? row['Images'].split(';').map((u: string) => u.trim()).filter(Boolean)
      : [];

    // Parse options — semicolon separated
    const optionsList = row['Options']
      ? row['Options'].split(';').map((o: string) => o.trim()).filter(Boolean)
      : [];

    const features: Record<string, any> = {
      fuel_type: row['Fuel_Type'] || null,
      engine: row['Engine'] || null,
      cylinders: row['Cylinders'] || null,
      doors: row['Doors'] || null,
      passenger_seats: row['Passenger_Seats'] || null,
      certified: row['Certified'] === 'Y',
      in_transit: row['In_Transit'] === 'Y',
      on_order: row['On_Order'] === 'Y',
      demo: row['Demo'] === 'Y',
      drivetrain: row['Drivetrain'] || null,
      transmission: row['Transmission'] || null,
      interior_colour: row['Interior_Colour'] || null,
      highlights: row['Highlights'] || null,
      description: row['Description'] || null,
      options: optionsList,
      manufacturer_options: row['Manufacturer_Options'] || null,
      manufacturer_option_codes: row['Manufacturer_Option_Codes'] || null,
      vdp_url: row['VDP_URL'] || null,
      vehicle_id: row['Vehicle_ID'] || null,
      sub_model: row['Sub_Model'] || null,
    };

    // Parse prices — remove any non-numeric except decimal
    const parsePrice = (val: string): number | null => {
      if (!val || val.trim() === '' || val.trim() === '0') return null;
      const cleaned = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(cleaned) || cleaned === 0 ? null : cleaned;
    };

    // Determine status
    let status = 'available';
    if (row['In_Transit'] === 'Y') status = 'in_transit';
    else if (row['On_Order'] === 'Y') status = 'on_order';

    return {
      dealer_id: dealerId,
      vin: row['VIN'] || null,
      stock_number: row['Stock_Number'] || null,
      year: row['Year'] ? parseInt(row['Year']) : null,
      make: row['Make'] || null,
      model: row['Model'] || null,
      trim: row['Trim'] || row['Sub_Model'] || null,
      body_style: row['Vehicle_Type'] || null,
      exterior_color: row['Exterior_Colour'] || null,
      mileage: row['Mileage'] ? parseInt(row['Mileage']) : 0,
      msrp: parsePrice(row['Starting_Price']),
      selling_price: parsePrice(row['Selling_Price']),
      status,
      features,
      image_urls: imageUrls,
      source: 'edealer',
    };
  }

  async getVehicles(dealerId: string, filters?: VehicleFilters): Promise<NormalizedVehicle[]> {
    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('dealer_id', dealerId)
      .eq('status', filters?.status || 'available');

    if (filters?.make) query = query.ilike('make', `%${filters.make}%`);
    if (filters?.model) query = query.ilike('model', `%${filters.model}%`);
    if (filters?.bodyStyle) query = query.ilike('body_style', `%${filters.bodyStyle}%`);
    if (filters?.maxPrice) query = query.lte('selling_price', filters.maxPrice);
    if (filters?.minPrice) query = query.gte('selling_price', filters.minPrice);
    if (filters?.year) query = query.eq('year', filters.year);

    const { data, error } = await query.order('selling_price', { ascending: true });

    if (error) {
      console.error('❌ Vehicle query error:', error.message);
      return [];
    }

    return data as NormalizedVehicle[];
  }

  async getVehicleByVin(vin: string): Promise<NormalizedVehicle | null> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('vin', vin)
      .single();

    if (error) return null;
    return data as NormalizedVehicle;
  }
}