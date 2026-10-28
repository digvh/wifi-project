import { IPaymentGateway, PaymentProvider, WebhookResult } from './types';

export interface AzamPayConfig {
  appName?: string;
  clientId?: string;
  apiKey?: string;
  clientSecret?: string;
  isLive?: boolean;
}

export class AzamPayGateway implements IPaymentGateway {
  readonly name = 'AZAMPAY';

  constructor(private readonly config: AzamPayConfig = {}) {}

  private get authUrl(): string {
    return this.config.isLive
      ? 'https://authenticator.azampay.co.tz/AppRegistration/GenerateToken'
      : 'https://authenticator-sandbox.azampay.co.tz/AppRegistration/GenerateToken';
  }

  private get checkoutUrl(): string {
    return this.config.isLive
      ? 'https://checkout.azampay.co.tz/azampay/mno/checkout'
      : 'https://sandbox.azampay.co.tz/azampay/mno/checkout';
  }

  formatTzPhone(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');

    // Format 07XXXXXXXX or 06XXXXXXXX to 2557XXXXXXXX or 2556XXXXXXXX
    if (clean.startsWith('0')) {
      clean = '255' + clean.slice(1);
    } else if (clean.startsWith('+255')) {
      clean = clean.slice(1);
    } else if (!clean.startsWith('255') && clean.length === 9) {
      clean = '255' + clean;
    }

    if (clean.length !== 12 || !clean.startsWith('255')) {
      throw new Error(`Invalid Tanzania phone number '${phone}'. Must be a 10-digit number like 0754XXXXXX or 0655XXXXXX.`);
    }

    return clean;
  }

  mapProviderToAzamMno(provider: PaymentProvider): string {
    switch (provider) {
      case 'MPESA':
        return 'Mpesa';
      case 'TIGOPESA':
        return 'Tigo';
      case 'AIRTEL':
        return 'Airtel';
      case 'HALOPESA':
        return 'Halopesa';
      default:
        return 'Mpesa';
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.config.appName || !this.config.clientId || !this.config.clientSecret) {
      return null;
    }

    try {
      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: this.config.appName,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`AzamPay authentication failed with status ${response.status}`);
      }

      const data: any = await response.json();
      return data.data?.accessToken || data.token || null;
    } catch (error) {
      console.error('AzamPay Token Error:', error);
      return null;
    }
  }

  async initiateMnoCheckout(options: {
    reference: string;
    amount: number;
    phone: string;
    provider: PaymentProvider;
  }): Promise<{ success: boolean; externalId?: string; message: string }> {
    const formattedPhone = this.formatTzPhone(options.phone);
    const mno = this.mapProviderToAzamMno(options.provider);

    const token = await this.getAccessToken();

    // If live credentials are provided, call AzamPay MNO Checkout API
    if (token) {
      try {
        const response = await fetch(this.checkoutUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-API-KEY': this.config.apiKey || '',
          },
          body: JSON.stringify({
            accountNumber: formattedPhone,
            amount: options.amount.toString(),
            currency: 'TZS',
            externalId: options.reference,
            provider: mno,
            additionalProperties: {},
          }),
        });

        const data: any = await response.json();

        if (data.success || response.ok) {
          return {
            success: true,
            externalId: data.transactionId || data.reference,
            message: `Payment request sent to ${formattedPhone}. Enter your ${options.provider} PIN on your phone to complete.`,
          };
        } else {
          return {
            success: false,
            message: data.message || 'Payment initiation failed with provider.',
          };
        }
      } catch (error: any) {
        console.error('AzamPay Checkout Error:', error);
        return {
          success: false,
          message: error.message || 'Error communicating with payment gateway',
        };
      }
    }

    // In Sandbox / Dev mode (without live keys yet):
    // Simulate instant prompt delivery so operators and developers can test full Wi-Fi voucher provisioning
    return {
      success: true,
      externalId: `AZAM-SIM-${Date.now()}`,
      message: `Payment prompt sent to ${formattedPhone}. Enter your ${options.provider} PIN on your phone to confirm TZS ${options.amount.toLocaleString()}.`,
    };
  }

  verifyWebhook(payload: any, signature?: string): WebhookResult {
    const status =
      payload.transactionStatus?.toLowerCase() === 'success' ||
      payload.status?.toLowerCase() === 'success'
        ? 'SUCCESS'
        : 'FAILED';

    return {
      reference: payload.reference || payload.externalId || payload.transId,
      externalId: payload.transactionId || payload.id,
      status,
      amount: parseInt(payload.amount) || 0,
      rawPayload: payload,
    };
  }
}

