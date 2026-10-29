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
  private static hashAccessToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private static async getGatewayForTenant(tenantId: string): Promise<AzamPayGateway> {
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

    if (env.AZAMPAY_CLIENT_ID && env.AZAMPAY_CLIENT_SECRET) {
      return new AzamPayGateway({
        appName: env.AZAMPAY_APP_NAME || 'POAFI_MASTER',
        clientId: env.AZAMPAY_CLIENT_ID,
        apiKey: env.AZAMPAY_API_KEY || '',
        clientSecret: env.AZAMPAY_CLIENT_SECRET,
        isLive: env.AZAMPAY_IS_LIVE,
      });
    }

    return new AzamPayGateway();
  }

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
    const timestamp = Date.now().toString().slice(-6);
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const reference = `POAF-${timestamp}-${randomHex}`;
    const accessToken = crypto.randomBytes(32).toString('base64url');
    const accessTokenHash = this.hashAccessToken(accessToken);

    const payment = await prisma.payment.create({
      data: {
        tenantId: req.tenantId,
        packageId: req.packageId,
        amount: pkg.priceTzs,
        currency: 'TZS',
        provider: req.provider,
        phoneNumber: formattedPhone,
        reference,
        accessTokenHash,
        status: 'PENDING',
        metadata: JSON.stringify({ clientIp: req.clientIp }),
      },
    });

    const checkoutResult = await gateway.initiateMnoCheckout({
      reference,
      amount: pkg.priceTzs,
      phone: formattedPhone,
      provider: req.provider,
    });

    if (!checkoutResult.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      throw new Error(checkoutResult.message || 'Payment initiation failed');
    }

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
      accessToken,
    };
  }

  static async fulfillPayment(reference: string, externalId?: string, expectedAmount?: number): Promise<{
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

    if (expectedAmount !== undefined && expectedAmount !== payment.amount) {
      throw new Error('Webhook amount does not match the expected payment amount');
    }

    if (payment.status === 'SUCCESS' && payment.voucher) {
      const rawCode = decryptSecret(payment.voucher.encryptedCode);
      return { payment, voucher: payment.voucher, rawCode };
    }

    if (payment.status !== 'PENDING') {
      throw new Error(`Payment is not eligible for fulfillment from status '${payment.status}'`);
    }

    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const encryptedCode = encryptSecret(rawCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + payment.package.durationMinutes * 60 * 1000);
    const batchId = `MOBILE-PAY-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'SUCCESS',
          externalId: externalId || payment.externalId,
          completedAt: now,
        },
      });

      if (claimed.count !== 1) {
        const current = await tx.payment.findUnique({ where: { id: payment.id }, include: { voucher: true } });
        if (current?.status === 'SUCCESS' && current.voucher) {
          return { payment: current, voucher: current.voucher };
        }
        throw new Error('Payment was already processed by another request');
      }

      const voucher = await tx.voucher.create({
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

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { voucherId: voucher.id },
      });

      return { payment: updatedPayment, voucher };
    });

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
    }

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

    return { payment: result.payment, voucher: result.voucher, rawCode };
  }

  static async handleWebhook(payload: any, signature?: string): Promise<{ success: boolean; message: string }> {
    const gateway = new AzamPayGateway();
    const result: WebhookResult = gateway.verifyWebhook(payload, signature);

    if (!result.reference) {
      throw new Error('Webhook missing payment reference');
    }

    if (result.status === 'SUCCESS') {
      await this.fulfillPayment(result.reference, result.externalId, result.amount);
      return { success: true, message: 'Payment fulfilled successfully' };
    }

    await prisma.payment.updateMany({
      where: { reference: result.reference, status: 'PENDING' },
      data: {
        status: 'FAILED',
        externalId: result.externalId,
      },
    });
    return { success: true, message: 'Payment marked as failed' };
  }

  static async getPaymentStatus(paymentId: string, accessToken: string) {
    const tokenHash = this.hashAccessToken(accessToken);
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, accessTokenHash: tokenHash },
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
      packageName: payment.package.name,
      durationMinutes: payment.package.durationMinutes,
      voucherCode,
      activatedAt: payment.voucher?.activatedAt,
      expiresAt: payment.voucher?.expiresAt,
    };
  }

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
