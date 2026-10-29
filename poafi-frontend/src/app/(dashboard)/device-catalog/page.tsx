"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Search, RadioTower, Network, Signal, Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Device = {
  id: string; brand: string; model: string; category: string; subcategory?: string | null;
  environment: string; coverageMeters?: number | null; coverageBand?: string | null;
  coverageNote?: string | null; frequencyBands: string[]; wifiStandard?: string | null;
  poe?: string | null; ipRating?: string | null; managementPlatform?: string | null;
  notes?: string | null; sourceUrl?: string | null; antenna?: string | null;
  maxClients?: number | null; maxSpeedMbps?: number | null; hotspotSupport?: boolean;
};

const CATEGORIES: Record<string, string> = {
  ROUTER: "Router", ACCESS_POINT: "Access point", WIRELESS_CPE: "Wireless CPE",
  MESH_SYSTEM: "Mesh system", SWITCH: "Switch", RANGE_EXTENDER: "Range extender",
  GATEWAY: "Gateway", CONTROLLER: "Controller",
};
const CATEGORY_VALUES = Object.keys(CATEGORIES);
const COVERAGE = ["All ranges", "0-100m", "101-300m", "301-500m", "Above 500m", "Not specified"];
const EMPTY_FORM = {
  brand: "", model: "", category: "ACCESS_POINT", subcategory: "Outdoor", environment: "OUTDOOR",
  coverageMeters: "", coverageNote: "", frequencyBands: "2.4 GHz, 5 GHz", wifiStandard: "",
  poe: "", ipRating: "", managementPlatform: "", notes: "", sourceUrl: "", hotspotSupport: false,
};

