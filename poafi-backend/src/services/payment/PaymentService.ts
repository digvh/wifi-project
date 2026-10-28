import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { encryptSecret, decryptSecret } from '../../utils/crypto';
import { RouterAdapterFactory } from '../network';
import { AzamPayGateway } from './AzamPayGateway';
import { SmsService } from '../sms/SmsService';
import {
  CheckoutRequest,
  CheckoutResponse,
  PaymentStatus,
  WebhookResult,
} from './types';

export class PaymentService {
  /**
   * Helper to resolve active gateway for a tenant:
   * 1. Mode A: Tenant's custom credentials from PaymentConfig (if configured)
   * 2. Mode B: Platform Master credentials from .env (centralized aggregation)
   * 3. Fallback: Simulation mode for lab / dev testing
   */
  private static async getGatewayForTenant(tenantId: string): Promise<AzamPayGateway> {
    // Check Mode A: Tenant custom merchant keys
    const config = await prisma.paymentConfig.findUnique({
      where: { tenantId },
    });

    if (config && config.encryptedApiKey && config.encryptedSecret) {
      try {
        const apiKey = decryptSecret(config.encryptedApiKey);
        const secret = decryptSecret(config.encryptedSecret);
        return new AzamPayGateway({
          appName: config.appName || undefined,
          clientId: config.clientId || undefined,
          apiKey,
          clientSecret: secret,
          isLive: config.isLive,
        });
      } catch (e) {
        console.error('Failed to decrypt payment credentials, checking master gateway:', e);
      }
    }

    // Check Mode B: Platform Master Merchant Account from .env
    if (env.AZAMPAY_CLIENT_ID && env.AZAMPAY_CLIENT_SECRET) {
      return new AzamPayGateway({
        appName: env.AZAMPAY_APP_NAME || 'POAFI_MASTER',
        clientId: env.AZAMPAY_CLIENT_ID,
        apiKey: env.AZAMPAY_API_KEY || '',
        clientSecret: env.AZAMPAY_CLIENT_SECRET,
        isLive: env.AZAMPAY_IS_LIVE,
      });
    }

    // Default gateway (sandbox / simulation ready for testing)
    return new AzamPayGateway();
  }

  /**
   * Start a checkout session from captive portal
   */
  static async initiateCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const pkg = await prisma.package.findUnique({
      where: { id: req.packageId },
      include: { tenant: true },
    });

    if (!pkg) {
      throw new Error('Selected Wi-Fi package not found');
    }

    if (pkg.tenantId !== req.tenantId) {
      throw new Error('Package does not belong to this operator');
    }

    const gateway = await this.getGatewayForTenant(req.tenantId);
    const formattedPhone = gateway.formatTzPhone(req.phoneNumber);

    // Generate unique reconciliation reference
    const timestamp = Date.now().toString().slice(-6);
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const reference = `POAF-${timestamp}-${randomHex}`;

    // Create pending payment in DB
    const payment = await prisma.payment.create({
      data: {
        tenantId: req.tenantId,
        packageId: req.packageId,
        amount: pkg.priceTzs,
        currency: 'TZS',
        provider: req.provider,
        phoneNumber: formattedPhone,
        reference,
        status: 'PENDING',
        metadata: JSON.stringify({ clientIp: req.clientIp }),
      },
    });

    // Send USSD push / STK prompt to customer's mobile phone
    const checkoutResult = await gateway.initiateMnoCheckout({
      reference,
      amount: pkg.priceTzs,
      phone: formattedPhone,
      provider: req.provider,
    });

