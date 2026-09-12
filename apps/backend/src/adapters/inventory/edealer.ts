// ============================================================
// EDEALER SFTP INVENTORY ADAPTER
// Implements InventoryAdapter interface
// Vendor agnostic — swap via AdapterFactory
// Credentials stored in dealer adapter_config in Supabase
// ============================================================

import { InventoryAdapter, NormalizedVehicle, VehicleFilters, SyncResult } from './types';
import { supabase } from '../../services/supabase';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class EdealerAdapter implements InventoryAdapter {
  name = 'edealer';

  // --------------------------------------------------------
  // SYNC: Download CSV from SFTP and load into Supabase
  // --------------------------------------------------------

  async sync(dealerId: string): Promise<SyncResult> {
    console.log(`📦 eDealer SFTP sync starting for dealer: ${dealerId}`);

    try {
      // Get dealer from database
      const { data: dealer, error: dealerError } = await supabase
        .from('dealers')
        .select('*')
        .eq('id', dealerId)
        .single();

      if (dealerError || !dealer) throw new Error(`Dealer not found: ${dealerId}`);

      // Get inventory config from dealer adapter_config
      const inventoryConfig = dealer.adapter_config?.inventory;
      if (!inventoryConfig) throw new Error(`No inventory config for dealer: ${dealerId}`);

      // Download CSV from SFTP using dealer config
      const csvData = await this.downloadFromSFTP(inventoryConfig);

      // Parse CSV
      const rows = this.parseCSV(csvData);
      console.log(`📋 Total rows in feed: ${rows.length}`);

      // Filter by dealer ID from config
      const edealerId = inventoryConfig.dealer_id;
      const dealerRows = rows.filter((row: Record<string, string>) =>
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

      // Log sync status
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

      return {
        added,
        updated,
        removed: 0,
        errors,
        source: 'edealer',
        timestamp: new Date(),
      };

    } catch (err: any) {
      console.error('❌ Sync failed:', err.message);
      throw err;
    }
  }

  // --------------------------------------------------------
  // DOWNLOAD: Get CSV from SFTP using dealer config
  // --------------------------------------------------------

  private async downloadFromSFTP(config: any): Promise<string> {
    const SftpClient = require('ssh2-sftp-client');
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: config.sftp_host,
        port: config.sftp_port || 22,
        username: config.sftp_username,
        password: config.sftp_password,
      });

      console.log('✅ SFTP connected');

      const remotePath = `./${config.filename}`;
      console.log(`📥 Downloading: ${remotePath}`);

      const buffer = await sftp.get(remotePath);
      await sftp.end();

      return buffer.toString('utf8');

    } catch (err: any) {
      await sftp.end().catch(() => {});
      throw new Error(`SFTP download failed: ${err.message}`);
    }
  }

  // --------------------------------------------------------
  // PARSE: CSV string to array of objects
  // --------------------------------------------------------

  private parseCSV(csvData: string): Record<string, string>[] {
    const { parse } = require('csv-parse/sync');

    // Fix Windows line endings
    const normalized = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    try {
      const records = parse(normalized, {
        delimiter: ',',
        columns: true,
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        escape: '"',
        relax_quotes: false,
        relax_column_count: false,
        cast: false,
      });

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
      // Fallback with relaxed settings
      console.warn('⚠️ Strict parse failed, trying relaxed:', err.message);
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
        console.log('✅ Fallback price check:', {
          VIN: records[0]['VIN'],
          Starting_Price: records[0]['Starting_Price'],
          Selling_Price: records[0]['Selling_Price'],
        });
      }

      return records;
    }
  }

  // --------------------------------------------------------
  // NORMALIZE: Map eDealer fields to Relay schema
  // --------------------------------------------------------

  private normalizeRow(row: Record<string, string>, dealerId: string): any {
    // Parse images — semicolon separated
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
      condition: row['Condition'] || null,
    };

    // Parse prices
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

  // --------------------------------------------------------
  // QUERY: Get vehicles for Relay recommendations
  // --------------------------------------------------------

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