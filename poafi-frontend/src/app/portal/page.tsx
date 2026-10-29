"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Wifi,
  KeyRound,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Globe,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const PROVIDERS = [
  { id: "MPESA", name: "M-Pesa", color: "from-red-600 to-red-700", badge: "Vodacom" },
  { id: "TIGOPESA", name: "Tigo Pesa", color: "from-blue-600 to-blue-700", badge: "Tigo" },
  { id: "AIRTEL", name: "Airtel Money", color: "from-red-500 to-red-600", badge: "Airtel" },
  { id: "HALOPESA", name: "Halopesa", color: "from-orange-500 to-orange-600", badge: "Halotel" },
];

const I18N = {
  sw: {
    welcome: "Karibu kwenye mtandao wa",
    speed: "Intaneti ya Kasi ya Juu",
    buyTab: "Nunua kwa Simu",
    voucherTab: "Weka Vocha",
    step1: "1. Chagua Kifurushi",
    step2: "2. Chagua Mtandao wa Malipo",
    step3: "3. Nambari Yako ya Simu",
    phonePlaceholder: "Mfano: 0754 123 456",
    phoneHint: "Ombi la malipo (USSD PIN prompt) litatumwa moja kwa moja kwenye simu yako.",
    payBtn: "Lipia & Unganisha",
    enterVoucherLabel: "Weka Nambari ya Vocha ya Wi-Fi",
    voucherHint: "Weka nambari ya tarakimu 8 kutoka kwenye kadi yako ya vocha.",
    redeemBtn: "Thibitisha & Unganisha",
    checkPhoneTitle: "Angalia Simu Yako",
    waitingPin: "Inasubiri uthibitishe kwa PIN kwenye simu yako...",
    connectedTitle: "🎉 Umeunganishwa!",
    connectedSub: "Umefanikiwa kuanzisha kifurushi chako cha intaneti.",
    voucherCodeLabel: "Kodi Yako ya Vocha",
    startBrowsing: "Anza Kutumia Intaneti",
    cancel: "← Ghairi na chagua kifurushi kingine",
    secured: "Imelindwa na PoaFi Wi-Fi Core",
    testSim: "⚡ Jaribio: Thibitisha Malipo (Bila Makato)",
  },
  en: {
    welcome: "Welcome to",
    speed: "High-Speed Wi-Fi Network",
    buyTab: "Mobile Money",
    voucherTab: "Enter Voucher",
    step1: "1. Choose Package",
    step2: "2. Select Payment Network",
    step3: "3. Mobile Phone Number",
    phonePlaceholder: "e.g. 0754 123 456",
    phoneHint: "A payment prompt (USSD) will be sent directly to your phone.",
    payBtn: "Pay & Connect",
    enterVoucherLabel: "Enter Wi-Fi Voucher Code",
    voucherHint: "Enter the 8-character voucher code from your printed scratch card.",
    redeemBtn: "Redeem & Connect",
    checkPhoneTitle: "Check Your Phone",
    waitingPin: "Waiting for your PIN confirmation...",
    connectedTitle: "🎉 Connected!",
    connectedSub: "Your Wi-Fi access has been activated on the network gateway.",
    voucherCodeLabel: "Your Voucher Code",
    startBrowsing: "Start Browsing",
    cancel: "← Cancel and choose different package",
    secured: "Secured by PoaFi Wi-Fi Core",
    testSim: "⚡ Test Lab: Simulate PIN Entry",
  },
};

