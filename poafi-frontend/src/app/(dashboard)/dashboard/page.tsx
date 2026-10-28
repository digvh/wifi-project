"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Zap,
  Wifi,
  TrendingUp,
  Ticket,
  Server,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState({
    activeSessions: 0,
    totalRevenueTzs: 0,
    todayRevenueTzs: 0,
    successfulTransactions: 0,
    todayTransactions: 0,
    vouchers: { total: 0, active: 0, unused: 0, usedOrExpired: 0 },
    routers: { total: 0, online: 0, offline: 0 },
    tenantsCount: 1,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [error, setError] = useState("");

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [overviewData, chartRes, routersRes, packagesRes] = await Promise.all([
        apiFetch("/stats/overview"),
        apiFetch("/stats/revenue-chart"),
        apiFetch("/stats/routers-health"),
        apiFetch("/stats/popular-packages"),
      ]);

      setOverview(overviewData);
      setChartData(chartRes.chartData || []);
      setRouters(routersRes.routers || []);
      setPackages(packagesRes.packages || []);
      setError("");
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard statistics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            PoaFi <span className="text-[#00f3ff]">WiFi Core</span>
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            {user?.role === "PLATFORM_ADMIN"
              ? "Global Carrier Network & Billing Monitor"
              : `Operator Hotspot Control Dashboard (${user?.email})`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="glass-panel px-3.5 py-2 flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-[#00f3ff]" : ""} />
            {refreshing ? "Syncing..." : "Sync Live Data"}
          </button>

          <div className="glass-panel px-4 py-2 flex items-center gap-2 text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                overview.routers.online > 0 ? "bg-green-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>
              {overview.routers.online > 0
                ? `${overview.routers.online} Gateway(s) Online`
                : "No Gateways Online"}
            </span>
          </div>
        </div>
      </motion.header>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel p-5 relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Active Sessions</p>
              <h2 className="text-3xl font-bold mt-2 font-mono text-white">
                {loading ? "..." : overview.activeSessions.toLocaleString()}
              </h2>
              <p className="text-[11px] text-[#00f3ff] mt-1 flex items-center gap-1">
                <Users size={12} /> Currently browsing
              </p>
            </div>
            <div className="p-3 bg-[#00f3ff]/10 border border-[#00f3ff]/20 rounded-xl text-[#00f3ff]">
              <Activity size={22} />
            </div>
          </div>
        </motion.div>

        {/* Today's Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-5 relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Today's Revenue</p>
              <h2 className="text-3xl font-bold mt-2 font-mono text-[#00f3ff]">
                TZS {loading ? "..." : overview.todayRevenueTzs.toLocaleString()}
              </h2>
              <p className="text-[11px] text-gray-400 mt-1">
                {overview.todayTransactions} transaction(s) today
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Zap size={22} />
            </div>
          </div>
        </motion.div>

        {/* Total Collected Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-5 relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">All-Time Revenue</p>
              <h2 className="text-3xl font-bold mt-2 font-mono text-white">
                TZS {loading ? "..." : overview.totalRevenueTzs.toLocaleString()}
              </h2>
              <p className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
                <TrendingUp size={12} /> {overview.successfulTransactions} paid orders
              </p>
            </div>
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
              <TrendingUp size={22} />
            </div>
          </div>
        </motion.div>

        {/* Vouchers Pool */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-5 relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Voucher Inventory</p>
              <h2 className="text-3xl font-bold mt-2 font-mono text-white">
                {loading ? "..." : overview.vouchers.total.toLocaleString()}
              </h2>
              <p className="text-[11px] text-gray-400 mt-1">
                <span className="text-green-400 font-semibold">{overview.vouchers.unused}</span> ready to sell
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Ticket size={22} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Charts & Network Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Growth Chart (2 Cols) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 glass-panel p-6 flex flex-col justify-between"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp size={18} className="text-[#00f3ff]" /> Revenue Trajectory (Last 7 Days)
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Automated mobile money receipts aggregated in real time
              </p>
            </div>
            <span className="text-xs font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
              TZS Currency
            </span>
          </div>

          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} textAnchor="middle" />
                <YAxis
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 26, 0.95)",
                    border: "1px solid rgba(0, 243, 255, 0.3)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  }}
                  formatter={(value: any) => [`TZS ${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#00f3ff"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Network Gateways Live Status (1 Col) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Server size={18} className="text-[#00f3ff]" /> Router Gateways
              </h3>
              <span className="text-[11px] text-gray-400">{routers.length} Registered</span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {routers.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 bg-white/5 rounded-xl">
                  No routers registered yet. Go to Routers page to add one.
                </div>
              ) : (
                routers.map((r) => {
                  const isOnline = r.status === "ONLINE";
                  return (
                    <div
                      key={r.id}
                      className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isOnline
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          <Wifi size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-snug">{r.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {r.vendor} • {r.host}:{r.apiPort}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          isOnline
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 text-[11px] text-gray-400 flex justify-between items-center">
            <span>Gateway Engine: Multi-Brand v2</span>
            <span className="text-[#00f3ff] font-mono">6 Brands Supported</span>
          </div>
        </motion.div>
      </div>

      {/* Popular Packages Ranking */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-panel p-6"
      >
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap size={18} className="text-[#9d00ff]" /> Best-Selling Wi-Fi Packages
        </h3>

        {packages.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No packages created yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-bold text-white text-base">{pkg.name}</h4>
                  <p className="text-xs text-[#00f3ff] font-semibold mt-1">
                    TZS {pkg.priceTzs.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {pkg.durationMinutes >= 1440
                      ? `${Math.round(pkg.durationMinutes / 1440)} Days Access`
                      : `${Math.round(pkg.durationMinutes / 60)} Hours Access`}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs text-gray-400">
                  <span>Sales</span>
                  <span className="font-mono text-white font-bold">{pkg.totalPayments || 0} orders</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </main>
  );
}
