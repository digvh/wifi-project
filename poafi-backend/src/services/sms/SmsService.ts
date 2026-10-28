export interface SendSmsOptions {
  to: string; // e.g. 255754123456
  message: string;
}

export class SmsService {
  /**
   * Send SMS notification to customer phone
   */
  static async sendSms(options: SendSmsOptions): Promise<{ success: boolean; messageId?: string }> {
    const cleanPhone = options.to.replace(/[^0-9]/g, '');

    // In production with Africa's Talking / NextSMS / Beem Africa credentials:
    // Call SMS Gateway API here with API key and Sender ID
    console.log(`📱 [SMS Gateway] Sending SMS to ${cleanPhone}:`);
    console.log(`"${options.message}"`);

    return {
      success: true,
      messageId: `SMS-${Date.now()}`,
    };
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

