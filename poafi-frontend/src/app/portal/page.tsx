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
  Lock,
  Phone
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

const PROVIDERS = [
  {
    id: "MPESA",
    name: "M-Pesa",
    badge: "Vodacom",
    brandHex: "#E60000",
    activeClass: "bg-[#E60000]/20 border-[#E60000] text-white shadow-[0_0_20px_rgba(230,0,0,0.35)]",
    idleClass: "bg-[#E60000]/5 border-[#E60000]/25 text-gray-200 hover:border-[#E60000]/60 hover:bg-[#E60000]/10",
    buttonGradient: "from-[#E60000] to-[#B30000] shadow-[#E60000]/30",
    pillClass: "bg-[#E60000]/15 border-[#E60000]/40 text-red-200",
  },
  {
    id: "TIGOPESA",
    name: "Tigo Pesa",
    badge: "Tigo",
    brandHex: "#00377B",
    activeClass: "bg-[#00377B]/50 border-[#00AEEF] text-white shadow-[0_0_20px_rgba(0,174,239,0.35)]",
    idleClass: "bg-[#00377B]/20 border-[#00AEEF]/25 text-gray-200 hover:border-[#00AEEF]/60 hover:bg-[#00377B]/35",
    buttonGradient: "from-[#0057B8] to-[#00377B] shadow-[#00AEEF]/30",
    pillClass: "bg-[#00377B]/40 border-[#00AEEF]/40 text-sky-200",
  },
  {
    id: "AIRTEL",
    name: "Airtel Money",
    badge: "Airtel",
    brandHex: "#ED1C24",
    activeClass: "bg-[#ED1C24]/20 border-[#ED1C24] text-white shadow-[0_0_20px_rgba(237,28,36,0.35)]",
    idleClass: "bg-[#ED1C24]/5 border-[#ED1C24]/25 text-gray-200 hover:border-[#ED1C24]/60 hover:bg-[#ED1C24]/10",
    buttonGradient: "from-[#ED1C24] to-[#B80D14] shadow-[#ED1C24]/30",
    pillClass: "bg-[#ED1C24]/15 border-[#ED1C24]/40 text-red-200",
  },
  {
    id: "HALOPESA",
    name: "Halopesa",
    badge: "Halotel",
    brandHex: "#F36F21",
    activeClass: "bg-[#F36F21]/20 border-[#F36F21] text-white shadow-[0_0_20px_rgba(243,111,33,0.35)]",
    idleClass: "bg-[#F36F21]/5 border-[#F36F21]/25 text-gray-200 hover:border-[#F36F21]/60 hover:bg-[#F36F21]/10",
    buttonGradient: "from-[#F36F21] to-[#D9530A] shadow-[#F36F21]/30",
    pillClass: "bg-[#F36F21]/15 border-[#F36F21]/40 text-orange-200",
  },
];

function ProviderLogo({ id, size = 34 }: { id: string; size?: number }) {
  if (id === "MPESA") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-xl shadow-sm" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#E60000" />
        <circle cx="20" cy="20" r="13" fill="#FFFFFF" />
        <path d="M21.5 11.5c-4.7 0-8.2 3.4-8.2 8.1 0 4.5 3.3 7.9 7.8 7.9 4.3 0 7.6-3.2 7.6-7.6 0-2.9-1.6-5.2-4.1-6.2l.8-2.2h-3.9zm-.4 12.2c-2.3 0-4-1.7-4-4.1s1.7-4.1 4-4.1 4 1.7 4 4.1-1.7 4.1-4 4.1z" fill="#E60000" />
      </svg>
    );
  }
  if (id === "TIGOPESA") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-xl shadow-sm" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#00377B" />
        <circle cx="14" cy="15" r="2.6" fill="#FFD100" />
        <circle cx="26" cy="15" r="2.6" fill="#FFD100" />
        <path d="M11 22c2.2 4.5 6.1 6.5 9 6.5s6.8-2 9-6.5" fill="none" stroke="#FFD100" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "AIRTEL") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-xl shadow-sm" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#ED1C24" />
        <path d="M26.8 25.5c-2.6 2.3-7.7 3.8-12 2.2-3.4-1.3-4.6-4.7-2.6-7.4 2.2-2.9 7.5-4.3 11.6-6.9 1.9-1.2 2.9-2.8 2.6-4.4 2.5 2.1 3.7 5.5 2.4 8.7-1.1 2.7-4.5 4.4-8.2 5.4-2.1.6-3.7 1.3-3.5 2.5.2 1.2 2.3 1.7 5 .9 1.9-.5 3.6-1.4 4.7-1z" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0 rounded-xl shadow-sm" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#F36F21" />
      <path d="M12 11v18M28 11v18M12 20h16" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="20" cy="12.5" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

