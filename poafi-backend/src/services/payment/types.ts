export type PaymentProvider =
  | 'MPESA'
  | 'TIGOPESA'
  | 'AIRTEL'
  | 'HALOPESA'
  | 'CARD'
  | 'AZAMPAY';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface CheckoutRequest {
  tenantId: string;
  packageId: string;
  phoneNumber: string; // e.g. 0754123456 or 255754123456
  provider: PaymentProvider;
  clientIp?: string;
}

export interface CheckoutResponse {
  paymentId: string;
  reference: string;
  status: PaymentStatus;
  amount: number;
  provider: PaymentProvider;
  phoneNumber: string;
  message: string;
  checkoutUrl?: string;
  accessToken: string;
}

export interface WebhookResult {
  reference: string;
  externalId?: string;
  status: PaymentStatus;
  amount: number;
  rawPayload: any;
}

export interface IPaymentGateway {
  readonly name: string;

  /**
   * Normalize Tanzanian phone numbers to 255XXXXXXXXX format
   */
  formatTzPhone(phone: string): string;

  /**
   * Initiate Mobile Money USSD push / STK prompt
   */
  initiateMnoCheckout(options: {
    reference: string;
    amount: number;
    phone: string;
    provider: PaymentProvider;
  }): Promise<{ success: boolean; externalId?: string; message: string }>;

  /**
   * Verify webhook notification payload
   */
  verifyWebhook(payload: any, signature?: string): WebhookResult;
}
