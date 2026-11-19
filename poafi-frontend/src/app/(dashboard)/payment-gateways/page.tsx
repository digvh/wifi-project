"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Ticket,
  Layers,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  PlugZap,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Wallet,
  ShieldCheck,
  Loader2,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

type PaymentMode = "MOBILE_ONLY" | "MIXED" | "VOUCHER_ONLY";

interface GatewayField {
  key: string;
  labelSw: string;
  labelEn: string;
  placeholder: string;
  secret?: boolean;
  optional?: boolean;
}

interface GatewayItem {
  id: string;
  name: string;
  shortBadge: string;
  accentHex: string;
  isPlatformManaged: boolean;
  supportsLiveCheckout: boolean;
  feePercent: number;
  descriptionSw: string;
  descriptionEn: string;
  fields: GatewayField[];
  isEnabled: boolean;
  environment: "PRODUCTION" | "SANDBOX";
  hasCredentials: boolean;
  configuredFields: string[];
  nonSecretValues: Record<string, string>;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

interface SubscriptionPlan {
  id: string;
  nameSw: string;
  nameEn: string;
  badgeSw?: string;
  badgeEn?: string;
  priceMonthlyTzs: number;
  perSiteEquivalentTzs: number;
  savingsPercent: number;
  maxSites: number;
  maxRouters: number;
  featuresSw: string[];
  featuresEn: string[];
}

interface BillingCycle {
  months: number;
  discountPercent: number;
  labelSw: string;
  labelEn: string;
}

interface SubscriptionSummary {
  planId: string;
  planNameEn: string;
  planNameSw: string;
  status: "NONE" | "ACTIVE" | "EXPIRED";
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number;
  siteCount: number;
  effectiveSiteCount: number;
  routerCount: number;
  maxSitesAllowed: number;
  coversCurrentSites: boolean;
  canUseCustomGateways: boolean;
  recommendedPlanId: string;
  plans: SubscriptionPlan[];
  billingCycles: BillingCycle[];
}

export default function PaymentGatewaysPage() {
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("MIXED");
  const [activeCount, setActiveCount] = useState(1);
  const [gateways, setGateways] = useState<GatewayItem[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [subModalPlan, setSubModalPlan] = useState<SubscriptionPlan | null>(null);
  const [subPhone, setSubPhone] = useState("");
  const [subProvider, setSubProvider] = useState<"MPESA" | "TIGOPESA" | "AIRTEL" | "HALOPESA">("MPESA");
  const [subPaying, setSubPaying] = useState(false);
  const [pendingSubPayment, setPendingSubPayment] = useState<any | null>(null);
  const [confirmingSub, setConfirmingSub] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>("POAFI_PAY");

  // Per-gateway form draft states keyed by provider ID
  const [envDrafts, setEnvDrafts] = useState<Record<string, "PRODUCTION" | "SANDBOX">>({});
  const [credDrafts, setCredDrafts] = useState<Record<string, Record<string, string>>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [modeSaving, setModeSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Provider request state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requesting, setRequesting] = useState(false);

  const showNotice = (type: "success" | "error", text: string) => {
    setToast({ type, text });
  };

  const fetchGateways = async () => {
    try {
      const res = await apiFetch("/payments/gateways");
      setPaymentMode(res.paymentMode || "MIXED");
      setActiveCount(res.activeCount ?? 0);
      if (res.subscription) {
        setSubscription(res.subscription);
      }
      const list: GatewayItem[] = res.gateways || [];
      setGateways(list);

      const nextEnvs: Record<string, "PRODUCTION" | "SANDBOX"> = {};
      const nextCreds: Record<string, Record<string, string>> = {};
      for (const gw of list) {
        nextEnvs[gw.id] = gw.environment || "PRODUCTION";
        nextCreds[gw.id] = { ...(gw.nonSecretValues || {}) };
      }
      setEnvDrafts(nextEnvs);
      setCredDrafts((prev) => {
        const merged: Record<string, Record<string, string>> = {};
        for (const gw of list) {
          merged[gw.id] = {
            ...(gw.nonSecretValues || {}),
            ...(prev[gw.id] || {}),
          };
        }
        return merged;
      });
    } catch (err: any) {
      showNotice("error", err.message || t("Imeshindikana kupakia njia za malipo", "Failed to load payment gateways"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckoutModeChange = async (mode: PaymentMode) => {
    if (mode === paymentMode || modeSaving) return;
    setModeSaving(true);
    setToast(null);
    try {
      await apiFetch("/payments/checkout-mode", {
        method: "PATCH",
        body: JSON.stringify({ paymentMode: mode }),
      });
      setPaymentMode(mode);
      const labels: Record<PaymentMode, string> = {
        MOBILE_ONLY: t("Portal imewekwa kwa malipo ya simu pekee.", "Hotspot checkout set to mobile money only."),
        MIXED: t("Portal imewekwa kwa malipo ya simu + vocha.", "Hotspot checkout set to mobile money + voucher."),
        VOUCHER_ONLY: t("Portal imewekwa kwa vocha pekee.", "Hotspot checkout set to voucher only."),
      };
      showNotice("success", labels[mode]);
    } catch (err: any) {
      showNotice("error", err.message);
    } finally {
      setModeSaving(false);
    }
  };

  const handleToggleProvider = async (gw: GatewayItem) => {
    const nextEnabled = !gw.isEnabled;
    if (nextEnabled && !gw.isPlatformManaged && !gw.hasCredentials) {
      setExpandedId(gw.id);
      showNotice(
        "error",
        t(
          `Weka funguo za ${gw.name} hapa chini kisha ubofye Save & enable.`,
          `Enter ${gw.name} credentials below, then click Save & enable.`
        )
      );
      return;
    }

    setBusyKey(`toggle-${gw.id}`);
    setToast(null);
    try {
      const res = await apiFetch(`/payments/gateways/${gw.id}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      showNotice("success", res.message || `${gw.name} ${nextEnabled ? "enabled" : "disabled"}.`);
      await fetchGateways();
    } catch (err: any) {
      if (!gw.hasCredentials) setExpandedId(gw.id);
      showNotice("error", err.message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveGateway = async (gw: GatewayItem, enable: boolean) => {
    setBusyKey(`save-${gw.id}-${enable ? "on" : "off"}`);
    setToast(null);
    try {
      const res = await apiFetch(`/payments/gateways/${gw.id}`, {
        method: "PUT",
        body: JSON.stringify({
          environment: envDrafts[gw.id] || "PRODUCTION",
          credentials: credDrafts[gw.id] || {},
          enable,
        }),
      });
      showNotice("success", res.message || t("Mipangilio imehifadhiwa.", "Gateway settings saved."));
      // Clear secret inputs after saving so we never keep secrets lying around in React state
      setCredDrafts((prev) => {
        const clean: Record<string, string> = {};
        for (const f of gw.fields) {
          if (!f.secret && prev[gw.id]?.[f.key]) {
            clean[f.key] = prev[gw.id][f.key];
          }
        }
        return { ...prev, [gw.id]: clean };
      });
      await fetchGateways();
    } catch (err: any) {
      showNotice("error", err.message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleTestGateway = async (gw: GatewayItem) => {
    setBusyKey(`test-${gw.id}`);
    setToast(null);
    try {
      const res = await apiFetch(`/payments/gateways/${gw.id}/test`, {
        method: "POST",
        body: JSON.stringify({
          environment: envDrafts[gw.id] || "PRODUCTION",
          credentials: credDrafts[gw.id] || {},
        }),
      });
      showNotice("success", res.message || t("Muunganisho uko sawa!", "Connection test succeeded!"));
      await fetchGateways();
    } catch (err: any) {
      showNotice("error", err.message || t("Jaribio limeshindwa.", "Connection test failed."));
      await fetchGateways();
    } finally {
      setBusyKey(null);
    }
  };

  const handleRequestGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestName.trim()) return;
    setRequesting(true);
    setToast(null);
    try {
      const res = await apiFetch("/payments/gateways/request", {
        method: "POST",
        body: JSON.stringify({
          providerName: requestName.trim(),
          notes: requestNotes.trim(),
        }),
      });
      showNotice("success", res.message);
      setRequestName("");
      setRequestNotes("");
      setShowRequestForm(false);
    } catch (err: any) {
      showNotice("error", err.message);
    } finally {
      setRequesting(false);
    }
  };

  const computeCyclePrice = (plan: SubscriptionPlan, months: number) => {
    const cycle = subscription?.billingCycles?.find((c) => c.months === months);
    const discount = cycle?.discountPercent || 0;
    return Math.round(plan.priceMonthlyTzs * months * (1 - discount / 100));
  };

  const handleSubscribeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModalPlan || !subPhone.trim()) return;
    setSubPaying(true);
    setToast(null);
    try {
      const res = await apiFetch("/payments/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({
          planId: subModalPlan.id,
          months: selectedMonths,
          phoneNumber: subPhone.trim(),
          provider: subProvider,
        }),
      });
      setPendingSubPayment(res);
      showNotice("success", res.message);
    } catch (err: any) {
      showNotice("error", err.message);
    } finally {
      setSubPaying(false);
    }
  };

  const handleConfirmSubscription = async () => {
    if (!pendingSubPayment?.subscriptionPaymentId) return;
    setConfirmingSub(true);
    setToast(null);
    try {
      const res = await apiFetch(`/payments/subscription/${pendingSubPayment.subscriptionPaymentId}/confirm`, {
        method: "POST",
      });
      showNotice("success", res.message);
      setPendingSubPayment(null);
      setSubModalPlan(null);
      await fetchGateways();
    } catch (err: any) {
      showNotice("error", err.message);
    } finally {
      setConfirmingSub(false);
    }
  };

  const checkoutOptions: Array<{
    id: PaymentMode;
    titleSw: string;
    titleEn: string;
    descSw: string;
    descEn: string;
    icon: any;
  }> = [
    {
      id: "MOBILE_ONLY",
      titleSw: "Malipo ya Simu Pekee",
      titleEn: "Mobile money only",
      descSw: "Wateja hulipa moja kwa moja kwa M-Pesa, Tigo Pesa, Airtel au Halopesa.",
      descEn: "Customers pay through an enabled mobile money provider.",
      icon: Smartphone,
    },
    {
      id: "MIXED",
      titleSw: "Simu + Vocha",
      titleEn: "Mobile money + voucher",
      descSw: "Toa chaguo zote mbili: kulipa mtandaoni na kuweka namba ya vocha.",
      descEn: "Offer both online payment and voucher codes.",
      icon: Layers,
    },
    {
      id: "VOUCHER_ONLY",
      titleSw: "Vocha Pekee",
      titleEn: "Voucher only",
      descSw: "Wateja huingia kwa vocha halali pekee (bila makato ya 3%).",
      descEn: "Customers enter a valid voucher code only.",
      icon: Ticket,
    },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        {t("Inapakia mipangilio ya malipo...", "Loading payment gateways...")}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#00f3ff]">
            {t("MIPANGILIO YA MALIPO", "CHECKOUT SETTINGS")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
            {t("Mifumo ya Malipo (Payment Gateways)", "Payment Gateways")}
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {t(
              "Sanidi jinsi wateja wako wanavyolipa kwa WiFi. Kila mtoa huduma aliyewashwa huonekana kwenye portal.",
              "Configure how your customers pay for WiFi. Every enabled provider appears at hotspot checkout."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-200">
            {activeCount} {t("imewashwa", activeCount === 1 ? "active provider" : "active providers")}
          </span>
          <Link
            href="/payouts"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white text-xs font-bold hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/15"
          >
            <Wallet size={14} />
            <span>{t("Pochi & Kutoa Pesa", "Earnings & Payouts")}</span>
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
              <span>{toast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning if online checkout selected while 0 gateways enabled */}
      {paymentMode !== "VOUCHER_ONLY" && activeCount === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0 text-amber-400" />
          <span>
            {t(
              "Washa angalau mtoa huduma mmoja wa malipo ya simu hapa chini ili wateja waweze kulipa mtandaoni.",
              "Enable at least one mobile money provider below before customers can pay online."
            )}
          </span>
        </div>
      )}

      {/* Section 1: Hotspot checkout methods */}
      <section className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">
              {t("Njia za Kulipia Hotspot", "Hotspot checkout methods")}
            </h2>
            <p className="text-xs text-gray-400">
              {t(
                "Chagua chaguo ambalo wateja wataona baada ya kuchagua kifurushi cha WiFi.",
                "Choose what customers can use after selecting a WiFi package."
              )}
            </p>
          </div>
          {modeSaving && (
            <span className="text-xs text-[#00f3ff] flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              {t("Inahifadhi...", "Saving checkout method...")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {checkoutOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = paymentMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleCheckoutModeChange(opt.id)}
                disabled={modeSaving}
                className={`text-left p-5 rounded-2xl border transition-all relative flex flex-col justify-between gap-4 ${
                  selected
                    ? "bg-[#00f3ff]/10 border-[#00f3ff] shadow-[0_0_25px_rgba(0,243,255,0.12)]"
                    : "bg-white/[0.02] border-white/10 hover:border-white/25 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      selected ? "bg-[#00f3ff] text-black" : "bg-white/5 text-gray-300"
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  {selected && (
                    <span className="w-6 h-6 rounded-full bg-[#00f3ff] text-black flex items-center justify-center">
                      <CheckCircle2 size={15} />
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === "sw" ? opt.titleSw : opt.titleEn}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {lang === "sw" ? opt.descSw : opt.descEn}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 text-[11px] font-semibold">
                  {selected ? (
                    <span className="text-[#00f3ff]">{t("Njia inayotumika sasa", "Current method")}</span>
                  ) : (
                    <span className="text-gray-500">{t("Bofya kuweka njia hii", "Click to activate")}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 1.5: Operator Monthly Subscription for Custom Direct Gateways & Multi-Site */}
      {subscription && (
        <section className="glass-panel p-5 sm:p-6 rounded-2xl border border-[#00f3ff]/25 space-y-5 bg-gradient-to-br from-[#0b132b]/90 via-[#080c1d]/95 to-[#140b29]/90">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#00f3ff]/15 text-[#00f3ff] border border-[#00f3ff]/30">
                  {t("VIFURUSHI VYA WAENDESHAJI (0% MAKATO)", "OPERATOR MONTHLY SUBSCRIPTION (0% COMMISSION)")}
                </span>
                {subscription.isActive ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {t(
                      `Inatumika · Siku ${subscription.daysRemaining} zimebaki (Hadi Vituo ${subscription.maxSitesAllowed >= 999 ? "Bila Kikomo" : subscription.maxSitesAllowed})`,
                      `Active · ${subscription.daysRemaining} days left (Up to ${subscription.maxSitesAllowed >= 999 ? "Unlimited" : subscription.maxSitesAllowed} Sites)`
                    )}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {t("Unatumia PoaFi Pay (Bure kwa Mwezi)", "Currently on PoaFi Pay (Free Monthly)")}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                {t(
                  "Unataka kutumia mfumo wako binafsi wa malipo (AzamPay, ClickPesa, Snippe, Pesapal, PalmPesa)?",
                  "Want to use your own direct payment gateway (0% PoaFi transaction fee)?"
                )}
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed max-w-3xl">
                {t(
                  `Ukitumia PoaFi Pay haulipi ada ya mwezi (unakatwa 3% tu ukitoa pesa). Lakini ukitumia mfumo wako binafsi wa malipo ambapo 100% ya pesa inaingia moja kwa moja kwako, chagua kifurushi cha mwezi hapa chini. Una vituo (Sites) ${subscription.effectiveSiteCount} — waendeshaji wenye vituo vingi wanaokoa hadi 60% kwa kila kituo!`,
                  `With PoaFi Pay there is no monthly fee (only a 3% withdrawal fee). To connect your own merchant gateway where 100% of customer payments settle directly to you, activate a monthly plan below. Your account currently has ${subscription.effectiveSiteCount} Wi-Fi site(s) — multi-site plans save up to 60% per site!`
                )}
              </p>
            </div>

            {/* Billing Cycle Switcher (1 / 3 / 12 Months) */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 self-start">
              {(subscription.billingCycles || []).map((cycle) => {
                const active = selectedMonths === cycle.months;
                return (
                  <button
                    key={cycle.months}
                    type="button"
                    onClick={() => setSelectedMonths(cycle.months)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      active
                        ? "bg-[#00f3ff] text-black shadow"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {lang === "sw" ? cycle.labelSw : cycle.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Tiered Subscription Cards (Single Site vs Multi-Site Business vs ISP Unlimited) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(subscription.plans || []).map((plan) => {
              const isRecommended = subscription.recommendedPlanId === plan.id;
              const isCurrentPlan = subscription.isActive && subscription.planId === plan.id;
              const tooSmallForSites = plan.maxSites < subscription.effectiveSiteCount;
              const totalPrice = computeCyclePrice(plan, selectedMonths);
              const badge = lang === "sw" ? plan.badgeSw : plan.badgeEn;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-5 border flex flex-col justify-between gap-4 relative transition-all ${
                    isCurrentPlan
                      ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
                      : isRecommended
                      ? "border-[#00f3ff] bg-[#00f3ff]/[0.07] shadow-[0_0_25px_rgba(0,243,255,0.12)]"
                      : "border-white/10 bg-black/30"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        {plan.maxSites >= 999
                          ? t("Vituo Bila Kikomo", "Unlimited Sites")
                          : plan.maxSites === 1
                          ? t("Kituo 1 cha Wi-Fi", "1 Wi-Fi Site")
                          : t(`Hadi Vituo ${plan.maxSites}`, `Up to ${plan.maxSites} Sites`)}
                      </span>
                      {badge && (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white">
                          {badge}
                        </span>
                      )}
                      {!badge && isRecommended && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00f3ff]/20 text-[#00f3ff]">
                          {t("Inashauriwa Kwako", "Recommended")}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        {lang === "sw" ? plan.nameSw : plan.nameEn}
                      </h3>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-white font-mono">
                          TZS {totalPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400">
                          / {selectedMonths === 1 ? t("mwezi", "month") : t(`miezi ${selectedMonths}`, `${selectedMonths} months`)}
                        </span>
                      </div>
                      {plan.maxSites > 1 && (
                        <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                          {t(
                            `Sawa na TZS ${plan.perSiteEquivalentTzs.toLocaleString()} tu kwa kituo (Okoa ${plan.savingsPercent}%!)`,
                            `Only TZS ${plan.perSiteEquivalentTzs.toLocaleString()} per site/mo (Save ${plan.savingsPercent}%!)`
                          )}
                        </p>
                      )}
                    </div>

                    <ul className="space-y-1.5 pt-2 border-t border-white/10 text-xs text-gray-300">
                      {(lang === "sw" ? plan.featuresSw : plan.featuresEn).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-[#00f3ff] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={tooSmallForSites}
                    onClick={() => {
                      setSubModalPlan(plan);
                      setPendingSubPayment(null);
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all ${
                      tooSmallForSites
                        ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                        : isCurrentPlan
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : isRecommended
                        ? "bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white hover:opacity-95 shadow-lg shadow-[#00f3ff]/20"
                        : "bg-white/10 text-white hover:bg-white/20 border border-white/15"
                    }`}
                  >
                    {tooSmallForSites
                      ? t(`Una vituo ${subscription.effectiveSiteCount} (Chagua Multi-Site)`, `You have ${subscription.effectiveSiteCount} sites (Pick Multi-Site)`)
                      : isCurrentPlan
                      ? t("Ongeza Muda wa Kifurushi", "Extend Subscription")
                      : t("Lipia Kifurushi Hiki", "Subscribe with Mobile Money")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Subscription Mobile Money Checkout Modal */}
      <AnimatePresence>
        {subModalPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel max-w-md w-full p-6 rounded-2xl border border-[#00f3ff]/30 bg-[#080d1e] space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#00f3ff]">
                    {t("LIPA ADA YA MFUMO", "OPERATOR SUBSCRIPTION CHECKOUT")}
                  </span>
                  <h3 className="text-lg font-extrabold text-white mt-0.5">
                    {lang === "sw" ? subModalPlan.nameSw : subModalPlan.nameEn}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSubModalPlan(null);
                    setPendingSubPayment(null);
                  }}
                  className="text-gray-400 hover:text-white text-sm px-2"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">
                    {selectedMonths === 1
                      ? t("Muda: Siku 30 (Mwezi 1)", "Duration: 30 Days (1 Month)")
                      : t(`Muda: Miezi ${selectedMonths}`, `Duration: ${selectedMonths} Months`)}
                  </p>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    {t("0% makato ya PoaFi kwenye malipo yako", "Unlocks all direct payment gateways (0% commission)")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[#00f3ff] font-mono">
                    TZS {computeCyclePrice(subModalPlan, selectedMonths).toLocaleString()}
                  </p>
                </div>
              </div>

              {!pendingSubPayment ? (
                <form onSubmit={handleSubscribeCheckout} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      {t("Chagua Mtandao wa Simu", "Select Mobile Money Network")}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["MPESA", "TIGOPESA", "AIRTEL", "HALOPESA"] as const).map((prov) => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => setSubProvider(prov)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                            subProvider === prov
                              ? "border-[#00f3ff] bg-[#00f3ff]/15 text-white"
                              : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                          }`}
                        >
                          {prov === "TIGOPESA" ? "Mixx by Yas / Tigo" : prov}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      {t("Namba ya Simu ya Kulipia", "Mobile Money Phone Number")}
                    </label>
                    <input
                      required
                      type="tel"
                      value={subPhone}
                      onChange={(e) => setSubPhone(e.target.value)}
                      placeholder="0754XXXXXX / 0655XXXXXX"
                      className="w-full bg-[#050814] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={subPaying}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white text-xs font-extrabold hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {subPaying && <Loader2 size={15} className="animate-spin" />}
                    <span>
                      {subPaying
                        ? t("Inatuma ombi la malipo...", "Sending payment prompt...")
                        : t(
                            `Lipa TZS ${computeCyclePrice(subModalPlan, selectedMonths).toLocaleString()} Sasa`,
                            `Pay TZS ${computeCyclePrice(subModalPlan, selectedMonths).toLocaleString()} Now`
                          )}
                    </span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-1.5">
                    <p className="font-bold text-emerald-300">
                      {t("Ombi la malipo limetumwa kwenye simu yako!", "Payment prompt sent to your phone!")}
                    </p>
                    <p>{pendingSubPayment.message}</p>
                    <p className="font-mono text-[11px] text-gray-400">
                      Ref: {pendingSubPayment.reference}
                    </p>
                  </div>

                  {pendingSubPayment.canQuickConfirm && (
                    <button
                      type="button"
                      disabled={confirmingSub}
                      onClick={handleConfirmSubscription}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center justify-center gap-2"
                    >
                      {confirmingSub && <Loader2 size={15} className="animate-spin" />}
                      <span>
                        {t(
                          "Thibitisha Malipo (Sandbox) & Washa Kifurushi Sasa",
                          "Confirm Sandbox Payment & Activate Subscription Now"
                        )}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 2: Mobile money providers */}
      <section className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">
              {t("Watoa Huduma za Malipo", "Mobile money providers")}
            </h2>
            <p className="text-xs text-gray-400">
              {t(
                "Weka taarifa zako za malipo, jaribu muunganisho, kisha uwashe unaotaka kuwapa wateja wako.",
                "Add credentials, test the connection, then turn on the providers you want to offer."
              )}
            </p>
          </div>
          <span className="text-[11px] text-gray-400">
            {t("Bofya mtoa huduma kusanidi", "Click a provider to configure it")}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {gateways.map((gw) => {
            const isExpanded = expandedId === gw.id;
            const statusBadge = gw.isEnabled
              ? { label: t("Inatumika · Live", `Active · ${gw.environment === "SANDBOX" ? "Sandbox" : "Live"}`), cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
              : gw.hasCredentials
              ? { label: t("Imesanidiwa · Imezimwa", "Configured · Off"), cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
              : { label: t("Inahitaji Usanidi", "Setup required"), cls: "bg-white/5 text-gray-400 border-white/10" };

            return (
              <div
                key={gw.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  gw.isEnabled
                    ? "border-[#00f3ff]/40 bg-[#0b1224]/90"
                    : "border-white/10 bg-[#070b17]/80"
                }`}
              >
                {/* Provider Header Row */}
                <div className="p-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : gw.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border border-white/10"
                      style={{
                        backgroundColor: `${gw.accentHex}22`,
                        color: gw.accentHex,
                      }}
                    >
                      {gw.shortBadge}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-white">{gw.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {gw.isPlatformManaged
                          ? t("Mifuko ya PoaFi (3% ada ya kutoa)", "Managed wallet (3% withdrawal fee)")
                          : gw.supportsLiveCheckout
                          ? t("Malipo ya moja kwa moja (STK Push)", "Direct merchant STK Push checkout")
                          : t("Hifadhi funguo · Uunganishaji wa moja kwa moja", "Merchant credential vault & test")}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={gw.isEnabled}
                      aria-label={`Toggle ${gw.name}`}
                      disabled={busyKey === `toggle-${gw.id}`}
                      onClick={() => handleToggleProvider(gw)}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                        gw.isEnabled ? "bg-[#00f3ff]" : "bg-white/15"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          gw.isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : gw.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Configuration Body */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="border-t border-white/10 bg-black/25"
                    >
                      <div className="p-4 space-y-4">
                        {/* Description / Fee Notice */}
                        <div
                          className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                            gw.isPlatformManaged
                              ? "bg-[#00f3ff]/10 border-[#00f3ff]/25 text-cyan-100"
                              : "bg-white/5 border-white/10 text-gray-300"
                          }`}
                        >
                          {gw.isPlatformManaged ? (
                            <Sparkles size={16} className="text-[#00f3ff] shrink-0 mt-0.5" />
                          ) : (
                            <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                          )}
                          <p className="leading-relaxed">
                            {lang === "sw" ? gw.descriptionSw : gw.descriptionEn}
                          </p>
                        </div>

                        {/* Environment Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                            {t("Mazingira (Environment)", "Environment")}
                          </label>
                          <select
                            value={envDrafts[gw.id] || "PRODUCTION"}
                            onChange={(e) =>
                              setEnvDrafts((prev) => ({
                                ...prev,
                                [gw.id]: e.target.value as "PRODUCTION" | "SANDBOX",
                              }))
                            }
                            className="w-full bg-[#090d1e] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                          >
                            <option value="PRODUCTION">{t("Production (Live)", "Production (live)")}</option>
                            <option value="SANDBOX">{t("Sandbox (Majaribio)", "Sandbox (test)")}</option>
                          </select>
                        </div>

                        {/* Credential Inputs */}
                        {gw.fields.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {gw.fields.map((field) => {
                              const isAlreadySaved = gw.configuredFields.includes(field.key);
                              const value = credDrafts[gw.id]?.[field.key] ?? "";
                              return (
                                <div key={field.key} className="space-y-1">
                                  <label className="text-[11px] font-medium text-gray-300 flex items-center justify-between gap-1">
                                    <span>{lang === "sw" ? field.labelSw : field.labelEn}</span>
                                    {isAlreadySaved && field.secret && (
                                      <span className="text-[10px] text-emerald-400 font-semibold">
                                        {t("Imehifadhiwa", "Saved")}
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type={field.secret ? "password" : "text"}
                                    value={value}
                                    onChange={(e) =>
                                      setCredDrafts((prev) => ({
                                        ...prev,
                                        [gw.id]: {
                                          ...(prev[gw.id] || {}),
                                          [field.key]: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder={
                                      isAlreadySaved && field.secret
                                        ? t("Acha wazi kubaki na iliyopo", "Leave blank to keep existing")
                                        : field.placeholder
                                    }
                                    className="w-full bg-[#090d1e] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => handleSaveGateway(gw, true)}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {busyKey === `save-${gw.id}-on` && <Loader2 size={13} className="animate-spin" />}
                            <span>{t("Hifadhi & Washa", "Save & enable")}</span>
                          </button>

                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => handleSaveGateway(gw, false)}
                            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-gray-200 hover:bg-white/10 text-xs font-semibold disabled:opacity-50"
                          >
                            {t("Hifadhi bila kuwasha", "Save without enabling")}
                          </button>

                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => handleTestGateway(gw)}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-[#00f3ff] hover:bg-[#00f3ff]/10 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {busyKey === `test-${gw.id}` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <PlugZap size={13} />
                            )}
                            <span>{t("Jaribu Muunganisho", "Test connection")}</span>
                          </button>
                        </div>

                        {gw.lastTestMessage && (
                          <div
                            className={`text-[11px] p-2.5 rounded-lg border ${
                              gw.lastTestStatus === "OK"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                : "bg-red-500/10 border-red-500/20 text-red-300"
                            }`}
                          >
                            {gw.lastTestMessage}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Request a missing provider card */}
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-5 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 shrink-0">
                <Plus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {t("Huoni mfumo wako wa malipo?", "Don't see your provider?")}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  {t(
                    "Omba mfumo mpya wa malipo (mf. Selcom, Flutterwave, M-Pesa Direct) na timu yetu itauongeza.",
                    "Request a payment gateway and our engineering team will integrate it for your region."
                  )}
                </p>
              </div>
            </div>

            {!showRequestForm ? (
              <button
                type="button"
                onClick={() => setShowRequestForm(true)}
                className="self-start px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:border-[#00f3ff]/50 transition-colors flex items-center gap-1.5"
              >
                <KeyRound size={13} className="text-[#00f3ff]" />
                <span>{t("Omba Mtoa Huduma Mpya", "Request a provider")}</span>
              </button>
            ) : (
              <form onSubmit={handleRequestGateway} className="space-y-2.5">
                <input
                  required
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder={t("Jina la mfumo (mf. Selcom / DPO)", "Gateway name (e.g. Selcom, Flutterwave)")}
                  className="w-full bg-[#090d1e] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                />
                <input
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder={t("Namba yako au maelezo (hiari)", "Notes or merchant type (optional)")}
                  className="w-full bg-[#090d1e] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={requesting}
                    className="px-3.5 py-2 rounded-xl bg-[#00f3ff] text-black text-xs font-bold flex items-center gap-1.5"
                  >
                    <Send size={12} />
                    <span>{requesting ? t("Inatuma...", "Submitting...") : t("Tuma Ombi", "Submit request")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    className="px-3 py-2 rounded-xl bg-white/5 text-gray-300 text-xs"
                  >
                    {t("Ghairi", "Cancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
