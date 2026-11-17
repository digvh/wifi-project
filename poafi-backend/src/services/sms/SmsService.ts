import { env } from '../../config/env';

export interface SendSmsOptions {
  to: string; // e.g. 255754123456 or 0754123456
  message: string;
}

export class SmsService {
  private static normalizeTzPhone(raw: string): string {
    let clean = raw.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '255' + clean.slice(1);
    return clean;
  }

  /**
   * Send SMS via Beem Africa when BEEM_API_KEY + BEEM_SECRET_KEY are set.
   * Fails closed in production if no SMS gateway is configured.
   */
  static async sendSms(options: SendSmsOptions): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
    const cleanPhone = this.normalizeTzPhone(options.to);

    if (env.BEEM_API_KEY && env.BEEM_SECRET_KEY) {
      try {
        const auth = Buffer.from(`${env.BEEM_API_KEY}:${env.BEEM_SECRET_KEY}`).toString('base64');
        const response = await fetch('https://apisms.beem.africa/v1/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            source_addr: env.BEEM_SENDER_ID || 'POAFI',
            encoding: 0,
            message: options.message,
            recipients: [{ recipient_id: 1, dest_addr: cleanPhone }],
          }),
        });

        const data: any = await response.json().catch(() => ({}));
        if (!response.ok || data.successful === false) {
          return { success: false, error: data.message || `SMS gateway HTTP ${response.status}` };
        }
        return { success: true, messageId: String(data.request_id || `BEEM-${Date.now()}`) };
      } catch (err: any) {
        return { success: false, error: err?.message || 'SMS gateway unreachable' };
      }
    }

    if (env.NODE_ENV === 'production') {
      return { success: false, error: 'SMS gateway is not configured in production' };
    }

    console.log(`📱 [DEV SMS Preview -> ${cleanPhone}]: ${options.message}`);
    return {
      success: true,
      simulated: true,
      messageId: `DEV-SMS-${Date.now()}`,
    };
  }

  static async sendPayoutOtp(phone: string, otpCode: string) {
    return this.sendSms({
      to: phone,
      message: `PoaFi: Namba yako ya kuthibitisha akaunti ya malipo (Payout OTP) ni ${otpCode}. Inatumika kwa dakika 10.`,
    });
  }

  /**
   * Helper to format and send voucher receipt upon payment
   */
  static async sendVoucherReceipt(options: {
    phone: string;
    voucherCode: string;
    packageName: string;
    durationMinutes: number;
    priceTzs: number;
  }) {
    const text =
      `Habari! Umefanikiwa kulipia PoaFi Wi-Fi (TZS ${options.priceTzs.toLocaleString()}). ` +
      `Vocha yako: ${options.voucherCode}. ` +
      `Kifurushi: ${options.packageName} (${options.durationMinutes} dakika). ` +
      `Unganisha kwenye mtandao na ufurahie intaneti ya kasi!`;

    return this.sendSms({
      to: options.phone,
      message: text,
    });
  }
}
