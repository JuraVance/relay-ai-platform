// ============================================================
// ADAPTER FACTORY
// Relay never talks directly to vendors.
// It talks to adapters. Adapters talk to vendors.
// Swap any vendor by changing config. Zero code changes.
// ============================================================

import { 
  InventoryAdapter, 
  DMSAdapter, 
  CRMAdapter,
  IdentityAdapter,
  OTPAdapter,
  FinanceAdapter,
  DocumentAdapter
} from './inventory/types';

// Dealer adapter configuration
// Loaded from dealer config in Supabase
export interface DealerAdapterConfig {
  inventory: 'edealer' | 'jato' | 'dealer_com' | 'csv' | 'manual';
  dms: 'cdk' | 'reynolds' | 'pbs' | 'tekion' | 'dealertrack' | 'none';
  crm: 'vinsolutions' | 'drivecentric' | 'elead' | 'dealersocket' | 'none';
  identity: 'persona' | 'trulioo' | 'jumio' | 'onfido';
  otp: 'twilio' | 'vonage' | 'messagebird';
  finance: 'jdpower' | 'chrome' | 'marketscan' | 'relay_native';
  documents: 'relay_native' | 'docusign' | 'hellosign';
}

// Default config for NewRoads Mazda MVP
export const DEFAULT_ADAPTER_CONFIG: DealerAdapterConfig = {
  inventory: 'edealer',
  dms: 'none',           // Phase 3
  crm: 'none',           // Phase 2
  identity: 'persona',
  otp: 'twilio',
  finance: 'jdpower',
  documents: 'relay_native',
};

// ============================================================
// FACTORY: Returns correct adapter based on dealer config
// ============================================================

export class AdapterFactory {
  
  static getInventoryAdapter(config: DealerAdapterConfig): InventoryAdapter {
    switch (config.inventory) {
      case 'edealer':
        const { EdealerAdapter } = require('./inventory/edealer');
        return new EdealerAdapter();
      case 'jato':
        const { JatoAdapter } = require('./inventory/jato');
        return new JatoAdapter();
      case 'dealer_com':
        const { DealerComAdapter } = require('./inventory/dealer_com');
        return new DealerComAdapter();
      case 'csv':
        const { CsvAdapter } = require('./inventory/csv');
        return new CsvAdapter();
      default:
        throw new Error(`Unknown inventory adapter: ${config.inventory}`);
    }
  }

  static getOTPAdapter(config: DealerAdapterConfig): OTPAdapter {
    switch (config.otp) {
      case 'twilio':
        const { TwilioAdapter } = require('./identity/twilio');
        return new TwilioAdapter();
      case 'vonage':
        const { VonageAdapter } = require('./identity/vonage');
        return new VonageAdapter();
      default:
        throw new Error(`Unknown OTP adapter: ${config.otp}`);
    }
  }

  static getIdentityAdapter(config: DealerAdapterConfig): IdentityAdapter {
    switch (config.identity) {
      case 'persona':
        const { PersonaAdapter } = require('./identity/persona');
        return new PersonaAdapter();
      case 'trulioo':
        const { TruliooAdapter } = require('./identity/trulioo');
        return new TruliooAdapter();
      default:
        throw new Error(`Unknown identity adapter: ${config.identity}`);
    }
  }

  static getFinanceAdapter(config: DealerAdapterConfig): FinanceAdapter {
    switch (config.finance) {
      case 'jdpower':
        const { JDPowerAdapter } = require('./finance/jdpower');
        return new JDPowerAdapter();
      case 'chrome':
        const { ChromeAdapter } = require('./finance/chrome');
        return new ChromeAdapter();
      case 'relay_native':
        const { RelayCalculator } = require('./finance/calculator');
        return new RelayCalculator();
      default:
        throw new Error(`Unknown finance adapter: ${config.finance}`);
    }
  }

  static getDocumentAdapter(config: DealerAdapterConfig): DocumentAdapter {
    switch (config.documents) {
      case 'relay_native':
        const { RelayDocumentAdapter } = require('./documents/relay');
        return new RelayDocumentAdapter();
      case 'docusign':
        const { DocuSignAdapter } = require('./documents/docusign');
        return new DocuSignAdapter();
      default:
        throw new Error(`Unknown document adapter: ${config.documents}`);
    }
  }
}