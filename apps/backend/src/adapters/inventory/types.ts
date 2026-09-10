// ============================================================
// INVENTORY ADAPTER INTERFACE
// Any inventory provider must implement this interface
// Supported: eDealer, JATO, Dealer.com, DealerSocket, 
//            CDK Drive, PBS, custom CSV/SFTP feeds
// ============================================================

export interface InventoryAdapter {
  name: string;           // 'edealer' | 'jato' | 'dealer_com' | 'csv'
  sync(dealerId: string): Promise<SyncResult>;
  getVehicles(dealerId: string, filters?: VehicleFilters): Promise<NormalizedVehicle[]>;
  getVehicleByVin(vin: string): Promise<NormalizedVehicle | null>;
}

export interface DMSAdapter {
  name: string;           // 'cdk' | 'reynolds' | 'pbs' | 'tekion' | 'dealertrack'
  pushDeal(dealId: string, dealData: any): Promise<boolean>;
  getDeal(dealId: string): Promise<any>;
  getCustomer(customerId: string): Promise<any>;
}

export interface CRMAdapter {
  name: string;           // 'vinsolutions' | 'drivecentric' | 'elead' | 'dealersocket'
  pushLead(sessionData: any): Promise<boolean>;
  updateLead(leadId: string, data: any): Promise<boolean>;
}

export interface IdentityAdapter {
  name: string;           // 'persona' | 'trulioo' | 'jumio' | 'onfido'
  verify(customerId: string, documentData: any): Promise<VerificationResult>;
}

export interface OTPAdapter {
  name: string;           // 'twilio' | 'vonage' | 'messagebird'
  send(phone: string): Promise<string>;   // Returns OTP code
  verify(phone: string, code: string): Promise<boolean>;
}

export interface FinanceAdapter {
  name: string;           // 'jdpower' | 'chrome' | 'marketscan' | 'dealertrack'
  getRates(params: RateParams): Promise<RateResult>;
  calculatePayment(params: PaymentParams): Promise<PaymentResult>;
}

export interface DocumentAdapter {
  name: string;           // 'relay_native' | 'docusign' | 'hellosign'
  generateBOS(dealData: any): Promise<string>;   // Returns document ID
  sign(documentId: string, signatureData: any): Promise<boolean>;
  retrieve(documentId: string): Promise<Buffer>;
}

// ============================================================
// SHARED TYPES
// ============================================================

export interface NormalizedVehicle {
  dealer_id: string;
  vin: string | null;
  stock_number: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body_style: string | null;
  exterior_color: string | null;
  mileage: number;
  msrp: number | null;
  selling_price: number | null;
  status: string;
  features: Record<string, any>;
  image_urls: string[];
  source: string;
}

export interface VehicleFilters {
  make?: string;
  model?: string;
  maxPrice?: number;
  minPrice?: number;
  bodyStyle?: string;
  year?: number;
  status?: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: number;
  source: string;
  timestamp: Date;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  reason?: string;
}

export interface RateParams {
  creditScore: number;
  vehiclePrice: number;
  termMonths: number;
  province: string;
}

export interface RateResult {
  rate: number;
  lender: string;
  approved: boolean;
}

export interface PaymentParams {
  vehiclePrice: number;
  tradeValue?: number;
  downPayment?: number;
  termMonths: number;
  rate: number;
  province: string;
}

export interface PaymentResult {
  monthly: number;
  biweekly: number;
  weekly: number;
  totalCost: number;
  totalInterest: number;
}