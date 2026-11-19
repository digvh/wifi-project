"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  ShieldAlert, ShieldCheck, Plus, Copy, RefreshCw, Trash2,
  CheckCircle2, XCircle, Server, Activity, KeyRound, Info,
} from "lucide-react";

type RadiusStatus = {
  enabled: boolean;
  serverHost: string | null;
  authenticationPort: number;
  accountingPort: number;
  authenticationProtocol: string;
  accounting: boolean;
};

type RadiusClient = {
  id: string;
  tenantId: string;
  routerId: string | null;
  vendor: string;
  model: string | null;
  name: string;
  nasname: string;
  shortname: string;
  type: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  tenant?: { name: string; slug: string };
  router?: { id: string; name: string } | null;
};

type RadiusSession = {
  id: string;
  username: string;
  status: string;
  framedIpAddress: string | null;
  callingStationId: string | null;
  inputOctets: string;
  outputOctets: string;
  sessionTimeSeconds: number;
  startedAt: string | null;
  lastUpdatedAt: string;
  stoppedAt: string | null;
  nas: { name: string; nasname: string };
};

type Tenant = { id: string; name: string; slug: string };

type NewClientCreds = {
  client: RadiusClient;
  sharedSecret: string;
  configuration: {
    authenticationServer: string;
    authenticationPort: number;
    accountingServer: string;
    accountingPort: number;
    authenticationProtocol: string;
  };
};

