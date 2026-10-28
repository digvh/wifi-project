"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { CreditCard, TrendingUp, CheckCircle, Clock, XCircle, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function BillingPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalRevenueTzs: 0, totalTransactions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configData, setConfigData] = useState({
    tenantId: user?.tenantId || "",
    provider: "AZAMPAY",
    appName: "",
    clientId: "",
    apiKey: "",
    clientSecret: "",
    isLive: false,
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        ...(statusFilter && { status: statusFilter }),
      });
      const data = await apiFetch(`/payments?${query.toString()}`);
      setPayments(data.payments || []);
      setSummary(data.summary || { totalRevenueTzs: 0, totalTransactions: 0 });
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, statusFilter]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiFetch("/payments/config", {
        method: "POST",
        body: JSON.stringify({
          ...configData,
          tenantId: configData.tenantId || user?.tenantId,
        }),
      });
      setSuccess("Payment gateway credentials saved securely!");
      setShowConfigModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CreditCard className="text-[#00f3ff]" /> System Billing & Mobile Money
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time automated revenue collection via M-Pesa, Tigo Pesa, Airtel Money, Halopesa & Cards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="bg-white/10 hover:bg-white/15 text-white text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 border border-white/10 transition-colors"
          >
            <Settings size={16} /> Gateway Settings
          </button>
          <button
            onClick={fetchPayments}
            className="bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 border border-[#00f3ff]/20 transition-colors"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
      {success && <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">{success}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>Total Collected</span>
            <TrendingUp size={18} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            TZS {summary.totalRevenueTzs.toLocaleString()}
          </p>
          <p className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
            <ShieldCheck size={12} /> 100% Mobile Money
          </p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>{user?.role === "PLATFORM_ADMIN" ? "Operator Payouts (90%)" : "Your Net Payout (90%)"}</span>
            <CreditCard size={18} className="text-[#00f3ff]" />
          </div>
          <p className="text-2xl font-bold text-[#00f3ff] font-mono">
            TZS {Math.round(summary.totalRevenueTzs * 0.9).toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Disbursable to bank / M-Pesa</p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>{user?.role === "PLATFORM_ADMIN" ? "Platform Revenue (10%)" : "Platform Fee (10%)"}</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">10%</span>
          </div>
          <p className="text-2xl font-bold text-purple-400 font-mono">
            TZS {Math.round(summary.totalRevenueTzs * 0.1).toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Platform management fee</p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>Total Transactions</span>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-mono">Count</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {summary.totalTransactions}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Paid mobile vouchers</p>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-lg font-semibold">Payment Transactions</h2>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="PENDING">Pending Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">Loading payments...</p>
        ) : payments.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">No transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Customer Phone</th>
                  <th className="p-3">Package</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payments.map((p) => {
                  const isSuccess = p.status === "SUCCESS";
                  const isPending = p.status === "PENDING";
                  return (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="p-3 font-mono text-xs text-[#00f3ff]">{p.reference}</td>
                      <td className="p-3 font-mono text-white">{p.phoneNumber}</td>
                      <td className="p-3 text-gray-300">{p.package?.name || "Standard Wi-Fi"}</td>
                      <td className="p-3">
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-mono">
                          {p.provider}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-white">
                        TZS {p.amount.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-medium ${
                            isSuccess
                              ? "bg-green-500/20 text-green-400"
                              : isPending
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {isSuccess && <CheckCircle size={12} />}
                          {isPending && <Clock size={12} />}
                          {!isSuccess && !isPending && <XCircle size={12} />}
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-white/5 text-xs text-gray-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gateway Settings Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings size={20} className="text-[#00f3ff]" /> AzamPay Gateway Integration
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-gray-400">
              Aggregates Vodacom M-Pesa, Tigo Pesa, Airtel Money, and Halopesa into a single automated payment engine.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">App Name</label>
                <input
                  type="text"
                  placeholder="e.g. POAFI_WIFI"
                  value={configData.appName}
                  onChange={(e) => setConfigData({ ...configData, appName: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Client ID</label>
                <input
                  type="text"
                  placeholder="AzamPay Client ID"
                  value={configData.clientId}
                  onChange={(e) => setConfigData({ ...configData, clientId: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                <input
                  type="password"
                  placeholder="AzamPay API Key (Encrypted in DB)"
                  value={configData.apiKey}
                  onChange={(e) => setConfigData({ ...configData, apiKey: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Client Secret</label>
                <input
                  type="password"
                  placeholder="Client Secret (Encrypted in DB)"
                  value={configData.clientSecret}
                  onChange={(e) => setConfigData({ ...configData, clientSecret: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isLive"
                  checked={configData.isLive}
                  onChange={(e) => setConfigData({ ...configData, isLive: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isLive" className="text-xs text-gray-300">
                  Live Mode (Checked = Production, Unchecked = Sandbox / Simulated Testing)
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs py-2.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold text-xs py-2.5 rounded-lg"
                >
                  Save Gateway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

