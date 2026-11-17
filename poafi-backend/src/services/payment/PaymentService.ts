import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { encryptSecret, decryptSecret } from '../../utils/crypto';
import { RouterAdapterFactory } from '../network';
import { AzamPayGateway, WebhookNotConfiguredError } from './AzamPayGateway';
import { SmsService } from '../sms/SmsService';
import { CheckoutRequest, CheckoutResponse, WebhookResult } from './types';

export type PaymentAccessMode = 'RADIUS' | 'NATIVE';

export class PaymentService {
  private static hashAccessToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private static async getGatewayForTenant(tenantId: string): Promise<AzamPayGateway> {
    const config = await prisma.paymentConfig.findUnique({ where: { tenantId } });

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
        console.error('Failed to decrypt payment credentials:', e);
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

  private static async getAccessModeForTenant(tenantId: string): Promise<PaymentAccessMode> {
    const radiusNas = await prisma.radiusNas.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    return radiusNas ? 'RADIUS' : 'NATIVE';
  }

  static async initiateCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const pkg = await prisma.package.findUnique({
      where: { id: req.packageId },
      include: { tenant: true },
    });

    if (!pkg) throw new Error('Selected Wi-Fi package not found');
    if (pkg.tenantId !== req.tenantId) throw new Error('Package does not belong to this operator');

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
      reference, amount: pkg.priceTzs, phone: formattedPhone, provider: req.provider,
    });

    if (!checkoutResult.success) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new Error(checkoutResult.message || 'Payment initiation failed');
    }

    if (checkoutResult.externalId) {
      await prisma.payment.update({ where: { id: payment.id }, data: { externalId: checkoutResult.externalId } });
    }

    return {
      paymentId: payment.id, reference, status: 'PENDING', amount: pkg.priceTzs,
      provider: req.provider, phoneNumber: formattedPhone, message: checkoutResult.message, accessToken,
    };
  }

  static async fulfillPayment(reference: string, externalId?: string, expectedAmount?: number): Promise<{
    payment: any; voucher: any; rawCode: string; accessMode: PaymentAccessMode;
  }> {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { package: true, tenant: true, voucher: true },
    });

    if (!payment) throw new Error(`Payment with reference '${reference}' not found`);
    if (expectedAmount !== undefined && expectedAmount !== payment.amount) {
      throw new Error('Webhook amount does not match the expected payment amount');
    }

    const accessMode = await this.getAccessModeForTenant(payment.tenantId);

    if (payment.status === 'SUCCESS' && payment.voucher) {
      const rawCode = decryptSecret(payment.voucher.encryptedCode);
      return { payment, voucher: payment.voucher, rawCode, accessMode };
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
        data: { status: 'SUCCESS', externalId: externalId || payment.externalId, completedAt: now },
      });

      if (claimed.count !== 1) {
        const current = await tx.payment.findUnique({ where: { id: payment.id }, include: { voucher: true } });
        if (current?.status === 'SUCCESS' && current.voucher) return { payment: current, voucher: current.voucher };
        throw new Error('Payment was already processed by another request');
      }

      const voucher = await tx.voucher.create({
        data: accessMode === 'RADIUS' ? {
            batchId, tenantId: payment.tenantId, packageId: payment.packageId,
            codeHash, encryptedCode, status: 'UNUSED', usedByIp: payment.phoneNumber,
          } : {
            batchId, tenantId: payment.tenantId, packageId: payment.packageId,
            codeHash, encryptedCode, status: 'ACTIVE', activatedAt: now, expiresAt, usedByIp: payment.phoneNumber,
          },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id }, data: { voucherId: voucher.id },
      });

      return { payment: updatedPayment, voucher };
    });

    if (accessMode === 'NATIVE') {
      const prov = await this.provisionVoucherOnRouter({
        tenantId: payment.tenantId,
        routerId: payment.package.routerId,
        rawCode,
        durationMinutes: payment.package.durationMinutes,
        downloadKbps: payment.package.downloadKbps,
        uploadKbps: payment.package.uploadKbps,
        phoneNumber: payment.phoneNumber,
      });

      const meta = this.parseMetadata(payment.metadata);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          metadata: JSON.stringify(
            prov.provisioned
              ? { ...meta, provisionedOnRouter: true, provisionedAt: new Date().toISOString(), provisionAttempts: 1 }
              : { ...meta, provisionedOnRouter: false, provisionError: prov.error, provisionAttempts: 1 },
          ),
        },
      });
      if (!prov.provisioned) {
        console.warn(`[PaymentService] Auto-provision deferred for payment ${payment.reference}: ${prov.error}`);
      }
    }

    try {
      await SmsService.sendVoucherReceipt({
        phone: payment.phoneNumber, voucherCode: rawCode, packageName: payment.package.name,
        durationMinutes: payment.package.durationMinutes, priceTzs: payment.amount,
      });
    } catch (smsErr) {
      console.error('Failed to dispatch SMS receipt:', smsErr);
    }

    return { payment: result.payment, voucher: result.voucher, rawCode, accessMode };
  }

  static async handleWebhook(
    payload: any,
    signature?: string,
    rawBody?: Buffer | string,
  ): Promise<{ success: boolean; message: string }> {
    const candidateRef = String(payload?.utilityref || payload?.externalId || payload?.reference || '').trim();
    let tenantSecret: string | undefined;

    if (candidateRef) {
      const payment = await prisma.payment.findUnique({
        where: { reference: candidateRef },
        select: { tenantId: true },
      });
      if (payment) {
        const cfg = await prisma.paymentConfig.findUnique({
          where: { tenantId: payment.tenantId },
          select: { webhookSecret: true },
        });
        tenantSecret = cfg?.webhookSecret || undefined;
      }
    }

    const webhookSecret = tenantSecret || env.AZAMPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new WebhookNotConfiguredError('Payment callback verification is not configured');
    }

    const gateway = new AzamPayGateway({ webhookSecret });
    const result: WebhookResult = gateway.verifyWebhook(payload, signature, { webhookSecret, rawBody });

    if (!result.reference) throw new Error('Webhook missing payment reference');

    if (result.status === 'SUCCESS') {
      await this.fulfillPayment(result.reference, result.externalId, result.amount);
      return { success: true, message: 'Payment fulfilled successfully' };
    }

    await prisma.payment.updateMany({
      where: { reference: result.reference, status: 'PENDING' },
      data: { status: 'FAILED', externalId: result.externalId },
    });
    return { success: true, message: 'Payment marked as failed' };
  }

  static async getPaymentStatus(paymentId: string, accessToken: string) {
    const tokenHash = this.hashAccessToken(accessToken);
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, accessTokenHash: tokenHash },
      include: { package: { select: { name: true, durationMinutes: true } }, voucher: true },
    });

    if (!payment) throw new Error('Payment not found');

    let voucherCode: string | null = null;
    if (payment.voucher) voucherCode = decryptSecret(payment.voucher.encryptedCode);

    const accessMode = await this.getAccessModeForTenant(payment.tenantId);

    return {
      paymentId: payment.id, reference: payment.reference, status: payment.status,
      amount: payment.amount, currency: payment.currency, provider: payment.provider,
      packageName: payment.package.name, durationMinutes: payment.package.durationMinutes,
      voucherCode, accessMode, voucherStatus: payment.voucher?.status ?? null,
      activatedAt: payment.voucher?.activatedAt, expiresAt: payment.voucher?.expiresAt,
    };
  }

  private static parseMetadata(raw?: string | null): Record<string, any> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Push a paid voucher user onto the target ONLINE router.
   * Returns `{ provisioned: true }` on success or `{ provisioned: false, error }` so callers can queue recovery.
   */
  private static async provisionVoucherOnRouter(params: {
    tenantId: string;
    routerId?: string | null;
    rawCode: string;
    durationMinutes: number;
    downloadKbps: number;
    uploadKbps: number;
    phoneNumber: string;
  }): Promise<{ provisioned: boolean; error?: string }> {
    const routerDevice = await prisma.router.findFirst({
      where: {
        tenantId: params.tenantId,
        status: 'ONLINE',
        ...(params.routerId ? { id: params.routerId } : {}),
      },
    });

    if (!routerDevice) {
      return { provisioned: false, error: 'No ONLINE router available' };
    }

    try {
      const routerPassword = decryptSecret(routerDevice.encryptedPassword);
      const adapter = RouterAdapterFactory.getAdapter(routerDevice.vendor, {
        host: routerDevice.host,
        port: routerDevice.apiPort,
        username: routerDevice.username,
        password: routerPassword,
      });

      await adapter.provisionUser({
        username: params.rawCode,
        password: params.rawCode,
        durationMinutes: params.durationMinutes,
        downloadKbps: params.downloadKbps,
        uploadKbps: params.uploadKbps,
        comment: `PoaFi Pay: ${params.phoneNumber}`,
      });
      return { provisioned: true };
    } catch (err: any) {
      return { provisioned: false, error: err?.message || 'Router provisioning failed' };
    }
  }

  /**
   * Background recovery job: retries router provisioning for recent NATIVE-mode
   * SUCCESS payments whose initial router push failed (e.g. brief link drop).
   */
  static async retryPendingProvisions(): Promise<{ retried: number; succeeded: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const candidates = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        completedAt: { gte: cutoff },
        metadata: { contains: '"provisionedOnRouter":false' },
        voucherId: { not: null },
      },
      include: { package: true, voucher: true },
      take: 25,
    });

    let retried = 0;
    let succeeded = 0;

    for (const p of candidates) {
      if (!p.voucher) continue;
      if (p.voucher.expiresAt && p.voucher.expiresAt <= new Date()) continue;

      const meta = this.parseMetadata(p.metadata);
      const attempts = Number(meta.provisionAttempts || 0);
      if (attempts >= 5) continue;

      const mode = await this.getAccessModeForTenant(p.tenantId);
      if (mode === 'RADIUS') {
        await prisma.payment.update({
          where: { id: p.id },
          data: { metadata: JSON.stringify({ ...meta, provisionedOnRouter: true, mode: 'RADIUS' }) },
        });
        continue;
      }

      retried++;
      const rawCode = decryptSecret(p.voucher.encryptedCode);
      const res = await this.provisionVoucherOnRouter({
        tenantId: p.tenantId,
        routerId: p.package.routerId,
        rawCode,
        durationMinutes: p.package.durationMinutes,
        downloadKbps: p.package.downloadKbps,
        uploadKbps: p.package.uploadKbps,
        phoneNumber: p.phoneNumber,
      });

      if (res.provisioned) {
        succeeded++;
        await prisma.payment.update({
          where: { id: p.id },
          data: {
            metadata: JSON.stringify({
              ...meta,
              provisionedOnRouter: true,
              provisionError: null,
              provisionAttempts: attempts + 1,
              provisionedAt: new Date().toISOString(),
            }),
          },
        });
      } else {
        await prisma.payment.update({
          where: { id: p.id },
          data: {
            metadata: JSON.stringify({
              ...meta,
              provisionedOnRouter: false,
              provisionError: res.error,
              provisionAttempts: attempts + 1,
            }),
          },
        });
      }
    }

    return { retried, succeeded };
  }

  static async simulateConfirmation(paymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Payment not found');
    return this.fulfillPayment(payment.reference, `SIM-CONFIRM-${Date.now()}`);
  }
}