export default function RadiusAdminPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [status, setStatus] = useState<RadiusStatus | null>(null);
  const [clients, setClients] = useState<RadiusClient[]>([]);
  const [sessions, setSessions] = useState<RadiusSession[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: "",
    routerId: "",
    vendor: "GENERIC",
    model: "",
    name: "",
    nasname: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);
  const [newCreds, setNewCreds] = useState<NewClientCreds | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const baseCalls = [
        apiFetch("/radius/status"),
        apiFetch("/radius/clients"),
        apiFetch("/radius/sessions"),
      ];
      const [statusRes, clientsRes, sessionsRes] = await Promise.all(baseCalls);
      setStatus(statusRes);
      setClients(clientsRes.clients || []);
      setSessions(sessionsRes.sessions || []);

      if (isSuperAdmin) {
        const [tenantsRes, routersRes] = await Promise.all([
          apiFetch("/tenants").catch(() => ({ tenants: [] })),
          apiFetch("/routers").catch(() => ({ routers: [] })),
        ]);
        setTenants(tenantsRes.tenants || []);
        setRouters(routersRes.routers || []);
        if (tenantsRes.tenants?.length > 0 && !formData.tenantId) {
          setFormData(f => ({ ...f, tenantId: tenantsRes.tenants[0].id }));
        }
      } else {
        const routersRes = await apiFetch("/routers").catch(() => ({ routers: [] }));
        setRouters(routersRes.routers || []);
      }
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load RADIUS data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);

    try {
      const payload: any = {
        name: formData.name.trim(),
        nasname: formData.nasname.trim(),
        vendor: formData.vendor || "GENERIC",
      };
      if (formData.model) payload.model = formData.model;
      if (formData.description) payload.description = formData.description;
      if (formData.routerId) payload.routerId = formData.routerId;
      if (isSuperAdmin && formData.tenantId) payload.tenantId = formData.tenantId;

      const res = await apiFetch("/radius/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNewCreds({
        client: res.client,
        sharedSecret: res.sharedSecret,
        configuration: res.configuration,
      });
      setSuccess(t("Kifaa cha RADIUS kimeongezwa. Hifadhi siri hii sasa — haitaonyeshwa tena.", "RADIUS device added. Save the shared secret now — it will not be shown again."));
      setFormData(f => ({ ...f, name: "", nasname: "", model: "", description: "" }));
      setShowForm(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message || t("Imeshindikana kuongeza mteja wa RADIUS", "Failed to add RADIUS client"));
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (id: string) => {
    if (!confirm(t("Zungusha siri ya pamoja ya RADIUS ya kifaa hiki? Siri ya zamani itaacha kufanya kazi mara moja.", "Rotate this device's RADIUS shared secret? The old secret stops working immediately."))) return;
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/radius/clients/${id}/rotate-secret`, { method: "POST" });
      setNewCreds({
        client: res.client,
        sharedSecret: res.sharedSecret,
        configuration: {
          authenticationServer: status?.serverHost || "YOUR_RADIUS_HOST",
          authenticationPort: 1812,
          accountingServer: status?.serverHost || "YOUR_RADIUS_HOST",
          accountingPort: 1813,
          authenticationProtocol: "PAP",
        },
      });
      setSuccess(t("Siri imebadilishwa. Sasisha kifaa na siri mpya sasa.", "Secret rotated. Update the device with the new secret now."));
      await loadAll();
    } catch (err: any) {
      setError(err.message || t("Imeshindikana kubadilisha siri", "Failed to rotate secret"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t(`Futa kifaa cha RADIUS "${name}"? Kifaa hakitaweza tena kuthibitisha watumiaji.`, `Delete RADIUS device "${name}"? The device will no longer authenticate.`))) return;
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/radius/clients/${id}`, { method: "DELETE" });
      setSuccess(t("Kifaa kimeondolewa.", "Device removed."));
      await loadAll();
    } catch (err: any) {
      setError(err.message || t("Imeshindikana kufuta kifaa", "Failed to delete device"));
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatBytes = (s: string) => {
    const n = Number(s);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("Vifaa vya RADIUS", "RADIUS Devices")}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {t(
              "Uthibitishaji mmoja kwa router, AP, au gateway yoyote inayotumia RADIUS — TP-Link Omada, Ubiquiti UniFi, Ruijie Reyee, Cisco na nyingine.",
              "Centralized authentication for any router, AP, or gateway that speaks RADIUS — TP-Link Omada, Ubiquiti UniFi, Ruijie Reyee, Grandstream GWN, Cisco, and more.",
            )}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }}
          className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg flex items-center gap-2"
        >
          <Plus size={16} />
          {showForm ? t("Ghairi", "Cancel") : t("Ongeza Kifaa cha RADIUS", "Add RADIUS Device")}
        </button>
      </div>

      {/* Status banner */}
      {status && (
        <div className={`rounded-xl p-4 border ${status.enabled ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-amber-500/10 border-amber-500/30 text-amber-200"}`}>
          <div className="flex items-start gap-3">
            {status.enabled ? <ShieldCheck className="shrink-0 mt-0.5" size={20} /> : <ShieldAlert className="shrink-0 mt-0.5" size={20} />}
            <div className="text-xs space-y-1">
              <p className="font-bold">
                {status.enabled
                  ? t("Seva ya RADIUS imewashwa na kusanidiwa.", "RADIUS server is enabled and configured.")
                  : t("Seva ya RADIUS bado haijawashwa kwenye backend.", "RADIUS server is not yet enabled on the backend.")}
              </p>
              {status.enabled ? (
                <p>
                  {t("Elekeza vifaa kwa", "Point devices to")} <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono">{status.serverHost || "your-radiusserver"}</code>{" "}
                  {t("kwenye bandari ya uthibitishaji", "on auth port")} <code className="font-mono">{status.authenticationPort}</code>{" "}
                  {t("na bandari ya uhasibu", "and accounting port")} <code className="font-mono">{status.accountingPort}</code>,{" "}
                  {t("itifaki", "protocol")} <code className="font-mono">{status.authenticationProtocol}</code>.
                </p>
              ) : (
                <p>
                  {t(
                    "Weka RADIUS_ENABLED=true, RADIUS_SERVER_HOST, na RADIUS_REST_SHARED_SECRET kwenye .env ya backend, kisha endesha FreeRADIUS kutoka poafi-radius/. Vifaa vitakavyoongezwa hapa chini vitaanza kuthibitisha mara moja seva ikiwashwa.",
                    "Set RADIUS_ENABLED=true, RADIUS_SERVER_HOST, and RADIUS_REST_SHARED_SECRET in the backend .env, then deploy the FreeRADIUS container from poafi-radius/. Devices added below will start authenticating once the server is up."
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 flex items-center gap-3 text-sm">
          <XCircle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-4 flex items-center gap-3 text-sm">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* One-time credentials reveal */}
      {newCreds && (
        <div className="bg-[#00f3ff]/5 border-2 border-[#00f3ff]/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound className="text-[#00f3ff] shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-lg text-white">{t("Hifadhi taarifa hizi sasa", "Save these credentials now")}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {t(
                  "Siri ya pamoja (Shared secret) haitaonyeshwa tena. Ukiipoteza, izungushe upya kwenye orodha ya vifaa hapa chini.",
                  "The shared secret will not be shown again. If you lose it, rotate it from the device list below."
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-black/40 rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{t("Siri ya Pamoja (Shared Secret)", "Shared Secret")}</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[#00f3ff] text-sm break-all">{newCreds.sharedSecret}</code>
                <button onClick={() => handleCopy("secret", newCreds.sharedSecret)} className="p-1.5 rounded-lg hover:bg-white/10">
                  {copiedField === "secret" ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{t("Seva", "Server")}</span>
              <p className="font-mono text-sm text-white">{newCreds.configuration.authenticationServer}</p>
              <p className="text-[10px] text-gray-500">
                Auth: {newCreds.configuration.authenticationPort} · Acct: {newCreds.configuration.accountingPort} · {newCreds.configuration.authenticationProtocol}
              </p>
            </div>
          </div>
          <button onClick={() => setNewCreds(null)} className="text-xs text-gray-400 hover:text-white underline">
            {t("Nimehifadhi siri — funga", "I have saved the secret — dismiss")}
          </button>
        </div>
      )}

      {/* Add device form */}
      {showForm && (
        <form onSubmit={handleAdd} className="glass-panel p-6 space-y-4 rounded-2xl">
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <Server size={18} className="text-[#00f3ff]" /> {t("Sajili kifaa kipya cha RADIUS", "Register a new RADIUS device")}
          </h2>

          {isSuperAdmin && (
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Mwendeshaji (Tenant)", "Operator (tenant)")}</label>
              <select
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
                required
              >
                <option value="" disabled>{t("Chagua mwendeshaji...", "Select operator...")}</option>
                {tenants.map(tenant => (<option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.slug})</option>))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Jina la Kifaa", "Device Name")}</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("mfano: Arusha Omada Gateway", "e.g. Arusha Omada Gateway")}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("IPv4 ya Umma (NAS IP)", "Public IPv4 (NAS IP)")}</label>
              <input
                required
                value={formData.nasname}
                onChange={(e) => setFormData({ ...formData, nasname: e.target.value })}
                placeholder={t("mfano: 203.0.113.5", "e.g. 203.0.113.5")}
                pattern="^(\d{1,3}\.){3}\d{1,3}$"
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                {t("IP ya umma ambayo FreeRADIUS huona kama chanzo cha maombi ya uthibitishaji.", "The public IP that FreeRADIUS sees as the source of auth packets.")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Mtengenezaji", "Vendor")}</label>
              <select
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
              >
                <option value="GENERIC">{t("Kawaida / Nyingine", "Generic / other")}</option>
                <option value="TPLINK_OMADA">TP-Link Omada</option>
                <option value="UBIQUITI_UNIFI">Ubiquiti UniFi</option>
                <option value="RUIJIE">Ruijie Reyee</option>
                <option value="GRANDSTREAM">Grandstream GWN</option>
                <option value="MIKROTIK">{t("MikroTik (Hali ya RADIUS)", "MikroTik (RADIUS mode)")}</option>
                <option value="CISCO">Cisco</option>
                <option value="ARUBA">Aruba</option>
                <option value="RUCKUS">Ruckus</option>
                <option value="HUAWEI">Huawei</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Modeli (si lazima)", "Model (optional)")}</label>
              <input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder={t("mfano: EAP670", "e.g. EAP670")}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
              />
            </div>
          </div>

          {routers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Unganisha na Router (si lazima)", "Link to Router (optional)")}</label>
              <select
                value={formData.routerId}
                onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
              >
                <option value="">{t("Usiunganishe", "Do not link")}</option>
                {routers.map(r => (<option key={r.id} value={r.id}>{r.name} ({r.host})</option>))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Maelezo (si lazima)", "Notes (optional)")}</label>
            <input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t("mfano: Kifaa cha 5GHz Mlimani City", "e.g. 5GHz gateway at Mlimani City")}
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {creating ? t("Inaunda...", "Creating...") : t("Sajili kifaa cha RADIUS", "Create RADIUS device")}
          </button>
        </form>
      )}

      {/* Devices list */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Server size={18} className="text-[#00f3ff]" /> {t("Vifaa vya RADIUS Vilivyosajiliwa", "Registered RADIUS devices")} ({clients.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t("Inapakia...", "Loading...")}</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {t("Hakuna vifaa vya RADIUS vilivyosajiliwa bado. Bonyeza \"Ongeza Kifaa cha RADIUS\" kuanza.", "No RADIUS devices registered yet. Click \"Add RADIUS Device\" above to start.")}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {clients.map((c) => (
              <div key={c.id} className="p-4 flex flex-col md:flex-row justify-between gap-3 hover:bg-white/[0.02]">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white">{c.name}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{c.vendor}</span>
                    {c.isActive ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">{t("Inafanya Kazi", "Active")}</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">{t("Imezimwa", "Disabled")}</span>
                    )}
                    {c.tenant && isSuperAdmin && (
                      <span className="text-[10px] text-gray-500">{c.tenant.name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">
                    {c.nasname}
                    {c.model && <span className="text-gray-500"> · {c.model}</span>}
                    {c.router && <span className="text-gray-500"> · {c.router.name}</span>}
                  </p>
                  {c.description && <p className="text-xs text-gray-500 italic">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRotate(c.id)}
                    className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} /> {t("Badili Siri", "Rotate")}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> {t("Futa", "Delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-[#00f3ff]" /> {t("Vikao vya RADIUS Vilivyo Hewani", "Active RADIUS sessions")} ({sessions.length})
          </h2>
          <button
            onClick={loadAll}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10"
          >
            <RefreshCw size={12} /> {t("Sasisha", "Refresh")}
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t("Inapakia...", "Loading...")}</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {t("Hakuna kikao hewani kwa sasa. Mteja akithibitisha vocha ataonekana hapa.", "No active sessions. Once a device authenticates a voucher, sessions appear here.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">{t("Mtumiaji", "User")}</th>
                  <th className="p-3">NAS</th>
                  <th className="p-3">{t("Hali", "Status")}</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">{t("Muda Hewani", "Uptime")}</th>
                  <th className="p-3">{t("Matumizi", "Traffic")}</th>
                  <th className="p-3">{t("Sasisho la Mwisho", "Last Update")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="p-3 font-mono text-[#00f3ff]">{s.username}</td>
                    <td className="p-3 text-gray-300">{s.nas.name}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === "START" ? "bg-green-500/20 text-green-300" : s.status === "STOP" ? "bg-gray-500/20 text-gray-300" : "bg-blue-500/20 text-blue-300"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-gray-300">{s.framedIpAddress || "—"}</td>
                    <td className="p-3 text-gray-300">{formatDuration(s.sessionTimeSeconds)}</td>
                    <td className="p-3 text-gray-400 font-mono">
                      ↓ {formatBytes(s.inputOctets)} / ↑ {formatBytes(s.outputOctets)}
                    </td>
                    <td className="p-3 text-gray-500">{new Date(s.lastUpdatedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help note */}
      <div className="glass-panel p-4 rounded-xl border border-white/10 flex gap-3 items-start">
        <Info className="text-[#00f3ff] shrink-0 mt-0.5" size={18} />
        <div className="text-xs text-gray-300 space-y-1">
          <p className="font-semibold text-white">{t("Jinsi RADIUS inavyofanya kazi katika PoaFi", "How RADIUS works in PoaFi")}</p>
          <p>
            {t(
              "Kila kifaa unachoongeza hapa husajiliwa kama NAS (Network Access Server). Mteja anapoingiza vocha kwenye captive portal ya kifaa, kifaa hutuma Access-Request kwa FreeRADIUS. PoaFi huthibitisha vocha, kuiweka ACTIVE, na kurudisha mipaka ya kasi na muda wa matumizi. Pakiti za uhasibu husasisha matumizi moja kwa moja.",
              "Each device you add here is registered as a NAS (Network Access Server). When a customer enters a voucher on the device's captive portal, the device sends an Access-Request to FreeRADIUS. PoaFi validates the voucher, marks it ACTIVE, and returns bandwidth and session-time attributes. Accounting packets from the device update usage in real time."
            )}
          </p>
          <p className="text-gray-500">
            {t(
              "Vifaa lazima viwe na IPv4 ya umma inayofikiwa na seva yako ya FreeRADIUS. Kwa waendeshaji walio nyuma ya NAT/CGNAT, tumia WireGuard kukipa kifaa anwani inayofikika kabla ya kukisajili hapa.",
              "Devices must have a stable public IPv4 reachable by your FreeRADIUS server. For operators behind NAT/CGNAT, use WireGuard to give the device a routable address before registering it here."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}