function formatPackageDuration(mins: number, lang: "sw" | "en"): string {
  if (mins >= 1440) {
    const days = Math.round(mins / 1440);
    return `${days} ${lang === "sw" ? "Siku" : "Days"}`;
  }
  if (mins >= 60) {
    const hrs = Number((mins / 60).toFixed(1));
    return `${hrs} ${lang === "sw" ? "Saa" : "Hrs"}`;
  }
  return `${mins} ${lang === "sw" ? "Dakika" : "Min"}`;
}

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
  const qrVoucherParam = searchParams.get("voucher") || searchParams.get("code") || "";

  const { lang, setLang } = useLanguage();
  const [paymentMode, setPaymentMode] = useState<"MOBILE_ONLY" | "VOUCHER_ONLY" | "MIXED">("MIXED");
  const [activeTab, setActiveTab] = useState<"buy" | "voucher">("buy");
  const [packages, setPackages] = useState<any[]>([]);
  const [claimedOfferIds, setClaimedOfferIds] = useState<string[]>([]);
  const [claimingOfferId, setClaimingOfferId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [operatorName, setOperatorName] = useState("PoaFi Hotspot");
  const [branding, setBranding] = useState<{
    logoUrl: string | null;
    primaryColor: string;
    tagline: string | null;
    supportPhone: string | null;
  }>({ logoUrl: null, primaryColor: "#00f3ff", tagline: null, supportPhone: null });
  const [logoError, setLogoError] = useState(false);
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
    if (qrVoucherParam && qrVoucherParam.trim()) {
      setVoucherCode(qrVoucherParam.trim().toUpperCase());
      setActiveTab("voucher");
    }
  }, [qrVoucherParam]);

  useEffect(() => {
    let localDevId = "";
    try {
      localDevId = localStorage.getItem("poafi_device_id") || "";
      if (!localDevId) {
        localDevId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("poafi_device_id", localDevId);
      }
      setDeviceId(localDevId);
    } catch {
      // ignore storage errors
    }

    async function loadPackages() {
      try {
        setLoadingPackages(true);
        const query = localDevId ? `?deviceId=${encodeURIComponent(localDevId)}` : "";
        const res = await apiFetch(`/packages/public/${tenantSlug}${query}`);
        const loadedPackages = res.packages || [];
        setPackages(loadedPackages);

        let localClaimed: string[] = [];
        try {
          localClaimed = JSON.parse(localStorage.getItem(`poafi_claimed_${tenantSlug}`) || "[]");
        } catch {
          localClaimed = [];
        }
        setClaimedOfferIds(Array.from(new Set([...(res.claimedOfferIds || []), ...localClaimed])));

        if (res.operator) setOperatorName(res.operator);
        if (res.branding) {
          setBranding({
            logoUrl: res.branding.logoUrl || null,
            primaryColor: res.branding.primaryColor || "#00f3ff",
            tagline: res.branding.tagline || null,
            supportPhone: res.branding.supportPhone || null,
          });
          setLogoError(false);
        }
        if (res.paymentMode) {
          setPaymentMode(res.paymentMode);
          if (res.paymentMode === "VOUCHER_ONLY") setActiveTab("voucher");
          else if (res.paymentMode === "MOBILE_ONLY") setActiveTab("buy");
          else if (qrVoucherParam && qrVoucherParam.trim()) setActiveTab("voucher");
        }
        const paidPackages = loadedPackages.filter(
          (p: any) => !(p.isOffer && p.offerType === "FIRST_TIME_FREE" && Number(p.priceTzs) === 0)
        );
        if (paidPackages.length > 0) {
          setSelectedPackageId(paidPackages[0].id);
        } else if (loadedPackages.length > 0) {
          setSelectedPackageId(loadedPackages[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load packages:", err);
      } finally {
        setLoadingPackages(false);
      }
    }
    loadPackages();
  }, [tenantSlug]);

  const handleClaimFreeOffer = async (pkg: any) => {
    setError("");
    setClaimingOfferId(pkg.id);
    try {
      const res = await apiFetch("/portal/claim-offer", {
        method: "POST",
        body: JSON.stringify({
          tenantSlug,
          packageId: pkg.id,
          deviceId: deviceId || undefined,
        }),
      });
      const updatedClaims = Array.from(new Set([...claimedOfferIds, pkg.id]));
      setClaimedOfferIds(updatedClaims);
      try {
        localStorage.setItem(`poafi_claimed_${tenantSlug}`, JSON.stringify(updatedClaims));
      } catch {
        // ignore storage errors
      }
      setPaymentStatus({
        status: "SUCCESS",
        voucherCode: res.voucherCode,
        accessMode: res.requiresDeviceLogin ? "RADIUS" : "NATIVE",
        durationMinutes: res.durationMinutes || pkg.durationMinutes,
      });
    } catch (err: any) {
      if (String(err.message || "").toLowerCase().includes("already claimed")) {
        const updatedClaims = Array.from(new Set([...claimedOfferIds, pkg.id]));
        setClaimedOfferIds(updatedClaims);
        try {
          localStorage.setItem(`poafi_claimed_${tenantSlug}`, JSON.stringify(updatedClaims));
        } catch {
          // ignore
        }
      }
      setError(
        err.message ||
          (lang === "sw" ? "Imeshindikana kuwasha ofa ya bure." : "Failed to claim free offer.")
      );
    } finally {
      setClaimingOfferId(null);
    }
  };

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
      setError(err.message || (lang === "sw" ? "Imeshindikana kuanzisha malipo" : "Failed to initiate payment"));
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
      setError(err.message || (lang === "sw" ? "Vocha si sahihi" : "Invalid voucher code"));
    } finally {
      setRedeemLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const freeOffers = packages.filter(
    (p) => p.isOffer && p.offerType === "FIRST_TIME_FREE" && Number(p.priceTzs) === 0
  );
  const purchasablePackages = packages.filter(
    (p) => !(p.isOffer && p.offerType === "FIRST_TIME_FREE" && Number(p.priceTzs) === 0)
  );
  const selectedPkg = purchasablePackages.find((p) => p.id === selectedPackageId);
  const activeProviderObj = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];
  const isRadiusMode = paymentStatus?.accessMode === "RADIUS" || redeemSuccess?.requiresDeviceLogin === true;
  const hasSuccess = Boolean(paymentStatus || redeemSuccess);
  const displayCode = paymentStatus?.voucherCode || voucherCode;

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-[#050510] text-white relative overflow-hidden">
      {/* Background Ambient Cyber Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#00f3ff]/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#9d00ff]/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="w-full max-w-lg space-y-5 sm:space-y-6 relative z-10">
        {/* Language & Network Header */}
        <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Radio size={14} className="text-[#00f3ff] animate-pulse" />
            <span className="font-mono text-[11px]">{lang === "sw" ? "HOTSPOT IKO HEWANI" : "HOTSPOT ONLINE"}</span>
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
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border relative overflow-hidden"
            style={{
              backgroundColor: `${branding.primaryColor}20`,
              borderColor: `${branding.primaryColor}66`,
              boxShadow: `0 0 30px ${branding.primaryColor}40`,
            }}
          >
            {branding.logoUrl && !logoError ? (
              <img
                src={branding.logoUrl}
                alt={operatorName}
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain p-1.5"
              />
            ) : (
              <Wifi className="w-8 h-8" style={{ color: branding.primaryColor }} />
            )}
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#050510] animate-ping" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#050510]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">{operatorName}</h1>
          <p className="text-xs text-gray-400">
            {branding.tagline ? (
              <span className="font-medium text-gray-200">{branding.tagline}</span>
            ) : (
              <>
                {t.welcome}{" "}
                <span className="font-bold" style={{ color: branding.primaryColor }}>
                  {operatorName}
                </span>{" "}
                • {t.speed}
              </>
            )}
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
                    <Lock size={14} /> {lang === "sw" ? "Kuingia Kwenye Kifaa" : "Device Sign-In"}
                  </p>
                  <p className="text-[11px] text-gray-300">
                    {lang === "sw"
                      ? "Fungua ukurasa wa kuingia wa simu yako kwenye Wi-Fi hii na uweke kodi hiyo ya tarakimu 8."
                      : "Open your device's Wi-Fi sign-in prompt and enter this 8-character voucher code."}
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
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="glass-panel p-6 space-y-6 rounded-3xl border border-white/10 shadow-2xl"
          >
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

            <AnimatePresence mode="wait">
            {/* TAB 1: BUY VIA MOBILE MONEY */}
            {activeTab === "buy" && paymentMode !== "VOUCHER_ONLY" && (
              <motion.div
                key="tab-buy"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.22 }}
              >
                {!checkoutData ? (
                  <form onSubmit={handleCheckout} className="space-y-5">
                    {/* Free First-Time Offer(s) */}
                    {!loadingPackages && freeOffers.length > 0 && (
                      <div className="space-y-2.5">
                        {freeOffers.map((offer) => {
                          const alreadyClaimed = claimedOfferIds.includes(offer.id);
                          return (
                            <motion.div
                              key={offer.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-4 rounded-2xl border transition-all ${
                                alreadyClaimed
                                  ? "bg-white/5 border-white/10 opacity-70"
                                  : "bg-gradient-to-r from-emerald-500/20 via-[#00f3ff]/10 to-transparent border-emerald-400/50 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 mb-1.5">
                                    <Sparkles size={10} />
                                    {lang === "sw" ? "OFA YA BURE MARA YA KWANZA" : "FREE FIRST-TIME OFFER"}
                                  </span>
                                  <p className="font-black text-base text-white">{offer.name}</p>
                                  <p className="text-xs text-gray-300 mt-0.5 flex items-center gap-1.5">
                                    <Clock size={12} className="text-emerald-400" />
                                    <span>
                                      {formatPackageDuration(offer.durationMinutes, lang)} •{" "}
                                      {lang === "sw"
                                        ? "Bure siku ya kwanza tu (mara moja)"
                                        : "Free once on your first visit"}
                                    </span>
                                  </p>
                                </div>
                                <motion.button
                                  whileHover={alreadyClaimed ? undefined : { scale: 1.03 }}
                                  whileTap={alreadyClaimed ? undefined : { scale: 0.97 }}
                                  type="button"
                                  disabled={alreadyClaimed || claimingOfferId === offer.id}
                                  onClick={() => handleClaimFreeOffer(offer)}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-black shrink-0 transition-all ${
                                    alreadyClaimed
                                      ? "bg-white/10 text-gray-400 cursor-not-allowed"
                                      : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:opacity-95"
                                  }`}
                                >
                                  {claimingOfferId === offer.id
                                    ? lang === "sw"
                                      ? "Inawasha..."
                                      : "Activating..."
                                    : alreadyClaimed
                                      ? lang === "sw"
                                        ? "Imeshatumika"
                                        : "Already Claimed"
                                      : lang === "sw"
                                        ? "Pata Bure Sasa"
                                        : "Claim Free Wi-Fi"}
                                </motion.button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Step 1: Packages */}
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                        {t.step1}
                      </label>
                      {loadingPackages ? (
                        <div className="text-xs text-gray-400 p-4 text-center">
                          {lang === "sw" ? "Inapakia vifurushi..." : "Loading packages..."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {purchasablePackages.map((pkg, idx) => (
                            <motion.button
                              key={pkg.id}
                              type="button"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.04 }}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedPackageId(pkg.id)}
                              className={`p-3.5 rounded-2xl text-left border transition-all relative overflow-hidden ${
                                selectedPackageId === pkg.id
                                  ? "bg-[#00f3ff]/15 border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                                  : pkg.isOffer
                                    ? "bg-amber-500/10 border-amber-400/40 hover:border-amber-400/70"
                                    : "bg-white/5 border-white/10 hover:border-white/20"
                              }`}
                            >
                              {pkg.isOffer && (
                                <span className="inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-1">
                                  {pkg.offerType === "HAPPY_HOUR"
                                    ? "HAPPY HOUR"
                                    : lang === "sw"
                                      ? "OFA"
                                      : "PROMO"}
                                </span>
                              )}
                              <p className="font-black text-sm text-white">{pkg.name}</p>
                              <div className="flex items-baseline gap-1.5 mt-1">
                                <p className="text-xs text-[#00f3ff] font-bold">
                                  TZS {pkg.priceTzs.toLocaleString()}
                                </p>
                                {pkg.isOffer && pkg.originalPriceTzs && pkg.originalPriceTzs > pkg.priceTzs && (
                                  <p className="text-[10px] text-gray-500 line-through">
                                    {pkg.originalPriceTzs.toLocaleString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                                <Clock size={10} />
                                <span>{formatPackageDuration(pkg.durationMinutes, lang)}</span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 2: Providers */}
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                        {t.step2}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {PROVIDERS.map((prov, idx) => {
                          const isSelected = selectedProvider === prov.id;
                          return (
                            <motion.button
                              key={prov.id}
                              type="button"
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: idx * 0.04 }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setSelectedProvider(prov.id)}
                              className={`p-3 rounded-xl border-2 text-xs font-bold flex items-center gap-2.5 transition-all text-left ${
                                isSelected ? prov.activeClass : prov.idleClass
                              }`}
                            >
                              <ProviderLogo id={prov.id} size={34} />
                              <div className="min-w-0 flex-1">
                                <p className="font-extrabold text-white truncate leading-tight">{prov.name}</p>
                                <p className="text-[10px] opacity-80 uppercase font-mono">{prov.badge}</p>
                              </div>
                            </motion.button>
                          );
                        })}
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

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={checkoutLoading || !selectedPackageId}
                      className={`w-full bg-gradient-to-r ${activeProviderObj.buttonGradient} text-white font-black py-4 rounded-2xl hover:opacity-95 transition-all shadow-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2`}
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
                    </motion.button>
                  </form>
                ) : (
                  /* ======================================================== */
                  /* ATTRACTIVE ANIMATED WAITING / RADAR LOADING STATE        */
                  /* ======================================================== */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6 text-center py-6"
                  >
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
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${activeProviderObj.pillClass}`}>
                        <ProviderLogo id={activeProviderObj.id} size={20} />
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
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* TAB 2: VOUCHER REDEEM */}
            {activeTab === "voucher" && paymentMode !== "MOBILE_ONLY" && (
              <motion.form
                key="tab-voucher"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                onSubmit={handleRedeemVoucher}
                className="space-y-5"
              >
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

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
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
                </motion.button>
              </motion.form>
            )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Security Footer */}
        <div className="text-center text-[10px] text-gray-500 space-y-1.5">
          {branding.supportPhone && (
            <div>
              <a
                href={`tel:${branding.supportPhone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                style={{ color: branding.primaryColor }}
              >
                <Phone size={12} />
                <span>
                  {lang === "sw" ? "Msaada wa Mwendeshaji:" : "Support:"} {branding.supportPhone}
                </span>
              </a>
            </div>
          )}
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-green-500" />
            <span>{t.secured}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalFallback() {
  const { t } = useLanguage();
  return <div className="text-white text-center mt-20">{t("Inapakia Portal ya PoaFi...", "Loading PoaFi Portal...")}</div>;
}

export default function PortalPage() {
  return (
    <Suspense fallback={<PortalFallback />}>
      <PortalContent />
    </Suspense>
  );
}
