import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// 1. Overview metrics
router.get('/overview', async (req, res) => {
  try {
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const tenantId = req.user?.tenantId;

    const whereClause: any = {};
    if (!isPlatformAdmin && tenantId) {
      whereClause.tenantId = tenantId;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      activeSessionsCount,
      totalVouchersCount,
      unusedVouchersCount,
      allPayments,
      todayPayments,
      onlineRoutersCount,
      totalRoutersCount,
      tenantsCount,
    ] = await Promise.all([
      // Active sessions: vouchers currently marked active and not yet expired
      prisma.voucher.count({
        where: {
          ...whereClause,
          status: 'ACTIVE',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      }),

      // Total vouchers
      prisma.voucher.count({ where: whereClause }),

      // Unused vouchers
      prisma.voucher.count({
        where: { ...whereClause, status: 'UNUSED' },
      }),

      // Total revenue (All time)
      prisma.payment.aggregate({
        where: { ...whereClause, status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true,
      }),

      // Today's revenue
      prisma.payment.aggregate({
        where: {
          ...whereClause,
          status: 'SUCCESS',
          createdAt: { gte: startOfToday },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Online routers
      prisma.router.count({
        where: { ...whereClause, status: 'ONLINE' },
      }),

      // Total routers
      prisma.router.count({ where: whereClause }),

      // Total tenants (if platform admin)
      isPlatformAdmin ? prisma.tenant.count() : 1,
    ]);

    const totalRevenueTzs = allPayments._sum.amount || 0;
    const todayRevenueTzs = todayPayments._sum.amount || 0;

    res.json({
      activeSessions: activeSessionsCount,
      totalRevenueTzs,
      todayRevenueTzs,
      successfulTransactions: allPayments._count || 0,
      todayTransactions: todayPayments._count || 0,
      vouchers: {
        total: totalVouchersCount,
        active: activeSessionsCount,
        unused: unusedVouchersCount,
        usedOrExpired: Math.max(0, totalVouchersCount - activeSessionsCount - unusedVouchersCount),
      },
      routers: {
        total: totalRoutersCount,
        online: onlineRoutersCount,
        offline: Math.max(0, totalRoutersCount - onlineRoutersCount),
      },
      tenantsCount: isPlatformAdmin ? tenantsCount : 1,
    });
  } catch (error) {
    console.error('Stats overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// 2. Revenue growth chart (Daily for the last 7 days)
router.get('/revenue-chart', async (req, res) => {
  try {
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const tenantId = req.user?.tenantId;

    const whereClause: any = { status: 'SUCCESS' };
    if (!isPlatformAdmin && tenantId) {
      whereClause.tenantId = tenantId;
    }

    // Generate array for the last 7 days
    const days: { dateStr: string; label: string; start: Date; end: Date }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const label = dayNames[start.getDay()];
      const dateStr = `${start.getDate()}/${start.getMonth() + 1}`;
      days.push({ dateStr, label, start, end });
    }

    const chartData = await Promise.all(
      days.map(async ({ dateStr, label, start, end }) => {
        const agg = await prisma.payment.aggregate({
          where: {
            ...whereClause,
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          _sum: { amount: true },
          _count: true,
        });

        return {
          name: label,
          fullDate: dateStr,
          revenue: agg._sum.amount || 0,
          transactions: agg._count || 0,
        };
      })
    );

    res.json({ chartData });
  } catch (error) {
    console.error('Stats revenue chart error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue growth data' });
  }
});

// 3. Router health & status list
router.get('/routers-health', async (req, res) => {
  try {
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const tenantId = req.user?.tenantId;

    const whereClause: any = {};
    if (!isPlatformAdmin && tenantId) {
      whereClause.tenantId = tenantId;
    }

    const routers = await prisma.router.findMany({
      where: whereClause,
      include: {
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { name: 'asc' },
      take: 10,
    });

    const safeRouters = routers.map(({ encryptedPassword, ...r }) => r);
    res.json({ routers: safeRouters });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch router health status' });
  }
});

// 4. Popular packages breakdown
router.get('/popular-packages', async (req, res) => {
  try {
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const tenantId = req.user?.tenantId;

    const whereClause: any = {};
    if (!isPlatformAdmin && tenantId) {
      whereClause.tenantId = tenantId;
    }

    const packages = await prisma.package.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { vouchers: true, payments: true },
        },
      },
      orderBy: { priceTzs: 'asc' },
    });

    const breakdown = packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      priceTzs: pkg.priceTzs,
      durationMinutes: pkg.durationMinutes,
      totalVouchers: pkg._count.vouchers,
      totalPayments: pkg._count.payments,
      estimatedRevenue: pkg.priceTzs * pkg._count.payments,
    }));

    res.json({ packages: breakdown });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch popular packages' });
  }
});

export default router;

