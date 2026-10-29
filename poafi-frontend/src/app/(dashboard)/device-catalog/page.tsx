"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Search, RadioTower, Network, Signal } from "lucide-react";

type Device = {
  id: string; brand: string; model: string; category: string; subcategory?: string | null;
  environment: string; coverageMeters?: number | null; coverageBand?: string | null;
  coverageNote?: string | null; frequencyBands: string[]; wifiStandard?: string | null;
  poe?: string | null; ipRating?: string | null; managementPlatform?: string | null;
  notes?: string | null; sourceUrl?: string | null;
};

const CATEGORIES: Record<string, string> = {
  ROUTER: "Router", ACCESS_POINT: "Access point", WIRELESS_CPE: "Wireless CPE",
  MESH_SYSTEM: "Mesh system", SWITCH: "Switch", RANGE_EXTENDER: "Range extender",
  GATEWAY: "Gateway", CONTROLLER: "Controller",
};
const COVERAGE = ["All ranges", "0-100m", "101-300m", "301-500m", "Above 500m", "Not specified"];

export default function DeviceCatalogPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [coverage, setCoverage] = useState("All ranges");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/device-catalog")
      .then((response) => setDevices(response.devices || []))
      .catch((err: any) => setError(err.message || "Could not load device catalogue"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => devices.filter((device) => {
    const term = `${device.brand} ${device.model} ${device.subcategory || ""}`.toLowerCase();
    return term.includes(search.toLowerCase())
      && (category === "ALL" || device.category === category)
      && (coverage === "All ranges"
        || (coverage === "Not specified" && !device.coverageMeters)
        || device.coverageBand === coverage);
  }), [devices, search, category, coverage]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Network Device Catalogue</h1>
        <p className="mt-1 text-sm text-gray-400">Browse network equipment by type, brand, model and advertised coverage range.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="glass-panel rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><Network size={18}/> Device categories</div><p className="mt-2 text-2xl font-bold">8</p></div>
        <div className="glass-panel rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><RadioTower size={18}/> Catalogue models</div><p className="mt-2 text-2xl font-bold">{devices.length}</p></div>
        <div className="glass-panel rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><Signal size={18}/> Coverage bands</div><p className="mt-2 text-2xl font-bold">5</p></div>
      </div>

      <div className="glass-panel rounded-xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative"><Search className="absolute left-3 top-3 text-gray-500" size={17}/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand or model..."
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[#00f3ff]"/>
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-white/10 bg-[#0a0a1a] p-2.5 text-sm text-white">
            <option value="ALL">All device categories</option>
            {Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={coverage} onChange={(e) => setCoverage(e.target.value)} className="rounded-lg border border-white/10 bg-[#0a0a1a] p-2.5 text-sm text-white">
            {COVERAGE.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {loading ? <p className="text-sm text-gray-400">Loading catalogue...</p> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((device) => (
            <article key={device.id} className="glass-panel rounded-xl border border-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-[#00f3ff]">{device.brand}</p>
                  <h2 className="mt-1 text-xl font-bold">{device.model}</h2>
                  <p className="mt-1 text-sm text-gray-400">{CATEGORIES[device.category] || device.category}{device.subcategory ? ` • ${device.subcategory}` : ""}{device.environment ? ` • ${device.environment}` : ""}</p>
                </div>
                <div className="rounded-lg bg-[#00f3ff]/10 p-3 text-[#00f3ff]"><RadioTower size={22}/></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">Advertised coverage</p><p className="mt-1 font-semibold">{device.coverageMeters ? `Up to ${device.coverageMeters} m` : "Not specified"}</p>{device.coverageBand && <p className="mt-1 text-xs text-gray-400">{device.coverageBand}</p>}</div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">Wi-Fi standard</p><p className="mt-1 font-semibold">{device.wifiStandard || "Not specified"}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">Frequency bands</p><p className="mt-1 font-semibold">{device.frequencyBands?.join(", ") || "Not specified"}</p></div>
                <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-gray-500">PoE / weather rating</p><p className="mt-1 font-semibold">{device.poe || "Not specified"}{device.ipRating ? ` • ${device.ipRating}` : ""}</p></div>
              </div>
              {device.coverageNote && <p className="mt-4 text-xs leading-5 text-amber-200/80">{device.coverageNote}</p>}
              {device.notes && <p className="mt-2 text-xs leading-5 text-gray-400">{device.notes}</p>}
              {device.sourceUrl && <a href={device.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-[#00f3ff] hover:underline">Manufacturer specifications ↗</a>}
            </article>
          ))}
          {filtered.length === 0 && <div className="glass-panel rounded-xl p-8 text-center text-sm text-gray-400 xl:col-span-2">No models match these filters yet. More verified device models can be added to the catalogue.</div>}
        </div>
      )}
      <p className="text-xs text-gray-500">Coverage figures are manufacturer-stated maximums where available. Real-world Wi-Fi range changes with walls, interference, mounting height, transmit power and client devices. A catalogue listing does not mean PoaFi can remotely manage that device.</p>
    </div>
  );
}
