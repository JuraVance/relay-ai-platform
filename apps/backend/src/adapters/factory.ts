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
  dms: 'none',
  crm: 'none',
  identity: 'persona',
  otp: 'twilio',
  finance: 'jdpower',
  documents: 'relay_native',
};

// ============================================================
// FACTORY
// ============================================================

export class AdapterFactory {

  static getInventoryAdapter(config: DealerAdapterConfig): InventoryAdapter {
    switch (config.inventory) {
      case 'edealer':
        throw new Error('eDealer adapter: coming when SFTP feed arrives');
      case 'jato':
        throw new Error('JATO adapter: not yet implemented');
      case 'dealer_com':
        throw new Error('Dealer.com adapter: not yet implemented');
      case 'csv':
        throw new Error('CSV adapter: not yet implemented');
      default:
        throw new Error(`Unknown inventory adapter: ${config.inventory}`);
    }
  }

  static getOTPAdapter(config: DealerAdapterConfig): OTPAdapter {
    switch (config.otp) {
      case 'twilio':
        throw new Error('Twilio adapter: coming Week 7');
      case 'vonage':
        throw new Error('Vonage adapter: not yet implemented');
      default:
        throw new Error(`Unknown OTP adapter: ${config.otp}`);
    }
  }

  static getIdentityAdapter(config: DealerAdapterConfig): IdentityAdapter {
    switch (config.identity) {
      case 'persona':
        throw new Error('Persona adapter: coming Week 7');
      case 'trulioo':
        throw new Error('Trulioo adapter: not yet implemented');
      default:
        throw new Error(`Unknown identity adapter: ${config.identity}`);
    }
  }

  static getFinanceAdapter(config: DealerAdapterConfig): FinanceAdapter {
    switch (config.finance) {
      case 'jdpower':
        throw new Error('JD Power adapter: coming Week 4');
      case 'chrome':
        throw new Error('Chrome adapter: coming Week 4');
      case 'relay_native':
        throw new Error('Relay calculator: coming Week 4');
      default:
        throw new Error(`Unknown finance adapter: ${config.finance}`);
    }
  }

  static getDocumentAdapter(config: DealerAdapterConfig): DocumentAdapter {
    switch (config.documents) {
      case 'relay_native':
        throw new Error('Relay document adapter: coming Week 7');
      case 'docusign':
        throw new Error('DocuSign adapter: not yet implemented');
      default:
        throw new Error(`Unknown document adapter: ${config.documents}`);
    }
  }
}