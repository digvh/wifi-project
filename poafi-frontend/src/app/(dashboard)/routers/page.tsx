"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Wifi, Server, ShieldAlert, CheckCircle2, Trash2, Users, RefreshCw, Building } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const VENDORS = [
  { value: "MIKROTIK", label: "MikroTik (RouterOS)", defaultPort: 8728, color: "text-[#00f3ff] border-[#00f3ff]/30 bg-[#00f3ff]/10" },
  { value: "TPLINK_OMADA", label: "TP-Link (Omada SDN)", defaultPort: 8043, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { value: "RUIJIE", label: "Ruijie / Reyee", defaultPort: 443, color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { value: "CUDY", label: "Cudy", defaultPort: 80, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { value: "COMFAST", label: "Comfast", defaultPort: 80, color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  { value: "WAVLINK", label: "Wavlink", defaultPort: 80, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
];

export default function RoutersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [routers, setRouters] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tenantId: "",
    name: "",
    vendor: "MIKROTIK",
    host: "",
    apiPort: 8728,
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeSessionsRouterId, setActiveSessionsRouterId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchData = async () => {
    try {
      if (isSuperAdmin) {
        const [routersData, tenantsData] = await Promise.all([
          apiFetch("/routers"),
          apiFetch("/tenants").catch(() => ({ tenants: [] })),
        ]);
        setRouters(routersData.routers || []);
        const loadedTenants = tenantsData.tenants || [];
        setTenants(loadedTenants);
        if (loadedTenants.length > 0 && !formData.tenantId) {
          setFormData((prev) => ({ ...prev, tenantId: loadedTenants[0].id }));
        }
      } else {
        const routersData = await apiFetch("/routers");
        setRouters(routersData.routers || []);
        // Automatically link to operator's tenant
        if (user?.tenantId) {
          setFormData((prev) => ({ ...prev, tenantId: user.tenantId || "" }));
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleVendorChange = (vendor: string) => {
    const target = VENDORS.find((v) => v.value === vendor);
    setFormData((prev) => ({
      ...prev,
      vendor,
      apiPort: target ? target.defaultPort : 8728,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      ...formData,
      // If operator, always submit their tenantId
      tenantId: isSuperAdmin ? formData.tenantId : (user?.tenantId || formData.tenantId),
    };

    if (isSuperAdmin && !payload.tenantId) {
      setError("Please select an Operator for this router.");
      return;
    }

    try {
      await apiFetch("/routers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess("Router registered successfully!");
      setFormData({
        tenantId: isSuperAdmin && tenants.length > 0 ? tenants[0].id : (user?.tenantId || ""),
        name: "",
        vendor: "MIKROTIK",
        host: "",
        apiPort: 8728,
        username: "",
        password: "",
      });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/routers/${id}/test`, { method: "POST" });
      setSuccess(
        `Connected to ${res.data.identity || "Router"} (${res.data.vendor} ${res.data.version || ""})`
      );
      fetchData();
    } catch (err: any) {
      setError(err.message);
      fetchData();
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete router "${name}"?`)) return;
    try {
      await apiFetch(`/routers/${id}`, { method: "DELETE" });
      setSuccess("Router deleted successfully");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const viewSessions = async (id: string) => {
    setActiveSessionsRouterId(id);
    setLoadingSessions(true);
    try {
      const res = await apiFetch(`/routers/${id}/sessions`);
      setActiveSessions(res.sessions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleDisconnect = async (routerId: string, usernameOrId: string) => {
    try {
      await apiFetch(`/routers/${routerId}/disconnect-user`, {
        method: "POST",
        body: JSON.stringify({ usernameOrId }),
      });
      setSuccess(`Disconnected ${usernameOrId}`);
      viewSessions(routerId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Network Gateways & Routers</h1>
          <p className="text-gray-400 text-sm mt-1">
            Universal compatibility with MikroTik, TP-Link Omada, Ruijie Reyee, Cudy, Comfast & Wavlink.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
          <ShieldAlert /> {error}
        </div>
      )}
      {success && (
        <div className="text-green-400 bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="glass-panel p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Server size={20} className="text-[#00f3ff]" /> Add Gateway Router
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Show Operator selector ONLY if Platform Admin (Super Admin). For Operators, it is automatically bound */}
            {isSuperAdmin ? (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Assign to Operator (Tenant)
                </label>
                <select
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
                  required
                >
                  <option value="" disabled>Select Operator...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
                {tenants.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No operators found. Please create an operator first in "Operators (Tenants)".
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-gray-300 flex items-center gap-2">
                <Building size={16} className="text-[#00f3ff]" />
                <span>Router will be linked to your operator network automatically</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Router Brand / Ecosystem</label>
              <select
                value={formData.vendor}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none font-medium text-sm"
                required
              >
                {VENDORS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Router Name</label>
              <input
                type="text"
                placeholder="e.g. Main Office Router"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1">Host / IP / URL</label>
                <input
                  type="text"
                  placeholder="192.168.88.1"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Port</label>
                <input
                  type="number"
                  value={formData.apiPort}
                  onChange={(e) => setFormData({ ...formData, apiPort: parseInt(e.target.value) || 8728 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">API Username</label>
              <input
                type="text"
                placeholder="admin"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">API Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity text-sm shadow-lg"
            >
              Save Gateway Router
            </button>
          </form>
        </div>

        {/* List */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold flex items-center justify-between">
            <span>Registered Routers ({routers.length})</span>
            <button
              onClick={fetchData}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </h2>

          <div className="space-y-4">
            {routers.length === 0 && <p className="text-gray-400 text-sm">No routers added yet.</p>}
            {routers.map((r) => {
              const vendorMeta = VENDORS.find((v) => v.value === r.vendor) || VENDORS[0];
              return (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/5 p-5 rounded-xl border border-white/5 gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl ${
                        r.status === "ONLINE"
                          ? "bg-green-500/20 text-green-400"
                          : r.status === "ERROR"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      <Wifi size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{r.name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${vendorMeta.color}`}>
                          {vendorMeta.label.split(" ")[0]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {r.host}:{r.apiPort} • Operator: {r.tenant?.name || "Global"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        r.status === "ONLINE"
                          ? "bg-green-500/20 text-green-400"
                          : r.status === "ERROR"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {r.status}
                    </span>

                    <button
                      onClick={() => viewSessions(r.id)}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors border border-white/5"
                    >
                      <Users size={14} /> Sessions
                    </button>

                    <button
                      onClick={() => handleTest(r.id)}
                      disabled={testingId === r.id}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {testingId === r.id ? "Testing..." : "Test Connection"}
                    </button>

                    <button
                      onClick={() => handleDelete(r.id, r.name)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors border border-red-500/10"
                      title="Delete router"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Sessions Panel */}
          {activeSessionsRouterId && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-semibold flex items-center gap-2">
                  <Users size={18} className="text-[#00f3ff]" /> Live Hotspot Users (Active Sessions)
                </h3>
                <button
                  onClick={() => setActiveSessionsRouterId(null)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {loadingSessions ? (
                <p className="text-sm text-gray-400">Querying router for active sessions...</p>
              ) : activeSessions.length === 0 ? (
                <div className="bg-white/5 p-4 rounded-lg text-sm text-gray-400 text-center">
                  No active users currently connected to this router.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Voucher / User</th>
                        <th className="p-3">IP Address</th>
                        <th className="p-3">MAC Address</th>
                        <th className="p-3">Uptime</th>
                        <th className="p-3">Traffic</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {activeSessions.map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-white/5">
                          <td className="p-3 font-mono font-medium text-[#00f3ff]">{s.username}</td>
                          <td className="p-3 font-mono text-gray-300">{s.ipAddress}</td>
                          <td className="p-3 font-mono text-xs text-gray-400">{s.macAddress}</td>
                          <td className="p-3 text-gray-300">{s.uptime}</td>
                          <td className="p-3 text-xs text-gray-400">
                            ↓ {Math.round((s.bytesOut || 0) / 1024)} KB / ↑ {Math.round((s.bytesIn || 0) / 1024)} KB
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleDisconnect(activeSessionsRouterId, s.username || s.id)}
                              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs px-2.5 py-1 rounded transition-colors"
                            >
                              Kick
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
