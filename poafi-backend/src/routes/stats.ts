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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeSessionsCount,
      totalVouchersCount,
      unusedVouchersCount,
      allPayments,
      todayPayments,
      monthPayments,
      onlineRoutersCount,
      totalRoutersCount,
      tenantsCount,
      sitesRaw,
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

      // This month's revenue
      prisma.payment.aggregate({
        where: {
          ...whereClause,
          status: 'SUCCESS',
          createdAt: { gte: startOfMonth },
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

      // Per-site router health breakdown
      (prisma as any).site.findMany({
        where: whereClause,
        include: {
          routers: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalRevenueTzs = allPayments._sum.amount || 0;
    const todayRevenueTzs = todayPayments._sum.amount || 0;
    const monthRevenueTzs = monthPayments._sum.amount || 0;

    const sitesSummary = (sitesRaw || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      totalRouters: s.routers?.length || 0,
      onlineRouters: (s.routers || []).filter((r: any) => r.status === 'ONLINE').length,
    }));

    res.json({
      activeSessions: activeSessionsCount,
      totalRevenueTzs,
      todayRevenueTzs,
      monthRevenueTzs,
      successfulTransactions: allPayments._count || 0,
      todayTransactions: todayPayments._count || 0,
      monthTransactions: monthPayments._count || 0,
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
      sitesSummary,
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
    console.error('Stats router health error:', error);
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

// 5. Smart Dashboard Notifications & Health Alerts
router.get('/notifications', async (req, res) => {
  try {
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN';
    const tenantId = req.user?.tenantId;

    if (!isPlatformAdmin && !tenantId) {
      res.status(403).json({ error: 'Tenant access required' });
      return;
    }

    const whereClause: any = {};
    if (!isPlatformAdmin && tenantId) {
      whereClause.tenantId = tenantId;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      offlineRouters,
      setupRequests,
      pendingApplicationsCount,
      pendingWithdrawalsCount,
      todayPayments,
    ] = await Promise.all([
      prisma.router.findMany({
        where: { ...whereClause, status: { in: ['OFFLINE', 'ERROR'] } },
        select: {
          id: true,
          name: true,
          status: true,
          vendor: true,
          tenant: { select: { name: true } },
        },
        take: 5,
      }),
      prisma.deviceSetupRequest.findMany({
        where: {
          ...whereClause,
          status: isPlatformAdmin
            ? { in: ['PENDING', 'IN_PROGRESS'] }
            : { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
          updatedAt: { gte: sevenDaysAgo },
        },
        select: {
          id: true,
          deviceName: true,
          deviceVendor: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      isPlatformAdmin
        ? prisma.operatorApplication.count({ where: { status: 'PENDING' } })
        : Promise.resolve(0),
      prisma.withdrawal.count({
        where: { ...whereClause, status: 'PENDING' },
      }),
      prisma.payment.findMany({
        where: {
          ...whereClause,
          status: { in: ['SUCCESS', 'COMPLETED'] },
          createdAt: { gte: startOfToday },
        },
        select: { amount: true },
      }),
    ]);

    type AlertItem = {
      id: string;
      severity: 'error' | 'warning' | 'info' | 'success';
      titleSw: string;
      titleEn: string;
      messageSw: string;
      messageEn: string;
      href: string;
      timestamp: string;
    };

    const alerts: AlertItem[] = [];

    for (const r of offlineRouters) {
      const ownerPrefix = isPlatformAdmin && r.tenant?.name ? `${r.tenant.name} — ` : '';
      alerts.push({
        id: `router-offline-${r.id}`,
        severity: r.status === 'ERROR' ? 'error' : 'warning',
        titleSw: r.status === 'ERROR' ? `Hitilafu ya Mtambo: ${r.name}` : `Mtambo Hauko Hewani: ${r.name}`,
        titleEn: r.status === 'ERROR' ? `Gateway Error: ${r.name}` : `Gateway Offline: ${r.name}`,
        messageSw: `${ownerPrefix}${r.vendor} haipatikani sasa. Kagua umeme, intaneti, au WireGuard.`,
        messageEn: `${ownerPrefix}${r.vendor} is unreachable. Check power, ISP link, or WireGuard tunnel.`,
        href: '/routers',
        timestamp: now.toISOString(),
      });
    }

    if (isPlatformAdmin && pendingApplicationsCount > 0) {
      alerts.push({
        id: 'pending-applications',
        severity: 'warning',
        titleSw: `Maombi ${pendingApplicationsCount} Yanasubiri Idhini`,
        titleEn: `${pendingApplicationsCount} Pending Operator Application(s)`,
        messageSw: 'Waendeshaji wapya wameomba kujiunga na mfumo wa PoaFi.',
        messageEn: 'New hotspot operators are awaiting review and activation.',
        href: '/applications',
        timestamp: now.toISOString(),
      });
    }

    for (const reqItem of setupRequests) {
      const label = reqItem.deviceName || reqItem.deviceVendor || 'Hardware';
      const isDone = reqItem.status === 'COMPLETED';
      alerts.push({
        id: `setup-${reqItem.id}`,
        severity: isDone ? 'success' : 'info',
        titleSw: isDone ? `Usanidi Umekamilika: ${label}` : `Ombi la Usanidi (${reqItem.status}): ${label}`,
        titleEn: isDone ? `Device Setup Ready: ${label}` : `Device Setup (${reqItem.status}): ${label}`,
        messageSw: isDone
          ? 'Kifaa kimesanidiwa na kiko tayari kutumika.'
          : 'Mchakato wa usanidi wa kifaa unaendelea.',
        messageEn: isDone
          ? 'Your hardware setup is complete and ready for service.'
          : 'Assisted or self-setup hardware provisioning is active.',
        href: '/device-setup',
        timestamp: reqItem.updatedAt.toISOString(),
      });
    }

    if (pendingWithdrawalsCount > 0) {
      alerts.push({
        id: 'pending-withdrawals',
        severity: 'info',
        titleSw: `Maombi ${pendingWithdrawalsCount} ya Kutoa Pesa`,
        titleEn: `${pendingWithdrawalsCount} Pending Payout Request(s)`,
        messageSw: 'Malipo ya kutoa fedha yanasubiri kukamilishwa.',
        messageEn: 'Withdrawal payout request(s) currently awaiting processing.',
        href: isPlatformAdmin ? '/billing' : '/payouts',
        timestamp: now.toISOString(),
      });
    }

    const todaySum = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    if (todayPayments.length > 0) {
      alerts.push({
        id: 'today-revenue',
        severity: 'success',
        titleSw: `Mapato ya Leo: TZS ${todaySum.toLocaleString()}`,
        titleEn: `Today's Revenue: TZS ${todaySum.toLocaleString()}`,
        messageSw: `Miamala ${todayPayments.length} iliyokamilika leo.`,
        messageEn: `${todayPayments.length} completed transaction(s) recorded today.`,
        href: '/billing',
        timestamp: now.toISOString(),
      });
    }

    res.json({
      alerts: alerts.slice(0, 15),
      count: alerts.length,
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

export default router;

