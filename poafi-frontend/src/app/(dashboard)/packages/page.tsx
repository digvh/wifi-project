"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Package, ShieldAlert, Trash2, Building2, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function PackagesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [packages, setPackages] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [filterTenantId, setFilterTenantId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  const [formData, setFormData] = useState({
    name: "1 Hour Pass",
    priceTzs: "500",
    durationMinutes: "60",
    downloadKbps: "3000",
    uploadKbps: "1000",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPackages = async (tenantFilter?: string) => {
    try {
      setLoading(true);
      const query = tenantFilter ? `?tenantId=${tenantFilter}` : "";
      const calls: Promise<any>[] = [apiFetch(`/packages${query}`)];

      if (isSuperAdmin) {
        calls.push(apiFetch("/tenants"));
      }

      const [pkgRes, tenantsRes] = await Promise.all(calls);
      setPackages(pkgRes.packages || []);

      if (tenantsRes?.tenants) {
        setTenants(tenantsRes.tenants);
        if (tenantsRes.tenants.length > 0 && !selectedTenantId) {
          setSelectedTenantId(tenantsRes.tenants[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages(filterTenantId);
  }, [user, filterTenantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isSuperAdmin && !selectedTenantId) {
      setError("Please select an Operator to create package for");
      return;
    }

    try {
      await apiFetch("/packages", { 
        method: "POST", 
        body: JSON.stringify({
          ...formData,
          tenantId: isSuperAdmin ? selectedTenantId : undefined,
        }) 
      });
      setSuccess("Package created successfully!");
      fetchPackages(filterTenantId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete package "${name}"?`)) return;
    try {
      await apiFetch(`/packages/${id}`, { method: "DELETE" });
      setSuccess("Package deleted successfully");
      fetchPackages(filterTenantId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="text-[#00f3ff] w-8 h-8" />
            <span>Internet Packages</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure pricing, speeds, and time durations for your hotspot portals.
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-xs text-gray-300">
            <Building2 className="text-[#00f3ff] w-4 h-4" />
            <span>Filter by Operator:</span>
            <select
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="bg-[#0a0a1a] border border-white/20 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#00f3ff]"
            >
              <option value="">All Operators ({tenants.length})</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-sm">
          <ShieldAlert className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="text-green-400 bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="glass-panel p-6 h-fit rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-bold text-white">Create Package</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {isSuperAdmin && (
              <div className="space-y-1">
                <label className="text-[11px] text-[#00f3ff] font-bold flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>Select Operator: *</span>
                </label>
                <select
                  required
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full bg-[#0a0a1a] border border-[#00f3ff]/40 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                >
                  <option value="">-- Select Operator --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      🏢 {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Package Name</label>
              <input
                type="text"
                placeholder="Package Name (e.g. 10 Hours)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Price (TZS)</label>
                <input
                  type="number"
                  placeholder="500"
                  value={formData.priceTzs}
                  onChange={(e) => setFormData({ ...formData, priceTzs: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Duration (Mins)</label>
                <input
                  type="number"
                  placeholder="60"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Down (Kbps)</label>
                <input
                  type="number"
                  placeholder="3000"
                  value={formData.downloadKbps}
                  onChange={(e) => setFormData({ ...formData, downloadKbps: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Up (Kbps)</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={formData.uploadKbps}
                  onChange={(e) => setFormData({ ...formData, uploadKbps: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm transition-opacity hover:opacity-90 shadow-lg shadow-[#00f3ff]/20"
            >
              Save Package
            </button>
          </form>
        </div>

        {/* Packages List */}
        <div className="glass-panel p-6 md:col-span-2 rounded-2xl border border-white/10 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-white">Packages ({packages.length})</h2>
            <button
              onClick={() => fetchPackages(filterTenantId)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="space-y-3">
            {packages.length === 0 ? (
              <p className="text-gray-400 text-xs p-4">No packages created yet.</p>
            ) : (
              packages.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#9d00ff]/20 text-[#9d00ff] rounded-xl border border-[#9d00ff]/30">
                      <Package size={22} />
                    </div>
                    <div>
                      <p className="font-bold text-base text-white">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.durationMinutes} Minutes • {Math.round(p.downloadKbps / 1000)} Mbps Down
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-[#00f3ff] text-lg">
                      TZS {Number(p.priceTzs).toLocaleString()}
                    </p>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors border border-red-500/10"
                      title="Delete package"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