export default function DeviceCatalogPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "PLATFORM_ADMIN";
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [coverage, setCoverage] = useState("All ranges");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDevices = async () => {
    try {
      const response = await apiFetch("/device-catalog");
      setDevices(response.devices || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Could not load device catalogue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const filtered = useMemo(() => devices.filter((device) => {
    const term = `${device.brand} ${device.model} ${device.subcategory || ""}`.toLowerCase();
    return term.includes(search.toLowerCase())
      && (category === "ALL" || device.category === category)
      && (coverage === "All ranges"
        || (coverage === "Not specified" && device.coverageMeters == null)
        || device.coverageBand === coverage);
  }), [devices, search, category, coverage]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (device: Device) => {
    setEditingId(device.id);
    setForm({
      brand: device.brand || "", model: device.model || "", category: device.category || "ACCESS_POINT",
      subcategory: device.subcategory || "", environment: device.environment || "INDOOR",
      coverageMeters: device.coverageMeters == null ? "" : String(device.coverageMeters),
      coverageNote: device.coverageNote || "", frequencyBands: (device.frequencyBands || []).join(", "),
      wifiStandard: device.wifiStandard || "", poe: device.poe || "", ipRating: device.ipRating || "",
      managementPlatform: device.managementPlatform || "", notes: device.notes || "",
      sourceUrl: device.sourceUrl || "", hotspotSupport: Boolean(device.hotspotSupport),
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const payload = {
      ...form,
      coverageMeters: form.coverageMeters.trim() === "" ? null : Number(form.coverageMeters),
      frequencyBands: form.frequencyBands.split(",").map((band) => band.trim()).filter(Boolean),
      subcategory: form.subcategory.trim() || null,
      coverageNote: form.coverageNote.trim() || null,
      wifiStandard: form.wifiStandard.trim() || null,
      poe: form.poe.trim() || null,
      ipRating: form.ipRating.trim() || null,
      managementPlatform: form.managementPlatform.trim() || null,
      notes: form.notes.trim() || null,
      sourceUrl: form.sourceUrl.trim() || null,
    };
    try {
      await apiFetch(editingId ? `/device-catalog/${editingId}` : "/device-catalog", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(editingId ? "Device model updated." : "Device model added.");
      resetForm();
      await fetchDevices();
    } catch (err: any) {
      setError(err.message || "Could not save device model");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device: Device) => {
    if (!confirm(`Delete ${device.brand} ${device.model} from the catalogue?`)) return;
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/device-catalog/${device.id}`, { method: "DELETE" });
      if (editingId === device.id) resetForm();
      setSuccess("Device model deleted.");
      await fetchDevices();
    } catch (err: any) {
      setError(err.message || "Could not delete device model");
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Network Device Catalogue</h1>
        <p className="mt-1 text-sm text-gray-400">Browse equipment by type, brand, model and advertised coverage range.</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">{success}</div>}

      {isPlatformAdmin && (
        <section className="glass-panel rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Plus size={18} /> {editingId ? "Edit device model" : "Add device model"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300"><X size={14}/> Cancel edit</button>}
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-gray-400">Brand *<input required maxLength={80} value={form.brand} onChange={e => setForm({...form, brand:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="e.g. TP-Link"/></label>
            <label className="text-xs text-gray-400">Model *<input required maxLength={120} value={form.model} onChange={e => setForm({...form, model:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="e.g. EAP610-Outdoor"/></label>
            <label className="text-xs text-gray-400">Category *<select value={form.category} onChange={e => setForm({...form, category:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a1a] p-2.5 text-sm text-white">{CATEGORY_VALUES.map(value=><option key={value} value={value}>{CATEGORIES[value]}</option>)}</select></label>
            <label className="text-xs text-gray-400">Subcategory<input value={form.subcategory} onChange={e => setForm({...form, subcategory:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="Outdoor"/></label>
            <label className="text-xs text-gray-400">Environment<select value={form.environment} onChange={e => setForm({...form, environment:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a0a1a] p-2.5 text-sm text-white"><option value="INDOOR">Indoor</option><option value="OUTDOOR">Outdoor</option><option value="BOTH">Indoor / Outdoor</option></select></label>
            <label className="text-xs text-gray-400">Advertised coverage (metres)<input type="number" min="0" step="1" value={form.coverageMeters} onChange={e => setForm({...form, coverageMeters:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="Leave blank if unknown"/></label>
            <label className="text-xs text-gray-400">Wi-Fi standard<input value={form.wifiStandard} onChange={e => setForm({...form, wifiStandard:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="Wi-Fi 6 / 802.11ax"/></label>
            <label className="text-xs text-gray-400">Frequency bands (comma separated)<input value={form.frequencyBands} onChange={e => setForm({...form, frequencyBands:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="2.4 GHz, 5 GHz"/></label>
            <label className="text-xs text-gray-400">PoE<input value={form.poe} onChange={e => setForm({...form, poe:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="802.3af / passive PoE"/></label>
            <label className="text-xs text-gray-400">Weather / IP rating<input value={form.ipRating} onChange={e => setForm({...form, ipRating:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="IP65"/></label>
            <label className="text-xs text-gray-400">Management platform<input value={form.managementPlatform} onChange={e => setForm({...form, managementPlatform:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="Omada Controller"/></label>
            <label className="text-xs text-gray-400 md:col-span-2">Manufacturer specification URL<input type="url" value={form.sourceUrl} onChange={e => setForm({...form, sourceUrl:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" placeholder="https://..."/></label>
            <label className="text-xs text-gray-400 md:col-span-3">Coverage note<textarea value={form.coverageNote} onChange={e => setForm({...form, coverageNote:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" rows={2} placeholder="Clarify band-specific or manufacturer-stated range."/></label>
            <label className="text-xs text-gray-400 md:col-span-3">Notes<textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white" rows={2} placeholder="Additional specification or compatibility notes"/></label>
            <label className="flex items-center gap-2 text-sm text-gray-300 md:col-span-3"><input type="checkbox" checked={form.hotspotSupport} onChange={e => setForm({...form, hotspotSupport:e.target.checked})}/> Supports hotspot use (verify for the exact model)</label>
            <div className="flex gap-2 md:col-span-3"><button disabled={saving} type="submit" className="rounded-lg bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : "Add model"}</button></div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="glass-panel rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><Network size={18}/> Device categories</div><p className="mt-2 text-2xl font-bold">8</p></div>
        <div className="glass-panel rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><RadioTower size={18}/> Catalogue models</div><p className="mt-2 text-2xl font-bold">{devices.length}</p></div>
        <div className="glass-panel rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><Signal size={18}/> Coverage bands</div><p className="mt-2 text-2xl font-bold">5</p></div>
      </div>

      <div className="glass-panel rounded-xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative"><Search className="absolute left-3 top-3 text-gray-500" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search brand or model..." className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[#00f3ff]"/></label>
          <select aria-label="Filter by category" value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border border-white/10 bg-[#0a0a1a] p-2.5 text-sm text-white"><option value="ALL">All device categories</option>{Object.entries(CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Filter by coverage" value={coverage} onChange={e=>setCoverage(e.target.value)} className="rounded-lg border border-white/10 bg-[#0a0a1a] p-2.5 text-sm text-white">{COVERAGE.map(option=><option key={option}>{option}</option>)}</select>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading catalogue...</p> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map(device => (
            <article key={device.id} className="glass-panel rounded-xl border border-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[#00f3ff]">{device.brand}</p><h2 className="mt-1 text-xl font-bold">{device.model}</h2><p className="mt-1 text-sm text-gray-400">{CATEGORIES[device.category] || device.category}{device.subcategory ? ` • ${device.subcategory}` : ""}{device.environment ? ` • ${device.environment}` : ""}</p></div>
                <div className="rounded-lg bg-[#00f3ff]/10 p-3 text-[#00f3ff]"><RadioTower size={22}/></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">Advertised coverage</p><p className="mt-1 font-semibold">{device.coverageMeters != null ? `Up to ${device.coverageMeters} m` : "Not specified"}</p>{device.coverageBand && <p className="mt-1 text-xs text-gray-400">{device.coverageBand}</p>}</div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">Wi-Fi standard</p><p className="mt-1 font-semibold">{device.wifiStandard || "Not specified"}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">Frequency bands</p><p className="mt-1 font-semibold">{device.frequencyBands?.join(", ") || "Not specified"}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">PoE / weather rating</p><p className="mt-1 font-semibold">{device.poe || "Not specified"}{device.ipRating ? ` • ${device.ipRating}` : ""}</p></div>
              </div>
              {device.coverageNote && <p className="mt-4 text-xs leading-5 text-amber-200/80">{device.coverageNote}</p>}
              {device.notes && <p className="mt-2 text-xs leading-5 text-gray-400">{device.notes}</p>}
              {device.sourceUrl && <a href={device.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-[#00f3ff] hover:underline">Manufacturer specifications ↗</a>}
              {isPlatformAdmin && <div className="mt-4 flex gap-2 border-t border-white/10 pt-3"><button onClick={()=>startEdit(device)} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-200"><Pencil size={13}/> Edit</button><button onClick={()=>handleDelete(device)} className="flex items-center gap-1 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300"><Trash2 size={13}/> Delete</button></div>}
            </article>
          ))}
          {filtered.length === 0 && <div className="glass-panel rounded-xl p-8 text-center text-sm text-gray-400 xl:col-span-2">No models match these filters yet. Add verified models to expand the catalogue.</div>}
        </div>
      )}
      <p className="text-xs text-gray-500">Coverage figures are manufacturer-stated maximums where available. Real-world Wi-Fi range changes with walls, interference, mounting height, transmit power and client devices. A catalogue listing does not mean PoaFi can remotely manage that device.</p>
    </div>
  );
}