    if (checkoutResult.externalId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { externalId: checkoutResult.externalId },
      });
    }

    return {
      paymentId: payment.id,
      reference,
      status: 'PENDING',
      amount: pkg.priceTzs,
      provider: req.provider,
      phoneNumber: formattedPhone,
      message: checkoutResult.message,
    };
  }

  /**
   * Fulfill payment upon confirmation (idempotent, thread-safe)
   */
  static async fulfillPayment(reference: string, externalId?: string): Promise<{
    payment: any;
    voucher: any;
    rawCode: string;
  }> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: {
        package: true,
        tenant: true,
        voucher: true,
      },
    });

    if (!payment) {
      throw new Error(`Payment with reference '${reference}' not found`);
    }

    // IDEMPOTENCY CHECK: if already fulfilled, return existing voucher safely
    if (payment.status === 'SUCCESS' && payment.voucher) {
      const rawCode = decryptSecret(payment.voucher.encryptedCode);
      return {
        payment,
        voucher: payment.voucher,
        rawCode,
      };
    }

    // 1. Generate unique 8-character voucher code
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const encryptedCode = encryptSecret(rawCode);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + payment.package.durationMinutes * 60 * 1000);

    // 2. Create the voucher record
    const batchId = `MOBILE-PAY-${Date.now()}`;
    const voucher = await prisma.voucher.create({
      data: {
        batchId,
        tenantId: payment.tenantId,
        packageId: payment.packageId,
        codeHash,
        encryptedCode,
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        usedByIp: payment.phoneNumber,
      },
    });

    // 3. Update payment status to SUCCESS and link voucher
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        voucherId: voucher.id,
        externalId: externalId || payment.externalId,
        completedAt: now,
      },
    });

    // 4. Provision on tenant router if online router exists
    try {
      const routerDevice = await prisma.router.findFirst({
        where: { tenantId: payment.tenantId, status: 'ONLINE' },
      });

      if (routerDevice) {
        const routerPassword = decryptSecret(routerDevice.encryptedPassword);
        const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
          host: routerDevice.host,
          port: routerDevice.apiPort,
          username: routerDevice.username,
          password: routerPassword,
        });

        await adapter.provisionUser({
          username: rawCode,
          password: rawCode,
          durationMinutes: payment.package.durationMinutes,
          downloadKbps: payment.package.downloadKbps,
          uploadKbps: payment.package.uploadKbps,
          comment: `PoaFi Pay: ${payment.phoneNumber}`,
        });
      }
    } catch (routerErr) {
      console.error('Auto-provision on router failed after payment:', routerErr);
      // We do not fail the payment because the voucher is already generated and valid
    }

    // 5. Send automated SMS receipt with voucher code
    try {
      await SmsService.sendVoucherReceipt({
        phone: payment.phoneNumber,
        voucherCode: rawCode,
        packageName: payment.package.name,
        durationMinutes: payment.package.durationMinutes,
        priceTzs: payment.amount,
      });
    } catch (smsErr) {
      console.error('Failed to dispatch SMS receipt:', smsErr);
    }

    return {
      payment: updatedPayment,
      voucher,
      rawCode,
    };
  }

  /**
   * Process incoming Webhook from AzamPay / Telco
   */
  static async handleWebhook(payload: any, signature?: string): Promise<{ success: boolean; message: string }> {
    const gateway = new AzamPayGateway();
    const result: WebhookResult = gateway.verifyWebhook(payload, signature);

    if (!result.reference) {
      throw new Error('Webhook missing payment reference');
    }

    if (result.status === 'SUCCESS') {
      await this.fulfillPayment(result.reference, result.externalId);
      return { success: true, message: 'Payment fulfilled successfully' };
    } else {
      await prisma.payment.updateMany({
        where: { reference: result.reference },
        data: {
          status: 'FAILED',
          externalId: result.externalId,
        },
      });
      return { success: true, message: 'Payment marked as failed' };
    }
  }

  /**
   * Get payment status (polled by captive portal)
   */
  static async getPaymentStatus(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        package: { select: { name: true, durationMinutes: true, downloadKbps: true, uploadKbps: true } },
        voucher: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    let voucherCode: string | null = null;
    if (payment.voucher) {
      voucherCode = decryptSecret(payment.voucher.encryptedCode);
    }

    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      phoneNumber: payment.phoneNumber,
      packageName: payment.package.name,
      durationMinutes: payment.package.durationMinutes,
      voucherCode,
      activatedAt: payment.voucher?.activatedAt,
      expiresAt: payment.voucher?.expiresAt,
    };
  }

  /**
   * Simulate instant payment confirmation (for testing & development without live gateway)
   */
  static async simulateConfirmation(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    return this.fulfillPayment(payment.reference, `SIM-CONFIRM-${Date.now()}`);
  }
}