function PortalContent() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant") || "Tanga";

  const [lang, setLang] = useState<"sw" | "en">("sw");
  const [activeTab, setActiveTab] = useState<"buy" | "voucher">("buy");
  const [packages, setPackages] = useState<any[]>([]);
  const [operatorName, setOperatorName] = useState(tenantSlug);
  const [loadingPackages, setLoadingPackages] = useState(true);

  // Buy flow state
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("MPESA");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  // Voucher redeem state
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<any>(null);

  const [error, setError] = useState("");

  const t = I18N[lang];

  useEffect(() => {
    async function loadPackages() {
      try {
        setLoadingPackages(true);
        const res = await apiFetch(`/packages/public/${tenantSlug}`);
        setPackages(res.packages || []);
        if (res.operator) setOperatorName(res.operator);
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
      setError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    if (!polling || !checkoutData?.paymentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/payments/${checkoutData.paymentId}/status`, {
          headers: { "x-payment-access-token": checkoutData.statusToken },
        });
        if (res.status === "SUCCESS") {
          setPaymentStatus(res);
          setPolling(false);
          clearInterval(interval);
        } else if (res.status === "FAILED") {
          setError(
            lang === "sw"
              ? "Malipo yameshindikana au yalikataliwa."
              : "Payment transaction was declined or cancelled."
          );
          setPolling(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [polling, checkoutData, lang]);

  const handleSimulatePayment = async () => {
    if (!checkoutData?.paymentId) return;
    try {
      const res = await apiFetch(`/payments/${checkoutData.paymentId}/simulate-confirm`, {
        method: "POST",
      });
      setPaymentStatus({
        ...checkoutData,
        status: "SUCCESS",
        voucherCode: res.voucherCode,
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
        body: JSON.stringify({
          code: voucherCode.trim().toUpperCase(),
          tenantSlug,
        }),
      });

      setRedeemSuccess(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRedeemLoading(false);
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050510] text-white">
      <div className="w-full max-w-lg space-y-6">
        {/* Language Switcher Bar */}
        <div className="flex justify-end items-center gap-2 text-xs">
          <Globe size={14} className="text-gray-400" />
          <button
            onClick={() => setLang("sw")}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              lang === "sw" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            🇹🇿 Kiswahili
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              lang === "en" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            🇬🇧 English
          </button>
        </div>

        {/* Network Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#00f3ff]/20 rounded-2xl flex items-center justify-center mx-auto border border-[#00f3ff]/30 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
            <Wifi className="w-8 h-8 text-[#00f3ff]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            PoaFi <span className="text-[#00f3ff]">Hotspot</span>
          </h1>
          <p className="text-xs text-gray-400">
            {t.welcome} <span className="text-white font-semibold">{operatorName}</span> {t.speed}
          </p>
        </div>

        {/* Success Screen */}
        {(paymentStatus || redeemSuccess) && (
          <div className="glass-panel p-8 text-center space-y-4 border-green-500/30 bg-green-500/10">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-2xl font-bold text-white">{t.connectedTitle}</h2>
            <p className="text-sm text-gray-300">{t.connectedSub}</p>

            {(paymentStatus?.voucherCode || redeemSuccess?.packageName) && (
              <div className="bg-black/40 p-4 rounded-xl border border-white/10 space-y-1">
                <span className="text-xs text-gray-400 uppercase tracking-wider">{t.voucherCodeLabel}</span>
                <p className="text-2xl font-mono font-bold text-[#00f3ff] tracking-widest">
                  {paymentStatus?.voucherCode || voucherCode}
                </p>
                <p className="text-xs text-gray-400">
                  {paymentStatus?.durationMinutes || redeemSuccess?.durationMinutes} minutes
                </p>
              </div>
            )}

            <a
              href="https://www.google.com"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg hover:opacity-95 transition-opacity"
            >
              {t.startBrowsing} <ArrowRight size={18} />
            </a>
          </div>
        )}

        {/* Normal Portal Form */}
        {!paymentStatus && !redeemSuccess && (
          <div className="glass-panel p-6 space-y-6">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => { setActiveTab("buy"); setError(""); }}
                className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === "buy"
                    ? "bg-[#00f3ff] text-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Smartphone size={16} /> {t.buyTab}
              </button>
              <button
                onClick={() => { setActiveTab("voucher"); setError(""); }}
                className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === "voucher"
                    ? "bg-[#00f3ff] text-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <KeyRound size={16} /> {t.voucherTab}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs text-center">
                {error}
              </div>
            )}

            {/* Tab 1: Buy with Mobile Money */}
            {activeTab === "buy" && (
              <div>
                {!checkoutData ? (
                  <form onSubmit={handleCheckout} className="space-y-5">
                    {/* Packages */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        {t.step1}
                      </label>
                      {loadingPackages ? (
                        <div className="p-4 text-center text-xs text-gray-400">Loading...</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {packages.map((pkg) => {
                            const isSelected = selectedPackageId === pkg.id;
                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => setSelectedPackageId(pkg.id)}
                                className={`p-3.5 rounded-xl text-left border transition-all ${
                                  isSelected
                                    ? "bg-[#00f3ff]/10 border-[#00f3ff] text-white shadow-[0_0_15px_rgba(0,243,255,0.15)]"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                }`}
                              >
                                <p className="font-bold text-sm text-white">{pkg.name}</p>
                                <p className="text-xs text-[#00f3ff] font-semibold mt-1">
                                  TZS {pkg.priceTzs.toLocaleString()}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {pkg.durationMinutes >= 1440
                                    ? `${Math.round(pkg.durationMinutes / 1440)} Day(s)`
                                    : `${Math.round(pkg.durationMinutes / 60)} Hour(s)`}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Providers */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        {t.step2}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {PROVIDERS.map((prov) => {
                          const isSelected = selectedProvider === prov.id;
                          return (
                            <button
                              key={prov.id}
                              type="button"
                              onClick={() => setSelectedProvider(prov.id)}
                              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                                isSelected
                                  ? "bg-white/15 border-white text-white shadow-md"
                                  : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                              }`}
                            >
                              <span>{prov.name}</span>
                              <span className="text-[10px] font-mono opacity-60">{prov.badge}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        {t.step3}
                      </label>
                      <div className="relative">
                        <Smartphone className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-500" />
                        <input
                          type="tel"
                          placeholder={t.phonePlaceholder}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white font-mono text-base focus:border-[#00f3ff] outline-none"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">{t.phoneHint}</p>
                    </div>

                    <button
                      type="submit"
                      disabled={checkoutLoading || !selectedPackageId}
                      className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-base shadow-lg flex items-center justify-center gap-2"
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={20} /> ...
                        </>
                      ) : (
                        `${t.payBtn} (TZS ${selectedPkg ? selectedPkg.priceTzs.toLocaleString() : ""})`
                      )}
                    </button>
                  </form>
                ) : (
                  /* Waiting for PIN */
                  <div className="space-y-6 text-center py-4">
                    <div className="relative w-16 h-16 mx-auto">
                      <div className="absolute inset-0 rounded-full border-4 border-[#00f3ff]/20 animate-ping" />
                      <div className="relative w-16 h-16 rounded-full bg-[#00f3ff]/10 border-2 border-[#00f3ff] flex items-center justify-center text-[#00f3ff]">
                        <Smartphone size={28} />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold">{t.checkPhoneTitle}</h3>
                      <p className="text-xs text-gray-300 mt-2 max-w-sm mx-auto">
                        {checkoutData.message}
                      </p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 font-mono text-xs space-y-1">
                      <p className="text-gray-400">Ref: <span className="text-[#00f3ff]">{checkoutData.reference}</span></p>
                      <p className="text-gray-400">Amount: <span className="text-white font-bold">TZS {checkoutData.amount?.toLocaleString()}</span></p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                      <Loader2 className="animate-spin text-[#00f3ff]" size={16} /> {t.waitingPin}
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleSimulatePayment}
                        className="text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-4 py-2 rounded-lg transition-colors"
                      >
                        {t.testSim}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setCheckoutData(null); setPolling(false); }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      {t.cancel}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Redeem Voucher */}
            {activeTab === "voucher" && (
              <form onSubmit={handleRedeemVoucher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    {t.enterVoucherLabel}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-4 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="e.g. 7A8B9C0D"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-center text-xl tracking-widest font-mono focus:border-[#00f3ff] outline-none"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 text-center">{t.voucherHint}</p>
                </div>

                <button
                  type="submit"
                  disabled={redeemLoading || !voucherCode.trim()}
                  className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-base shadow-lg"
                >
                  {redeemLoading ? "..." : t.redeemBtn}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="text-center text-[10px] text-gray-500 flex items-center justify-center gap-1">
          <ShieldCheck size={14} className="text-green-500" /> {t.secured}
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

