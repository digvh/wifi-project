"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { MapPin, Plus } from "lucide-react";

export default function SitesPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const loadSites = async () => {
    try {
      const res = await apiFetch("/sites");
      setSites(res.sites || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSites(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/sites", {
        method: "POST",
        body: JSON.stringify({ name, address })
      });
      setName(""); setAddress(""); setShowForm(false);
      loadSites();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><MapPin className="text-[#00f3ff]" /> Physical Sites</h1>
          <p className="text-gray-400 text-sm mt-1">Manage multiple locations (branches, shops, hotels) under your network.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <Plus size={16} /> {showForm ? "Cancel" : "Add Site"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Site Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mlimani City Branch" className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Address / Location</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Sam Nujoma Rd, Dar es Salaam" className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm" />
          </div>
          <button type="submit" className="w-full bg-[#00f3ff]/20 text-[#00f3ff] font-bold py-3 rounded-xl text-sm">Create Site</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sites.map(site => (
          <div key={site.id} className="glass-panel p-5 rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#00f3ff]/10 flex items-center justify-center text-[#00f3ff] shrink-0">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white">{site.name}</h3>
              <p className="text-xs text-gray-400 mt-1">{site.address || "No address set"}</p>
              <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-wide">{site._count.routers} Routers linked</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}