"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Trash2, Key, ShieldAlert } from "lucide-react";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  // Login Modal State
  const [loginTenantId, setLoginTenantId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");

  const fetchTenants = async () => {
    try {
      const data = await apiFetch("/tenants");
      setTenants(data.tenants);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/tenants", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setName(""); setSlug("");
      fetchTenants();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete the operator and ALL their routers!")) return;
    try {
      await apiFetch(`/tenants/${id}`, { method: "DELETE" });
      fetchTenants();
    } catch (err: any) { setError(err.message); }
  };

  const handleCreateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoginSuccess("");
    try {
      await apiFetch(`/tenants/${loginTenantId}/create-login`, {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setLoginSuccess("Login created successfully! Give these credentials to the operator.");
      setLoginEmail(""); setLoginPassword("");
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-3xl font-bold">Wi-Fi Operators</h1>
      {error && <div className="text-red-400 bg-red-500/10 p-3 rounded-lg flex gap-2"><ShieldAlert/> {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="glass-panel p-6 md:col-span-1 h-fit">
          <h2 className="text-lg font-semibold mb-4">Add New Operator</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <input type="text" placeholder="Operator Name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none" required />
            <input type="text" placeholder="Slug (e.g. arusha-wifi)" value={slug} onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none" required />
            <button type="submit" className="w-full bg-[#00f3ff] text-black font-bold py-3 rounded-lg hover:bg-[#00f3ff]/80 transition-colors">
              Create Operator
            </button>
          </form>
        </div>

        {/* List */}
        <div className="glass-panel p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Registered Operators</h2>
          <div className="space-y-3">
            {tenants.length === 0 && <p className="text-gray-400">No operators yet.</p>}
            {tenants.map((t) => (
              <div key={t.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 p-4 rounded-lg border border-white/5 gap-4">
                <div>
                  <p className="font-bold text-lg">{t.name}</p>
                  <p className="text-sm text-gray-400">{t.slug}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => { setLoginTenantId(t.id); setLoginSuccess(""); }} className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                    <Key size={16} /> Login
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {loginTenantId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Operator Login</h2>
            {loginSuccess && <div className="text-green-400 bg-green-500/10 p-3 rounded-lg mb-4 text-sm">{loginSuccess}</div>}
            <form onSubmit={handleCreateLogin} className="space-y-4">
              <input type="email" placeholder="Operator Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]" required />
              <input type="text" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff]" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setLoginTenantId(null)} className="flex-1 bg-white/10 py-2 rounded-lg">Close</button>
                <button type="submit" className="flex-1 bg-[#00f3ff] text-black font-bold py-2 rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}