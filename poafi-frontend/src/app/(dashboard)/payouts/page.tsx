"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Wallet, Plus, ShieldCheck, ArrowRight } from "lucide-react";

export default function PayoutsPage() {
  const [balance, setBalance] = useState({ totalEarned: 0, totalWithdrawn: 0, available: 0 });
  const [methods, setMethods] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [methodType, setMethodType] = useState("MOBILE");
  const [provider, setProvider] = useState("M-Pesa");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
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
        apiFetch("/payouts")
      ]);
      setBalance(balRes);
      setMethods(methodsRes.methods || []);
      setWithdrawals(methodsRes.withdrawals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(""); setActionSuccess("");
    try {
      const res = await apiFetch("/payouts/methods", {
        method: "POST",
        body: JSON.stringify({ type: methodType, provider, accountNumber, accountName })
      });
      setVerifyingMethodId(res.methodId);
      setActionSuccess("OTP sent! Check your phone.");
    } catch (err: any) { setActionError(err.message); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(""); setActionSuccess("");
    try {
      await apiFetch(`/payouts/methods/${verifyingMethodId}/verify`, {
        method: "POST",
        body: JSON.stringify({ otpCode })
      });
      setActionSuccess("Account verified successfully!");
      setVerifyingMethodId(null);
      setOtpCode("");
      setShowAddMethod(false);
      loadData();
    } catch (err: any) { setActionError(err.message); }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(""); setActionSuccess("");
    try {
      await apiFetch("/payouts/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: parseInt(withdrawAmount), payoutMethodId: selectedMethodId })
      });
      setActionSuccess("Withdrawal requested successfully!");
      setWithdrawAmount("");
      loadData();
    } catch (err: any) { setActionError(err.message); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading wallet...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="text-[#00f3ff]" /> Wallet & Withdrawals
        </h1>
        <p className="text-gray-400 text-sm mt-1">Manage your earnings and withdraw to mobile money or bank.</p>
      </div>

      {actionError && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">{actionError}</div>}
      {actionSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-xl text-sm">{actionSuccess}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-6 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase">Total Earned</p>
          <p className="text-2xl font-bold text-white mt-1">TZS {balance.totalEarned.toLocaleString()}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase">Total Withdrawn</p>
          <p className="text-2xl font-bold text-white mt-1">TZS {balance.totalWithdrawn.toLocaleString()}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border-[#00f3ff]/30 bg-[#00f3ff]/5">
          <p className="text-xs text-[#00f3ff] uppercase font-bold">Available to Withdraw</p>
          <p className="text-2xl font-black text-[#00f3ff] mt-1">TZS {balance.available.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Withdraw Form */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h2 className="font-bold text-lg text-white">Request Withdrawal</h2>
          {methods.length === 0 ? (
            <p className="text-xs text-gray-400">Add a payout method first.</p>
          ) : (
            <form onSubmit={handleWithdraw} className="space-y-3">
              <select required value={selectedMethodId} onChange={e => setSelectedMethodId(e.target.value)} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm text-white">
                <option value="">Select Payout Method</option>
                {methods.filter(m => m.isVerified).map(m => (
                  <option key={m.id} value={m.id}>{m.provider} - {m.accountNumber}</option>
                ))}
              </select>
              <input required type="number" placeholder="Amount (TZS)" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm text-white" />
              <button type="submit" className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-2.5 rounded-lg text-sm">Withdraw Funds</button>
            </form>
          )}
        </div>

        {/* Payout Methods */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg text-white">Payout Methods</h2>
            {!showAddMethod && !verifyingMethodId && (
              <button onClick={() => setShowAddMethod(true)} className="text-xs font-bold text-[#00f3ff] flex items-center gap-1"><Plus size={14}/> Add</button>
            )}
          </div>

          {showAddMethod && (
            <form onSubmit={handleAddMethod} className="space-y-2 bg-white/5 p-3 rounded-lg border border-white/10">
              <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-xs text-white">
                <option>M-Pesa</option><option>Tigo Pesa</option><option>Airtel Money</option><option>Halopesa</option>
              </select>
              <input required placeholder="Phone/Account Number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-xs text-white" />
              <input placeholder="Account Name (Optional)" value={accountName} onChange={e => setAccountName(e.target.value)} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-xs text-white" />
              <button type="submit" className="w-full bg-white/10 text-white text-xs py-2 rounded-lg">Send OTP</button>
            </form>
          )}

          {verifyingMethodId && (
            <form onSubmit={handleVerify} className="space-y-2 bg-white/5 p-3 rounded-lg border border-white/10">
              <p className="text-xs text-green-400 mb-2">Enter the 6-digit OTP sent to your phone.</p>
              <input required placeholder="OTP Code" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-white text-center tracking-widest text-lg" />
              <button type="submit" className="w-full bg-green-500/20 text-green-300 text-xs py-2 rounded-lg">Verify Account</button>
            </form>
          )}

          <div className="space-y-2">
            {methods.map(m => (
              <div key={m.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                <div>
                  <p className="text-sm font-bold text-white">{m.provider}</p>
                  <p className="text-xs text-gray-400 font-mono">{m.accountNumber}</p>
                </div>
                {m.isVerified ? (
                  <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded flex items-center gap-1"><ShieldCheck size={12}/> Verified</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">Unverified</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}