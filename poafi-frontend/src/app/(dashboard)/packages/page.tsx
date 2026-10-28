"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Package, ShieldAlert, Trash2 } from "lucide-react";

export default function PackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "1 Hour Pass",
    priceTzs: "500",
    durationMinutes: "60",
    downloadKbps: "3000",
    uploadKbps: "1000",
  });
  const [error, setError] = useState("");

  const fetchPackages = async () => {
    try {
      const data = await apiFetch("/packages");
      setPackages(data.packages || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/packages", { method: "POST", body: JSON.stringify(formData) });
      fetchPackages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete package "${name}"?`)) return;
    try {
      await apiFetch(`/packages/${id}`, { method: "DELETE" });
      fetchPackages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-3xl font-bold">Internet Packages</h1>
      {error && (
        <div className="text-red-400 bg-red-500/10 p-3 rounded-lg flex gap-2">
          <ShieldAlert /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 h-fit">
          <h2 className="text-lg font-semibold mb-4">Create Package</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              placeholder="Package Name (e.g. 10 Hours)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]"
              required
            />

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Price (TZS)"
                value={formData.priceTzs}
                onChange={(e) => setFormData({ ...formData, priceTzs: e.target.value })}
                className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]"
                required
              />
              <input
                type="number"
                placeholder="Duration (Mins)"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]"
                required
              />
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Down (Kbps)"
                value={formData.downloadKbps}
                onChange={(e) => setFormData({ ...formData, downloadKbps: e.target.value })}
                className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]"
                required
              />
              <input
                type="number"
                placeholder="Up (Kbps)"
                value={formData.uploadKbps}
                onChange={(e) => setFormData({ ...formData, uploadKbps: e.target.value })}
                className="w-1/2 bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#00f3ff] text-black font-bold py-3 rounded-lg hover:bg-[#00f3ff]/80 transition-colors"
            >
              Save Package
            </button>
          </form>
        </div>

        <div className="glass-panel p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">My Packages</h2>
          <div className="space-y-3">
            {packages.length === 0 && (
              <p className="text-gray-400 text-sm">No packages created yet.</p>
            )}
            {packages.map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#9d00ff]/20 text-[#9d00ff] rounded-lg">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{p.name}</p>
                    <p className="text-sm text-gray-400">
                      {p.durationMinutes} Minutes • {Math.round(p.downloadKbps / 1000)} Mbps Down
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-[#00f3ff] text-xl">
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
