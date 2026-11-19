"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import {
  Wallet,
  Plus,
  ShieldCheck,
  Building2,
  Smartphone,
  ArrowDownToLine,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function PayoutsPage() {
  const { t } = useLanguage();
  const [balance, setBalance] = useState({ totalEarned: 0, totalWithdrawn: 0, available: 0, feePercent: 3 });
  const [methods, setMethods] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddMethod, setShowAddMethod] = useState(false);
  const [methodType, setMethodType] = useState<"MOBILE" | "BANK">("MOBILE");
  const [provider, setProvider] = useState("Halopesa");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [transferType, setTransferType] = useState("ACH");

  const [verifyingMethodId, setVerifyingMethodId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const loadData = async () => {
    try {
      const [balRes, methodsRes] = await Promise.all([
        apiFetch("/payouts/balance"),
        apiFetch("/payouts"),
      ]);
      setBalance({
        totalEarned: balRes.totalEarned || 0,
        totalWithdrawn: balRes.totalWithdrawn || 0,
        available: balRes.available || 0,
        feePercent: typeof balRes.feePercent === "number" ? balRes.feePercent : 3,
      });
      setMethods(methodsRes.methods || []);
      setWithdrawals(methodsRes.withdrawals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    try {
      const res = await apiFetch("/payouts/methods", {
        method: "POST",
        body: JSON.stringify({
          type: methodType,
          provider,
          accountNumber,
          accountName,
          ...(methodType === "BANK" ? { bankBic, transferType } : {}),
        }),
      });
      if (methodType === "MOBILE") {
        setVerifyingMethodId(res.methodId);
        setActionSuccess(t("Namba ya uthibitisho (OTP) imetumwa! Angalia simu yako.", "OTP sent! Check your phone."));
      } else {
        setActionSuccess(res.message || t("Akaunti ya benki imehifadhiwa na inasubiri uthibitisho.", "Bank account saved and awaiting verification."));
        setShowAddMethod(false);
        setAccountNumber("");
        setAccountName("");
        setBankBic("");
      }
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    try {
      await apiFetch(`/payouts/methods/${verifyingMethodId}/verify`, {
        method: "POST",
        body: JSON.stringify({ otpCode }),
      });
      setActionSuccess(t("Akaunti imethibitishwa kikamilifu!", "Account verified successfully!"));
      setVerifyingMethodId(null);
      setOtpCode("");
      setShowAddMethod(false);
      setAccountNumber("");
      setAccountName("");
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    try {
      await apiFetch("/payouts/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: parseInt(withdrawAmount, 10), payoutMethodId: selectedMethodId }),
      });
      setActionSuccess(t("Ombi la kutoa pesa limewasilishwa kikamilifu!", "Withdrawal requested successfully!"));
      setWithdrawAmount("");
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const verifiedMethods = methods.filter((m) => m.isVerified);
  const parsedWithdraw = parseInt(withdrawAmount || "0", 10) || 0;
  const estFee = balance.feePercent > 0 ? Math.round((parsedWithdraw * balance.feePercent) / 100) : 0;
  const estNet = Math.max(0, parsedWithdraw - estFee);

  if (loading) return <div className="p-8 text-center text-gray-400">{t("Inapakia pochi...", "Loading wallet...")}</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#00f3ff]">
            POAFI PAY · {t("MAPATO", "EARNINGS")}
          </p>
          <h1 className="text-3xl font-bold flex items-center gap-2 mt-0.5">
            <Wallet className="text-[#00f3ff]" /> {t("Mapato & Kutoa Pesa", "Earnings & Payouts")}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t(
              "Malipo yanayokusanywa na PoaFi Pay huonekana hapa. Toa pesa kwenda kwenye laini ya simu au benki muda wowote.",
              "Payments collected via PoaFi Pay land here. Withdraw to a verified mobile money or bank payout method whenever you're ready."
            )}
          </p>
        </div>

        <Link
          href="/payment-gateways"
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00f3ff]/40 text-xs font-semibold text-gray-200 transition-colors"
        >
          <SlidersHorizontal size={14} className="text-[#00f3ff]" />
          <span>{t("Mifumo ya Malipo", "Payment Gateways")}</span>
        </Link>
      </div>

      {actionError && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">{actionError}</div>}
      {actionSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-xl text-sm">{actionSuccess}</div>}

      {/* Top Balance Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="glass-panel p-6 rounded-2xl border-[#00f3ff]/30 bg-[#00f3ff]/5">
          <p className="text-xs text-[#00f3ff] uppercase font-bold">{t("Salio Linaloweza Kutolewa", "Available Balance")}</p>
          <p className="text-2xl font-black text-[#00f3ff] mt-1">TZS {balance.available.toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {balance.feePercent > 0
              ? t(`Makato ya PoaFi: ${balance.feePercent}% kwa kila utoaji`, `PoaFi fee: ${balance.feePercent}% deducted on withdrawal`)
              : t("0% makato ya mfumo (Gateway binafsi)", "0% platform withdrawal fee")}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-panel p-6 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase">{t("Jumla ya Mapato", "Total Collected")}</p>
          <p className="text-2xl font-bold text-white mt-1">TZS {balance.totalEarned.toLocaleString()}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-panel p-6 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase">{t("Pesa Zilizotolewa", "Total Withdrawn")}</p>
          <p className="text-2xl font-bold text-white mt-1">TZS {balance.totalWithdrawn.toLocaleString()}</p>
        </motion.div>
      </div>

      {/* Withdraw + Payout Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <ArrowDownToLine size={18} className="text-[#00f3ff]" />
            {t("Toa Pesa (Withdraw)", "Withdraw")}
          </h2>

          {verifiedMethods.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
              {t(
                "Ongeza na uthibitishe njia ya kupokea pesa (simu au benki) kabla ya kuomba kutoa pesa.",
                "Add and verify a payout method before requesting a withdrawal."
              )}
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="space-y-3">
              <select
                required
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white"
              >
                <option value="">{t("Chagua Njia ya Malipo", "Select Payout Method")}</option>
                {verifiedMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} ({m.type}) — {m.accountNumber}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                min={1000}
                max={balance.available || undefined}
                placeholder={t("Kiasi (TZS)", "Amount (TZS)")}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white"
              />
              {parsedWithdraw > 0 && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>{t("Makato ya mfumo", `Fee (${balance.feePercent}%)`)}</span>
                    <span>TZS {estFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#00f3ff]">
                    <span>{t("Kiasi utakachopokea", "Estimated net payout")}</span>
                    <span>TZS {estNet.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-2.5 rounded-xl text-sm"
              >
                {t("Toa Pesa Sasa", "Withdraw Funds")}
              </button>
            </form>
          )}
        </div>

        {/* Payout Methods */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg text-white">{t("Njia za Kupokea Malipo", "Payout methods")}</h2>
            {!showAddMethod && !verifyingMethodId && (
              <button
                type="button"
                onClick={() => setShowAddMethod(true)}
                className="text-xs font-bold text-[#00f3ff] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00f3ff]/10 border border-[#00f3ff]/20"
              >
                <Plus size={14} /> {t("Ongeza njia", "Add method")}
              </button>
            )}
          </div>

          {showAddMethod && (
            <form onSubmit={handleAddMethod} className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMethodType("MOBILE");
                    setProvider("Halopesa");
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${
                    methodType === "MOBILE"
                      ? "bg-[#00f3ff]/15 border-[#00f3ff] text-[#00f3ff]"
                      : "bg-[#0a0a1a] border-white/10 text-gray-400"
                  }`}
                >
                  <Smartphone size={14} />
                  {t("Laini ya Simu", "Mobile money")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethodType("BANK");
                    setProvider("");
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${
                    methodType === "BANK"
                      ? "bg-[#00f3ff]/15 border-[#00f3ff] text-[#00f3ff]"
                      : "bg-[#0a0a1a] border-white/10 text-gray-400"
                  }`}
                >
                  <Building2 size={14} />
                  {t("Akaunti ya Benki", "Bank account")}
                </button>
              </div>

              {methodType === "MOBILE" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">{t("Mtandao / Lebo", "Network / Label")}</label>
                    <input
                      required
                      list="tz-mobile-networks"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      placeholder="e.g. M-Pesa, Tigo Pesa, Halopesa, Airtel Money"
                      className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                    />
                    <datalist id="tz-mobile-networks">
                      <option value="M-Pesa" />
                      <option value="Tigo Pesa" />
                      <option value="Airtel Money" />
                      <option value="Halopesa" />
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">{t("Namba ya Simu", "Phone number")}</label>
                    <input
                      required
                      placeholder="07XXXXXXXX / 06XXXXXXXX"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                    />
                  </div>
                  <input
                    placeholder={t("Jina lililosajiliwa (Hiari)", "Registered name (Optional)")}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                  />
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    required
                    placeholder={t("Jina la Benki (mf. CRDB, NMB)", "Bank name (e.g. CRDB, NMB)")}
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                  />
                  <input
                    placeholder={t("Bank BIC / SWIFT (mf. CORUTZTZ)", "Bank BIC code (e.g. CORUTZTZ)")}
                    value={bankBic}
                    onChange={(e) => setBankBic(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                  />
                  <select
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="ACH">ACH</option>
                    <option value="EFT">EFT</option>
                    <option value="TISS">TISS</option>
                  </select>
                  <input
                    required
                    placeholder={t("Namba ya Akaunti", "Account number")}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                  />
                  <input
                    required
                    placeholder={t("Jina la Akaunti", "Account name")}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="sm:col-span-2 w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold text-xs py-2.5 rounded-lg"
                >
                  {methodType === "MOBILE"
                    ? t("Tuma OTP & Hifadhi", "Send OTP & Add method")
                    : t("Hifadhi Akaunti ya Benki", "Add bank payout method")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMethod(false)}
                  className="px-3 py-2 bg-white/10 text-gray-300 text-xs rounded-lg"
                >
                  {t("Ghairi", "Cancel")}
                </button>
              </div>
            </form>
          )}

          {verifyingMethodId && (
            <form onSubmit={handleVerify} className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/10">
              <p className="text-xs text-green-400 mb-2">
                {t("Weka kodi ya tarakimu 6 iliyotumwa kwenye simu yako.", "Enter the 6-digit OTP sent to your phone.")}
              </p>
              <input
                required
                placeholder={t("Kodi ya OTP", "OTP Code")}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-center tracking-widest text-lg"
              />
              <button type="submit" className="w-full bg-green-500/20 text-green-300 text-xs font-bold py-2.5 rounded-lg">
                {t("Thibitisha Akaunti", "Verify Account")}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {methods.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                {t("Bado hujaongeza njia ya kupokea pesa.", "No payout methods added yet.")}
              </p>
            ) : (
              methods.map((m) => (
                <div key={m.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{m.provider}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">{m.type}</span>
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {m.accountNumber}
                      {m.accountName ? ` · ${m.accountName}` : ""}
                      {m.bankBic ? ` · BIC ${m.bankBic}` : ""}
                    </p>
                  </div>
                  {m.isVerified ? (
                    <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1">
                      <ShieldCheck size={12} /> {t("Imethibitishwa", "Verified")}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                      {t("Inasubiri Uthibitisho", "Unverified")}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Withdrawals */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
        <h2 className="font-bold text-lg text-white">{t("Miamala ya Kutoa Pesa (Recent withdrawals)", "Recent withdrawals")}</h2>
        {withdrawals.length === 0 ? (
          <p className="text-xs text-gray-500 py-4">
            {t("Hakuna miamala ya kutoa pesa bado.", "No withdrawals yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="py-2.5 pr-4">{t("Tarehe", "Date")}</th>
                  <th className="py-2.5 pr-4">{t("Njia", "Payout Method")}</th>
                  <th className="py-2.5 pr-4">{t("Kiasi", "Amount")}</th>
                  <th className="py-2.5">{t("Hali", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-200">
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="py-3 pr-4 whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      {w.payoutMethod ? `${w.payoutMethod.provider} (${w.payoutMethod.accountNumber})` : "—"}
                    </td>
                    <td className="py-3 pr-4 font-bold text-white">TZS {Number(w.amount).toLocaleString()}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          w.status === "COMPLETED"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : w.status === "FAILED"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {w.status === "COMPLETED" ? <CheckCircle2 size={11} /> : w.status === "FAILED" ? <XCircle size={11} /> : <Clock size={11} />}
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
