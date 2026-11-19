"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { CreditCard, TrendingUp, CheckCircle, Clock, XCircle, RefreshCw, Settings, ShieldCheck, Download, Printer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function BillingPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
      setSuccess(t("Taarifa za malipo zimehifadhiwa kwa usalama!", "Payment gateway credentials saved securely!"));
      setShowConfigModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const escapeCsvCell = (val: unknown): string => {
    const str = String(val ?? "");
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const handleExportCsv = () => {
    if (payments.length === 0) return;
    const headers = [
      t("Kumbukumbu", "Reference"),
      t("Simu ya Mteja", "Customer Phone"),
      t("Kifurushi", "Package"),
      t("Mtandao", "Provider"),
      t("Kiasi (TZS)", "Amount (TZS)"),
      t("Gawio 90% (TZS)", "Operator Net 90% (TZS)"),
      t("Ada 10% (TZS)", "Platform Fee 10% (TZS)"),
      t("Hali", "Status"),
      t("Tarehe", "Created At"),
    ];
    const rows = payments.map((p) => [
      p.reference,
      p.phoneNumber,
      p.package?.name || t("Wi-Fi ya Kawaida", "Standard Wi-Fi"),
      p.provider,
      p.amount,
      Math.round(Number(p.amount) * 0.9),
      Math.round(Number(p.amount) * 0.1),
      p.status,
      new Date(p.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poafi-billing-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CreditCard className="text-[#00f3ff]" /> {t("Malipo na Miamala ya Simu", "System Billing & Mobile Money")}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t("Ukusanyaji wa mapato papo hapo kupitia M-Pesa, Tigo Pesa, Airtel Money na Halopesa.", "Real-time automated revenue collection via M-Pesa, Tigo Pesa, Airtel Money, Halopesa & Cards.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 print:hidden">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={payments.length === 0}
            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 border border-emerald-500/30 transition-colors disabled:opacity-40"
          >
            <Download size={15} /> {t("Pakua CSV", "Export CSV")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/15 text-white text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 border border-white/10 transition-colors"
          >
            <Printer size={15} /> {t("Chapisha / PDF", "Print / PDF")}
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="bg-white/10 hover:bg-white/15 text-white text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 border border-white/10 transition-colors"
          >
            <Settings size={16} /> {t("Mipangilio ya Malipo", "Gateway Settings")}
          </button>
          <button
            onClick={fetchPayments}
            className="bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 border border-[#00f3ff]/20 transition-colors"
          >
            <RefreshCw size={16} /> {t("Sasisha", "Refresh")}
          </button>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
      {success && <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">{success}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>{t("Jumla Iliyokusanywa", "Total Collected")}</span>
            <TrendingUp size={18} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            TZS {summary.totalRevenueTzs.toLocaleString()}
          </p>
          <p className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
            <ShieldCheck size={12} /> {t("100% Malipo ya Simu", "100% Mobile Money")}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>{user?.role === "PLATFORM_ADMIN" ? t("Malipo kwa Waendeshaji (90%)", "Operator Payouts (90%)") : t("Mapato Yako Halisi (90%)", "Your Net Payout (90%)")}</span>
            <CreditCard size={18} className="text-[#00f3ff]" />
          </div>
          <p className="text-2xl font-bold text-[#00f3ff] font-mono">
            TZS {Math.round(summary.totalRevenueTzs * 0.9).toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">{t("Inayoweza kutolewa kwenda benki / M-Pesa", "Disbursable to bank / M-Pesa")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>{user?.role === "PLATFORM_ADMIN" ? t("Mapato ya Jukwaa (10%)", "Platform Revenue (10%)") : t("Ada ya Mfumo (10%)", "Platform Fee (10%)")}</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">10%</span>
          </div>
          <p className="text-2xl font-bold text-purple-400 font-mono">
            TZS {Math.round(summary.totalRevenueTzs * 0.1).toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">{t("Ada ya usimamizi wa mfumo", "Platform management fee")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass-panel p-5">
          <div className="flex justify-between items-center text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">
            <span>{t("Jumla ya Miamala", "Total Transactions")}</span>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-mono">{t("Idadi", "Count")}</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {summary.totalTransactions}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">{t("Vocha zilizolipwa kwa simu", "Paid mobile vouchers")}</p>
        </motion.div>
      </div>

      {/* Transactions Section */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-lg font-semibold">{t("Miamala ya Malipo", "Payment Transactions")}</h2>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
            >
              <option value="">{t("Hali Zote", "All Statuses")}</option>
              <option value="SUCCESS">{t("Yaliyofanikiwa Pekee", "Success Only")}</option>
              <option value="PENDING">{t("Yaliyosubiri Pekee", "Pending Only")}</option>
              <option value="FAILED">{t("Yaliyoshindikana Pekee", "Failed Only")}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">{t("Inapakia malipo...", "Loading payments...")}</p>
        ) : payments.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">{t("Hakuna miamala bado.", "No transactions recorded yet.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="p-3">{t("Kumbukumbu", "Reference")}</th>
                  <th className="p-3">{t("Simu ya Mteja", "Customer Phone")}</th>
                  <th className="p-3">{t("Kifurushi", "Package")}</th>
                  <th className="p-3">{t("Mtandao", "Provider")}</th>
                  <th className="p-3">{t("Kiasi", "Amount")}</th>
                  <th className="p-3">{t("Hali", "Status")}</th>
                  <th className="p-3">{t("Tarehe", "Date")}</th>
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
                      <td className="p-3 text-gray-300">{p.package?.name || t("Wi-Fi ya Kawaida", "Standard Wi-Fi")}</td>
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
                          {isSuccess
                            ? t("Imekamilika", "Success")
                            : isPending
                            ? t("Inasubiri", "Pending")
                            : t("Imeshindwa", "Failed")}
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
            <span>{t(`Ukurasa ${page} kati ya ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-30"
              >
                {t("Nyuma", "Previous")}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-30"
              >
                {t("Mbele", "Next")}
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
                <Settings size={20} className="text-[#00f3ff]" /> {t("Muunganisho wa Mfumo wa AzamPay", "AzamPay Gateway Integration")}
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-gray-400">
              {t(
                "Huunganisha Vodacom M-Pesa, Tigo Pesa, Airtel Money, na Halopesa katika mfumo mmoja wa malipo ya kiotomatiki.",
                "Aggregates Vodacom M-Pesa, Tigo Pesa, Airtel Money, and Halopesa into a single automated payment engine."
              )}
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("Jina la Programu", "App Name")}</label>
                <input
                  type="text"
                  placeholder={t("mfano: POAFI_WIFI", "e.g. POAFI_WIFI")}
                  value={configData.appName}
                  onChange={(e) => setConfigData({ ...configData, appName: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("Kitambulisho cha Mteja (Client ID)", "Client ID")}</label>
                <input
                  type="text"
                  placeholder={t("Client ID ya AzamPay", "AzamPay Client ID")}
                  value={configData.clientId}
                  onChange={(e) => setConfigData({ ...configData, clientId: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("Ufunguo wa API (API Key)", "API Key")}</label>
                <input
                  type="password"
                  placeholder={t("API Key ya AzamPay (Imefichwa kwenye DB)", "AzamPay API Key (Encrypted in DB)")}
                  value={configData.apiKey}
                  onChange={(e) => setConfigData({ ...configData, apiKey: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#00f3ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("Siri ya Mteja (Client Secret)", "Client Secret")}</label>
                <input
                  type="password"
                  placeholder={t("Client Secret (Imefichwa kwenye DB)", "Client Secret (Encrypted in DB)")}
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
                  {t(
                    "Hali Halisi (Ikichaguliwa = Halisi, Isipochaguliwa = Majaribio / Sandbox)",
                    "Live Mode (Checked = Production, Unchecked = Sandbox / Simulated Testing)"
                  )}
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs py-2.5 rounded-lg"
                >
                  {t("Ghairi", "Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold text-xs py-2.5 rounded-lg"
                >
                  {t("Hifadhi Mfumo", "Save Gateway")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

