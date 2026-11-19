import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { SmsService } from '../services/sms/SmsService';

const router = Router();
router.use(requireAuth);

const db = prisma as any;

// Get payout methods and past withdrawals
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant required' });
      return;
    }

    const [methods, withdrawals] = await Promise.all([
      db.payoutMethod.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
      db.withdrawal.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, include: { payoutMethod: true } })
    ]);

    res.json({ methods, withdrawals });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

// Add a payout method (Generates OTP)
router.post('/methods', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant required' });
      return;
    }

    const { type, provider, accountNumber, accountName, bankBic, transferType } = req.body;
    if (!type || !provider || !accountNumber) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString(); // 6-digit CSPRNG OTP
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const method = await db.payoutMethod.create({
      data: {
        tenantId,
        type,
        provider,
        accountNumber,
        accountName,
        bankBic: bankBic || null,
        transferType: transferType || null,
        otpCode,
        otpExpiresAt,
        isVerified: false
      }
    });

    const smsResult = type === 'MOBILE'
      ? await SmsService.sendPayoutOtp(accountNumber, otpCode)
      : { success: false, simulated: false, error: 'Bank verification uses admin review or mobile OTP' };

    if (!smsResult.success && type === 'MOBILE') {
      await db.payoutMethod.delete({ where: { id: method.id } });
      res.status(503).json({
        error: smsResult.error || 'SMS gateway not configured for payout OTP verification',
      });
      return;
    }

    res.status(201).json({
      message: smsResult.simulated
        ? 'DEV MODE: SMS gateway not configured — check backend console for dev OTP'
        : type === 'MOBILE'
          ? 'OTP sent to your phone via SMS'
          : 'Bank payout method saved and awaiting verification',
      methodId: method.id,
      deliveryMode: smsResult.simulated ? 'DEV_CONSOLE' : type === 'MOBILE' ? 'SMS' : 'MANUAL',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add payout method' });
  }
});

// Verify OTP
router.post('/methods/:id/verify', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant required' });
      return;
    }
    const { otpCode } = req.body;

    const method = await db.payoutMethod.findFirst({
      where: { id: req.params.id, tenantId }
    });

    if (!method) {
      res.status(404).json({ error: 'Method not found' });
      return;
    }
    if (method.isVerified) {
      res.json({ message: 'Already verified' });
      return;
    }
    if (!method.otpExpiresAt || method.otpExpiresAt < new Date()) {
      res.status(400).json({ error: 'OTP expired' });
      return;
    }
    if (method.otpCode !== otpCode) {
      res.status(400).json({ error: 'Invalid OTP code' });
      return;
    }

    await db.payoutMethod.update({
      where: { id: method.id },
      data: { isVerified: true, otpCode: null, otpExpiresAt: null }
    });

    res.json({ message: 'Payout method verified successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Request Withdrawal
router.post('/withdraw', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant required' });
      return;
    }
    const { amount, payoutMethodId } = req.body;

    if (!amount || !payoutMethodId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const method = await db.payoutMethod.findFirst({
      where: { id: payoutMethodId, tenantId, isVerified: true }
    });
    if (!method) {
      res.status(400).json({ error: 'Invalid or unverified payout method' });
      return;
    }

    // Calculate available balance
    const payments = await prisma.payment.aggregate({
      where: { tenantId, status: 'SUCCESS' },
      _sum: { amount: true }
    });
    const pastWithdrawals = await db.withdrawal.aggregate({
      where: { tenantId, status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] } },
      _sum: { amount: true }
    });

    const totalEarned = payments._sum?.amount || 0;
    const totalWithdrawn = pastWithdrawals._sum?.amount || 0;
    const available = totalEarned - totalWithdrawn;

    if (amount > available) {
      res.status(400).json({ error: `Insufficient funds. Available: TZS ${available}` });
      return;
    }

    const withdrawal = await db.withdrawal.create({
      data: { tenantId, amount, payoutMethodId, status: 'PENDING' }
    });

    res.status(201).json({ message: 'Withdrawal requested successfully', withdrawal });
  } catch (error) {
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

// Get available balance
router.get('/balance', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant required' });
      return;
    }
    const payments = await prisma.payment.aggregate({
      where: { tenantId, status: 'SUCCESS' },
      _sum: { amount: true }
    });
    const withdrawals = await db.withdrawal.aggregate({
      where: { tenantId, status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] } },
      _sum: { amount: true }
    });
    
    const totalEarned = payments._sum?.amount || 0;
    const totalWithdrawn = withdrawals._sum?.amount || 0;
    
    const poafiSetting = await prisma.paymentGatewaySetting.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'POAFI_PAY' } }
    });
    const feePercent = !poafiSetting || poafiSetting.isEnabled ? 3 : 0;

    res.json({
      totalEarned,
      totalWithdrawn,
      available: totalEarned - totalWithdrawn,
      feePercent,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;
