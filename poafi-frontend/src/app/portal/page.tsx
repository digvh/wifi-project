"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wifi, 
  KeyRound, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Globe, 
  Copy, 
  Check, 
  Sparkles,
  Zap,
  Clock,
  Radio,
  Lock
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const PROVIDERS = [
  { id: "MPESA", name: "M-Pesa", badge: "Vodacom", color: "from-red-600 to-rose-700", ring: "ring-red-500/50" },
  { id: "TIGOPESA", name: "Tigo Pesa", badge: "Tigo", color: "from-blue-600 to-indigo-700", ring: "ring-blue-500/50" },
  { id: "AIRTEL", name: "Airtel Money", badge: "Airtel", color: "from-red-500 to-red-700", ring: "ring-red-500/50" },
  { id: "HALOPESA", name: "Halopesa", badge: "Halotel", color: "from-orange-500 to-amber-600", ring: "ring-orange-500/50" },
];

const I18N = {
  sw: {
    welcome: "Karibu kwenye mtandao wa",
    speed: "Intaneti ya Kasi ya Juu",
    buyTab: "Lipa kwa Simu (Lipa Sasa)",
    voucherTab: "Weka Vocha",
    step1: "1. Chagua Kifurushi",
    step2: "2. Chagua Mtandao wa Malipo",
    step3: "3. Weka Nambari Yako ya Simu",
    phonePlaceholder: "Mfano: 0754 123 456",
    phoneHint: "Ujumbe wa malipo (USSD PIN prompt) utatokea moja kwa moja kwenye kioo cha simu yako.",
    payBtn: "Lipia & Unganisha",
    enterVoucherLabel: "Weka Nambari ya Vocha ya Wi-Fi",
    voucherHint: "Weka kodi ya tarakimu 8 kutoka kwenye kadi yako ya vocha.",
    redeemBtn: "Thibitisha & Unganisha",
    checkPhoneTitle: "Angalia Kioo cha Simu Yako Sasa!",
    waitingPin: "Tafadhali ingiza PIN yako ya siri kukamilisha malipo...",
    promptSent: "Ombi la malipo limetumwa",
    waitingInput: "Inasubiri uthibitisho wa PIN kwenye simu",
    autoConnect: "Kuanzisha intaneti kiotomatiki",
    connectedTitle: "🎉 Hongera! Umeunganishwa!",
    connectedSub: "Kifurushi chako kimewashwa kikamilifu kwenye mtandao.",
    voucherReadyTitle: "✅ Vocha Yako Iko Tayari!",
    voucherReadySub: "Nenda kwenye ukurasa wa kuingia Wi-Fi na uweke kodi hii kuanza kutumia intaneti.",
    voucherCodeLabel: "Kodi Yako ya Vocha (Voucher Code)",
    startBrowsing: "Anza Kutumia Intaneti Sasa",
    goToSignIn: "Nenda Kwenye Ukurasa wa Kuingia",
    copied: "Imenakiliwa!",
    copyCode: "Nakili Kodi",
    cancel: "← Ghairi na chagua upya",
    secured: "Imelindwa na Mfumo wa PoaFi Wi-Fi Core",
    testSim: "⚡ Jaribio la Haraka: Bonyeza Hapa Kuthibitisha PIN (Lab Mode)",
  },
  en: {
    welcome: "Welcome to",
    speed: "High-Speed Wi-Fi Network",
    buyTab: "Mobile Money (STK Push)",
    voucherTab: "Enter Voucher",
    step1: "1. Choose Package",
    step2: "2. Select Payment Network",
    step3: "3. Mobile Phone Number",
    phonePlaceholder: "e.g. 0754 123 456",
    phoneHint: "A payment prompt (USSD PIN popup) will appear directly on your phone screen.",
    payBtn: "Pay & Connect",
    enterVoucherLabel: "Enter Wi-Fi Voucher Code",
    voucherHint: "Enter the 8-character voucher code from your printed scratch card.",
    redeemBtn: "Redeem & Connect",
    checkPhoneTitle: "Check Your Phone Screen Now!",
    waitingPin: "Please enter your mobile money PIN to complete payment...",
    promptSent: "Payment prompt dispatched",
    waitingInput: "Waiting for PIN entry on your phone",
    autoConnect: "Activating Wi-Fi session automatically",
    connectedTitle: "🎉 Congratulations! Connected!",
    connectedSub: "Your high-speed internet access has been activated successfully.",
    voucherReadyTitle: "✅ Your Voucher is Ready!",
    voucherReadySub: "Go to the Wi-Fi login page and enter this code to start browsing.",
    voucherCodeLabel: "Your Voucher Code",
    startBrowsing: "Start Browsing Now",
    goToSignIn: "Go to Wi-Fi Sign-in Page",
    copied: "Copied!",
    copyCode: "Copy Code",
    cancel: "← Cancel and choose different package",
    secured: "Secured by PoaFi Wi-Fi Core",
    testSim: "⚡ Instant Lab Test: Click to Confirm PIN Simulation",
  },
};

