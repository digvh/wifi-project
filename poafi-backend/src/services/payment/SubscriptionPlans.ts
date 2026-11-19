import { prisma } from '../../config/database';

export type SubscriptionPlanId =
  | 'POAFI_PAY_COMMISSION'
  | 'STARTER_1_SITE'
  | 'GROWTH_MULTI_SITE'
  | 'ENTERPRISE_UNLIMITED';

export interface SubscriptionPlanDef {
  id: SubscriptionPlanId;
  nameSw: string;
  nameEn: string;
  badgeSw?: string;
  badgeEn?: string;
  priceMonthlyTzs: number;
  perSiteEquivalentTzs: number;
  savingsPercent: number;
  maxSites: number;
  maxRouters: number;
  allowsCustomGateway: boolean;
  featuresSw: string[];
  featuresEn: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  {
    id: 'STARTER_1_SITE',
    nameSw: 'Mpango wa Kituo 1 (Starter)',
    nameEn: 'Single-Site Starter (1 Site)',
    priceMonthlyTzs: 20000,
    perSiteEquivalentTzs: 20000,
    savingsPercent: 0,
    maxSites: 1,
    maxRouters: 2,
    allowsCustomGateway: true,
    featuresSw: [
      '0% makato ya PoaFi (100% inaingia kwenye akaunti yako)',
      'Tumia AzamPay, ClickPesa, Snippe, Pesapal au PalmPesa yako',
      'Kituo (Site) 1 cha Wi-Fi · Hadi ruta 2',
      'Vocha na wateja bila kikomo',
    ],
    featuresEn: [
      '0% PoaFi commission (100% settles directly to your account)',
      'Use your own AzamPay, ClickPesa, Snippe, Pesapal or PalmPesa keys',
      '1 Wi-Fi Site · Up to 2 Routers',
      'Unlimited vouchers & hotspot customers',
    ],
  },
  {
    id: 'GROWTH_MULTI_SITE',
    nameSw: 'Biashara Vituo Vingi (Hadi Vituo 5)',
    nameEn: 'Multi-Site Business (Up to 5 Sites)',
    badgeSw: 'BORA KWA VITUO 2–5 · OKOA 40%',
    badgeEn: 'BEST FOR 2–5 SITES · SAVE 40%',
    priceMonthlyTzs: 60000,
    perSiteEquivalentTzs: 12000,
    savingsPercent: 40,
    maxSites: 5,
    maxRouters: 10,
    allowsCustomGateway: true,
    featuresSw: [
      'TZS 12,000 tu kwa kituo (Okoa 40% kwa kila kituo!)',
      '0% makato ya PoaFi kwenye malipo yako binafsi',
      'Hadi Vituo (Sites) 5 vya Wi-Fi · Hadi ruta 10',
      'Ripoti za mapato kwa kila kituo & msaada wa kipaumbele',
    ],
    featuresEn: [
      'Only TZS 12,000 per site (Save 40% per site!)',
      '0% PoaFi commission on all your direct payment gateways',
      'Up to 5 Wi-Fi Sites · Up to 10 Routers',
      'Per-site revenue analytics & priority support',
    ],
  },
  {
    id: 'ENTERPRISE_UNLIMITED',
    nameSw: 'ISP Bila Kikomo (Vituo 6+)',
    nameEn: 'ISP Enterprise (Unlimited Sites)',
    badgeSw: 'VITUO BILA KIKOMO · OKOA 60%+',
    badgeEn: 'UNLIMITED SITES · SAVE 60%+',
    priceMonthlyTzs: 120000,
    perSiteEquivalentTzs: 8000,
    savingsPercent: 60,
    maxSites: 999,
    maxRouters: 999,
    allowsCustomGateway: true,
    featuresSw: [
      'Vituo (Sites) na Ruta BILA KIKOMO nchi nzima',
      '0% makato ya PoaFi kwenye mifumo yote ya malipo ya moja kwa moja',
      'Inafaa kwa waendeshaji wenye vituo 6 au zaidi',
      'Msaada wa FreeRADIUS, Omada SDN Controller & PPPoE',
    ],
    featuresEn: [
      'UNLIMITED Wi-Fi Sites & Routers across all locations',
      '0% PoaFi commission on all direct payment gateways',
      'Ideal for operators & ISPs with 6 or more sites',
      'Full FreeRADIUS, Omada SDN Controller & PPPoE support',
    ],
  },
];

export const BILLING_CYCLE_OPTIONS = [
  { months: 1, discountPercent: 0, labelSw: 'Mwezi 1', labelEn: '1 Month' },
  { months: 3, discountPercent: 10, labelSw: 'Miezi 3 (Punguzo 10%)', labelEn: '3 Months (10% Off)' },
  { months: 12, discountPercent: 20, labelSw: 'Mwaka 1 (Punguzo 20%)', labelEn: '12 Months (20% Off)' },
];

export function getSubscriptionPlan(planId: string): SubscriptionPlanDef | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId);
}

export function calculateSubscriptionPriceTzs(planId: string, months = 1): number {
  const plan = getSubscriptionPlan(planId);
  if (!plan) throw new Error('Invalid subscription plan');
  const validMonths = [1, 3, 12].includes(months) ? months : 1;
  const cycle = BILLING_CYCLE_OPTIONS.find((c) => c.months === validMonths) || BILLING_CYCLE_OPTIONS[0];
  const gross = plan.priceMonthlyTzs * validMonths;
  return Math.round(gross * (1 - cycle.discountPercent / 100));
}

export async function getTenantSubscriptionSummary(tenantId: string) {
  const [tenant, siteCount, routerCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }) as Promise<any>,
    prisma.site.count({ where: { tenantId } }),
    prisma.router.count({ where: { tenantId } }),
  ]);

  const effectiveSiteCount = Math.max(1, siteCount);
  const now = new Date();
  const expiresAt = tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
  const isActive =
    Boolean(tenant?.subscriptionStatus === 'ACTIVE' && expiresAt && expiresAt.getTime() > now.getTime());
  const daysRemaining =
    isActive && expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;

  const currentPlan = getSubscriptionPlan(tenant?.subscriptionPlan || '');
  const maxSitesAllowed = isActive ? Number(tenant?.subscriptionMaxSites || currentPlan?.maxSites || 1) : 0;
  const coversCurrentSites = isActive && maxSitesAllowed >= effectiveSiteCount;

  const recommendedPlanId: SubscriptionPlanId =
    effectiveSiteCount <= 1
      ? 'STARTER_1_SITE'
      : effectiveSiteCount <= 5
        ? 'GROWTH_MULTI_SITE'
        : 'ENTERPRISE_UNLIMITED';

  return {
    planId: (tenant?.subscriptionPlan || 'POAFI_PAY_COMMISSION') as SubscriptionPlanId,
    planNameEn: currentPlan?.nameEn || 'PoaFi Pay (Commission Mode - No Monthly Fee)',
    planNameSw: currentPlan?.nameSw || 'PoaFi Pay (Malipo kwa Kamisheni - Bila Ada ya Mwezi)',
    status: isActive ? 'ACTIVE' : expiresAt ? 'EXPIRED' : 'NONE',
    isActive,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    daysRemaining,
    siteCount,
    effectiveSiteCount,
    routerCount,
    maxSitesAllowed,
    coversCurrentSites,
    canUseCustomGateways: coversCurrentSites,
    recommendedPlanId,
    plans: SUBSCRIPTION_PLANS,
    billingCycles: BILLING_CYCLE_OPTIONS,
  };
}