function PortalContent() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant") || "tanga";

  const [lang, setLang] = useState<"sw" | "en">("sw");
  const [paymentMode, setPaymentMode] = useState<"MOBILE_ONLY" | "VOUCHER_ONLY" | "MIXED">("MIXED");
  const [activeTab, setActiveTab] = useState<"buy" | "voucher">("buy");
  const [packages, setPackages] = useState<any[]>([]);
  const [operatorName, setOperatorName] = useState("PoaFi Hotspot");
  const [loadingPackages, setLoadingPackages] = useState(true);

  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("MPESA");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  const [voucherCode, setVoucherCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<any>(null);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const t = I18N[lang];

  useEffect(() => {
    async function loadPackages() {
      try {
        setLoadingPackages(true);
        const res = await apiFetch(`/packages/public/${tenantSlug}`);
        setPackages(res.packages || []);
        if (res.operator) setOperatorName(res.operator);
        if (res.paymentMode) {
          setPaymentMode(res.paymentMode);
          if (res.paymentMode === "VOUCHER_ONLY") setActiveTab("voucher");
          if (res.paymentMode === "MOBILE_ONLY") setActiveTab("buy");
        }
        if (res.packages && res.packages.length > 0) {
          setSelectedPackageId(res.packages[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load packages:", err);
      } finally {
        setLoadingPackages(false);
      }
    }
    loadPackages();
  }, [tenantSlug]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCheckoutLoading(true);

    try {
      const res = await apiFetch("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({
          tenantSlug,
          packageId: selectedPackageId,
          phoneNumber,
          provider: selectedProvider,
        }),
      });
      setCheckoutData(res);
      setPolling(true);
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    if (!polling || !checkoutData?.paymentId || !checkoutData?.accessToken) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/payments/${checkoutData.paymentId}/status`, {
          headers: { "X-Payment-Access-Token": checkoutData.accessToken },
        });
        if (res.status === "SUCCESS") {
          setPaymentStatus(res);
          setPolling(false);
          clearInterval(interval);
        } else if (res.status === "FAILED") {
          setError(lang === "sw" ? "Malipo yamekataliwa au yameshindikana." : "Payment declined or failed.");
          setPolling(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, checkoutData, lang]);

  const handleSimulatePayment = async () => {
    if (!checkoutData?.paymentId || !checkoutData?.accessToken) return;
    try {
      const res = await apiFetch(`/payments/${checkoutData.paymentId}/simulate-confirm`, {
        method: "POST",
        headers: { "X-Payment-Access-Token": checkoutData.accessToken },
      });
      setPaymentStatus({
        ...checkoutData,
        status: "SUCCESS",
        voucherCode: res.voucherCode,
        accessMode: res.accessMode,
        voucherStatus: res.voucherStatus,
        durationMinutes: res.durationMinutes || 60,
      });
      setPolling(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRedeemLoading(true);
    try {
      const res = await apiFetch("/portal/redeem", {
        method: "POST",
        body: JSON.stringify({ code: voucherCode.trim().toUpperCase(), tenantSlug }),
      });
      setRedeemSuccess(res);
    } catch (err: any) {
      setError(err.message || "Vocha si sahihi / Invalid voucher code");
    } finally {
      setRedeemLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const activeProviderObj = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];
  const isRadiusMode = paymentStatus?.accessMode === "RADIUS" || redeemSuccess?.requiresDeviceLogin === true;
  const hasSuccess = Boolean(paymentStatus || redeemSuccess);
  const displayCode = paymentStatus?.voucherCode || voucherCode;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050510] text-white relative overflow-hidden">
      {/* Background Ambient Cyber Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#00f3ff]/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#9d00ff]/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="w-full max-w-lg space-y-6 relative z-10">
        {/* Language & Network Header */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Radio size={14} className="text-[#00f3ff] animate-pulse" />
            <span className="font-mono text-[11px]">HOTSPOT ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-full">
            <button
              onClick={() => setLang("sw")}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "sw" ? "bg-[#00f3ff] text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              🇹🇿 SW
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "en" ? "bg-[#00f3ff] text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              🇬🇧 EN
            </button>
          </div>
        </div>

        {/* Hotspot Branding Card */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="w-16 h-16 bg-[#00f3ff]/15 rounded-2xl flex items-center justify-center mx-auto border border-[#00f3ff]/40 shadow-[0_0_30px_rgba(0,243,255,0.25)] relative">
            <Wifi className="w-8 h-8 text-[#00f3ff]" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#050510] animate-ping" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#050510]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">{operatorName}</h1>
          <p className="text-xs text-gray-400">
            {t.welcome} <span className="text-[#00f3ff] font-bold">{operatorName}</span> • {t.speed}
          </p>
        </motion.div>

        {/* SUCCESS STATE */}
        <AnimatePresence>
          {hasSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-panel p-8 text-center space-y-6 border border-green-500/40 bg-gradient-to-b from-green-500/20 via-transparent to-transparent shadow-[0_0_40px_rgba(34,197,94,0.2)] rounded-3xl"
            >
              <div className="relative w-20 h-20 mx-auto">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ duration: 0.5 }}
                  className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center border-2 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
                >
                  <CheckCircle2 size={44} />
                </motion.div>
                <div className="absolute inset-0 rounded-full border border-green-500/30 animate-ping pointer-events-none" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white">
                  {isRadiusMode ? t.voucherReadyTitle : t.connectedTitle}
                </h2>
                <p className="text-xs text-gray-300 max-w-sm mx-auto leading-relaxed">
                  {isRadiusMode ? t.voucherReadySub : t.connectedSub}
                </p>
              </div>

              {displayCode && (
                <div className="bg-black/50 p-5 rounded-2xl border border-white/10 space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span className="uppercase tracking-wider font-semibold">{t.voucherCodeLabel}</span>
                    <span className="text-[#00f3ff] font-mono text-[11px] flex items-center gap-1">
                      <Zap size={12} /> {paymentStatus?.durationMinutes || redeemSuccess?.durationMinutes || 60} Min
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-3xl font-mono font-black text-[#00f3ff] tracking-widest pl-2">
                      {displayCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(displayCode)}
                      className="px-3.5 py-2 bg-[#00f3ff]/20 hover:bg-[#00f3ff]/30 text-[#00f3ff] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-[#00f3ff]/40"
                    >
                      {copiedCode ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      <span>{copiedCode ? t.copied : t.copyCode}</span>
                    </button>
                  </div>
                </div>
              )}

              {isRadiusMode ? (
                <div className="text-xs text-gray-300 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl text-left space-y-1">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Lock size={14} /> Kuingia Kwenye Kifaa (Device Sign-In)
                  </p>
                  <p className="text-[11px] text-gray-300">
                    Fungua ukurasa wa sign-in wa simu yako kwenye Wi-Fi hii na uweke kodi hiyo ya tarakimu 8.
                  </p>
                </div>
              ) : (
                <a
                  href="https://www.google.com"
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-extrabold py-4 px-8 rounded-2xl shadow-xl shadow-green-500/25 hover:opacity-95 transition-all text-sm"
                >
                  <span>{t.startBrowsing}</span>
                  <ArrowRight size={18} className="animate-pulse" />
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN INTERFACE (TABS & FORMS) */}
        {!hasSuccess && (
          <div className="glass-panel p-6 space-y-6 rounded-3xl border border-white/10 shadow-2xl">
            {/* Mode Tabs */}
            {paymentMode === "MIXED" && !checkoutData && (
              <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => { setActiveTab("buy"); setError(""); }}
                  className={`py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                    activeTab === "buy"
                      ? "bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white shadow-lg shadow-[#00f3ff]/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Smartphone size={16} />
                  <span>{t.buyTab}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("voucher"); setError(""); }}
                  className={`py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                    activeTab === "voucher"
                      ? "bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white shadow-lg shadow-[#00f3ff]/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <KeyRound size={16} />
                  <span>{t.voucherTab}</span>
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs text-center">
                {error}
              </div>
            )}

            {/* TAB 1: BUY VIA MOBILE MONEY */}
            {activeTab === "buy" && paymentMode !== "VOUCHER_ONLY" && (
              <div>
                {!checkoutData ? (
                  <form onSubmit={handleCheckout} className="space-y-5">
                    {/* Step 1: Packages */}
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                        {t.step1}
                      </label>
                      {loadingPackages ? (
                        <div className="text-xs text-gray-400 p-4 text-center">Inapakia vifurushi...</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {packages.map((pkg) => (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => setSelectedPackageId(pkg.id)}
                              className={`p-3.5 rounded-2xl text-left border transition-all relative overflow-hidden ${
                                selectedPackageId === pkg.id
                                  ? "bg-[#00f3ff]/15 border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                                  : "bg-white/5 border-white/10 hover:border-white/20"
                              }`}
                            >
                              <p className="font-black text-sm text-white">{pkg.name}</p>
                              <p className="text-xs text-[#00f3ff] font-bold mt-1">
                                TZS {pkg.priceTzs.toLocaleString()}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                                <Clock size={10} />
                                <span>{pkg.durationMinutes >= 1440 ? `${Math.round(pkg.durationMinutes/1440)} Siku` : `${Math.round(pkg.durationMinutes/60)} Saa`}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 2: Providers */}
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                        {t.step2}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {PROVIDERS.map((prov) => (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => setSelectedProvider(prov.id)}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                              selectedProvider === prov.id
                                ? `bg-white/15 border-[#00f3ff] text-white shadow-md ${prov.ring}`
                                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                            }`}
                          >
                            <span>{prov.name}</span>
                            <span className="text-[10px] opacity-70 uppercase font-mono">{prov.badge}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 3: Phone */}
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                        {t.step3}
                      </label>
                      <div className="relative">
                        <Smartphone className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                        <input
                          type="tel"
                          placeholder={t.phonePlaceholder}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-[#00f3ff]"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">{t.phoneHint}</p>
                    </div>

                    <button
                      type="submit"
                      disabled={checkoutLoading || !selectedPackageId}
                      className="w-full bg-gradient-to-r from-[#00f3ff] via-[#6a00ff] to-[#9d00ff] text-white font-black py-4 rounded-2xl hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/20 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {checkoutLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Zap size={16} />
                          <span>
                            {t.payBtn} {selectedPkg ? `(TZS ${selectedPkg.priceTzs.toLocaleString()})` : ""}
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* ======================================================== */
                  /* ATTRACTIVE ANIMATED WAITING / RADAR LOADING STATE        */
                  /* ======================================================== */
                  <div className="space-y-6 text-center py-6">
                    {/* Animated Ripple / Radar Wave */}
                    <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                      {/* Radiating concentric pulse rings */}
                      <motion.div
                        animate={{ scale: [1, 1.6, 2], opacity: [0.6, 0.25, 0] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border-2 border-[#00f3ff]/40 bg-[#00f3ff]/5"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.4, 1.8], opacity: [0.8, 0.3, 0] }}
                        transition={{ repeat: Infinity, duration: 2.2, delay: 0.7, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border-2 border-[#9d00ff]/40"
                      />

                      {/* Central Glowing Phone Icon */}
                      <div className="relative z-10 w-20 h-20 bg-gradient-to-tr from-[#00f3ff]/20 to-[#9d00ff]/30 rounded-3xl border border-[#00f3ff]/50 shadow-[0_0_35px_rgba(0,243,255,0.4)] flex items-center justify-center">
                        <Smartphone className="w-9 h-9 text-[#00f3ff] animate-bounce" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
                        </span>
                      </div>
                    </div>

                    {/* Notification Title & Provider Badge */}
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-300">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span>{activeProviderObj.name} • {phoneNumber}</span>
                      </div>
                      <h3 className="text-xl font-black text-white">{t.checkPhoneTitle}</h3>
                      <p className="text-xs text-gray-300 max-w-sm mx-auto leading-relaxed">
                        {t.waitingPin}
                      </p>
                    </div>

                    {/* Dynamic 3-Step Progress Indicators */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left text-xs space-y-3">
                      <div className="flex items-center gap-3 text-green-400">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </div>
                        <span className="font-medium">{t.promptSent}</span>
                      </div>

                      <div className="flex items-center gap-3 text-amber-300 animate-pulse">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold">
                          2
                        </div>
                        <span className="font-medium">{t.waitingInput}</span>
                      </div>

                      <div className="flex items-center gap-3 text-gray-500">
                        <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                          3
                        </div>
                        <span>{t.autoConnect}</span>
                      </div>
                    </div>

                    {/* Moving Laser Progress Bar */}
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden relative">
                      <motion.div
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                        className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#00f3ff] to-transparent shadow-[0_0_10px_#00f3ff]"
                      />
                    </div>

                    {/* Simulation / Cancel Buttons */}
                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSimulatePayment}
                        className="w-full py-3 px-4 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-2"
                      >
                        <Sparkles size={14} />
                        <span>{t.testSim}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setCheckoutData(null); setPolling(false); }}
                        className="text-xs text-gray-400 hover:text-white transition-colors block mx-auto pt-1"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: VOUCHER REDEEM */}
            {activeTab === "voucher" && paymentMode !== "MOBILE_ONLY" && (
              <form onSubmit={handleRedeemVoucher} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                    {t.enterVoucherLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 7A8B9C0D"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      className="w-full bg-[#0a0a1a] border border-white/10 rounded-2xl py-4 text-center text-2xl tracking-[0.3em] font-mono font-black text-[#00f3ff] focus:outline-none focus:border-[#00f3ff] shadow-inner placeholder:text-gray-700"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 text-center">{t.voucherHint}</p>
                </div>

                <button
                  type="submit"
                  disabled={redeemLoading || !voucherCode.trim()}
                  className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-black py-4 rounded-2xl hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/20 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {redeemLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>{t.redeemBtn}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Security Footer */}
        <div className="text-center text-[10px] text-gray-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-green-500" />
          <span>{t.secured}</span>
        </div>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20">Loading PoaFi Portal...</div>}>
      <PortalContent />
    </Suspense>
  );
}
