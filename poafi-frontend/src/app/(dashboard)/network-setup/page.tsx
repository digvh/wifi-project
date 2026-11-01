"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Copy, Network, RefreshCw, ShieldCheck, Trash2, RotateCw, AlertTriangle, CheckCircle2 } from "lucide-react";

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
  routerId?: string | null;
  vendor: string;
  model?: string | null;
  name: string;
  nasname: string;
  description?: string | null;
  isActive: boolean;
  tenant?: { name: string; slug: string };
  router?: { id: string; name: string } | null;
  createdAt: string;
};

type RouterItem = { id: string; name: string; vendor: string; host: string };
type TenantItem = { id: string; name: string; slug: string };

const VENDORS = [
  { value: "MIKROTIK", label: "MikroTik" },
  { value: "TP_LINK_OMADA", label: "TP-Link Omada" },
  { value: "RUIJIE_REYEE", label: "Ruijie / Reyee" },
  { value: "UBIQUITI_UNIFI", label: "Ubiquiti UniFi" },
  { value: "GRANDSTREAM", label: "Grandstream" },
  { value: "CUDY", label: "Cudy" },
  { value: "COMFAST", label: "Comfast" },
  { value: "WAVLINK", label: "Wavlink" },
  { value: "OTHER_RADIUS", label: "Other RADIUS-compatible equipment" },
];

export default function NetworkSetupPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "PLATFORM_ADMIN";

  const [status, setStatus] = useState<RadiusStatus | null>(null);
  const [clients, setClients] = useState<RadiusClient[]>([]);
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [vendor, setVendor] = useState("MIKROTIK");
  const [model, setModel] = useState("");
  const [name, setName] = useState("");
  const [nasname, setNasname] = useState("");
  const [routerId, setRouterId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [oneTimeSecret, setOneTimeSecret] = useState("");
  const [oneTimeConfig, setOneTimeConfig] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusData, clientsData, routersData] = await Promise.all([
        apiFetch("/radius/status"),
        apiFetch("/radius/clients" + (isPlatformAdmin && tenantId ? "?tenantId=" + encodeURIComponent(tenantId) : "")),
        apiFetch("/routers"),
      ]);
      setStatus(statusData);
      setClients(clientsData.clients || []);
      setRouters(routersData.routers || []);

      if (isPlatformAdmin) {
        const tenantData = await apiFetch("/tenants");
        const loadedTenants = tenantData.tenants || [];
        setTenants(loadedTenants);
        if (!tenantId && loadedTenants.length) setTenantId(loadedTenants[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Could not load network setup");
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const createClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setOneTimeSecret("");
    setOneTimeConfig(null);
    try {
      const payload: any = {
        vendor,
        model: model.trim() || null,
        name: name.trim(),
        nasname: nasname.trim(),
        routerId: routerId || null,
        description: description.trim() || null,
      };
      if (isPlatformAdmin) payload.tenantId = tenantId;
      const result = await apiFetch("/radius/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOneTimeSecret(result.sharedSecret);
      setOneTimeConfig(result.configuration);
      setNotice(result.message || "Network device registered");
      setName("");
      setNasname("");
      setModel("");
      setDescription("");
      setRouterId("");
      await load();
    } catch (err: any) {
      setError(err.message || "Could not register the network device");
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard");
    } catch {
      setError("Clipboard access failed. Select and copy the value manually.");
    }
  };

  const toggleClient = async (client: RadiusClient) => {
    setError("");
    try {
      await apiFetch("/radius/clients/" + client.id, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !client.isActive }),
      });
      setNotice(client.isActive ? "Network device disabled" : "Network device enabled");
      await load();
    } catch (err: any) {
      setError(err.message || "Could not update network device");
    }
  };

  const rotateSecret = async (client: RadiusClient) => {
    if (!confirm("Rotate the shared secret for " + client.name + "? The device will stop authenticating until you update its RADIUS settings.")) return;
    setError("");
    setOneTimeSecret("");
    try {
      const result = await apiFetch("/radius/clients/" + client.id + "/rotate-secret", { method: "POST" });
      setOneTimeSecret(result.sharedSecret);
      setOneTimeConfig({ authenticationServer: status?.serverHost || "YOUR_RADIUS_HOST", authenticationPort: 1812, accountingServer: status?.serverHost || "YOUR_RADIUS_HOST", accountingPort: 1813, authenticationProtocol: "PAP" });
      setNotice(result.message);
    } catch (err: any) {
      setError(err.message || "Could not rotate shared secret");
    }
  };

  const deleteClient = async (client: RadiusClient) => {
    if (!confirm("Delete " + client.name + " from the RADIUS client list? This device will no longer be able to authenticate vouchers.")) return;
    try {
      await apiFetch("/radius/clients/" + client.id, { method: "DELETE" });
      setNotice("Network device removed");
      await load();
    } catch (err: any) {
      setError(err.message || "Could not remove network device");
    }
  };

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Internet Access Setup</h1>
          <p className="text-sm text-gray-400 mt-1">Connect compatible hotspot equipment to PoaFi, then create packages and sell internet vouchers.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 flex items-center gap-2"><AlertTriangle size={18}/>{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 size={18}/>{notice}</div>}

      <div className="glass-panel rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[#00f3ff]" size={21}/>
          <h2 className="font-semibold text-lg">PoaFi shared authentication service</h2>
        </div>
        {loading ? <p className="text-sm text-gray-400">Checking service status...</p> : (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm text-gray-300">RADIUS service: <strong className={status?.enabled ? "text-emerald-400" : "text-amber-400"}>{status?.enabled ? "Enabled" : "Not enabled"}</strong></p>
              <p className="text-xs text-gray-500 mt-1">Authentication UDP {status?.authenticationPort || 1812} · Accounting UDP {status?.accountingPort || 1813} · PAP voucher login</p>
            </div>
            <p className="text-xs text-gray-400">{status?.serverHost || "RADIUS server address is not configured yet"}</p>
          </div>
        )}
        {!status?.enabled && !loading && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-200">
            The RADIUS service must first be deployed and enabled by the PoaFi administrator. Registering a device here does not open the RADIUS ports or install the server.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="glass-panel rounded-xl p-5 xl:col-span-2 h-fit">
          <h2 className="font-semibold text-lg mb-1 flex items-center gap-2"><Network size={19} className="text-[#00f3ff}"/> Connect network equipment</h2>
          <p className="text-xs text-gray-400 mb-5">Choose the equipment brand, then register the address from which it sends RADIUS requests.</p>
          <form onSubmit={createClient} className="space-y-4">
            {isPlatformAdmin && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Operator</label>
                <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} required className="w-full rounded-lg bg-[#0a0a1a] border border-white/10 p-3 text-sm text-white">
                  <option value="">Select Operator</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Equipment manufacturer</label>
              <select value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full rounded-lg bg-[#0a0a1a] border border-white/10 p-3 text-sm text-white">
                {VENDORS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Exact model (optional)</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. hAP ax3, ER605, RG-EG..." className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Network device name</label>
              <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Office Gateway" className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">RADIUS client IPv4 address</label>
              <input required value={nasname} onChange={(e) => setNasname(e.target.value)} placeholder="e.g. 41.x.x.x" className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white"/>
              <p className="text-[11px] text-gray-500 mt-1">Enter the fixed public/VPN source IP that the RADIUS server sees, not necessarily the router's private management IP.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Link to a registered PoaFi router (optional)</label>
              <select value={routerId} onChange={(e) => setRouterId(e.target.value)} className="w-full rounded-lg bg-[#0a0a1a] border border-white/10 p-3 text-sm text-white">
                <option value="">No linked router record</option>
                {routers.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.vendor} · {r.host}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Site / branch / installation notes" className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white"/>
            </div>
            <button type="submit" disabled={saving || (isPlatformAdmin && !tenantId)} className="w-full rounded-lg bg-[#00f3ff] text-black font-bold py-3 disabled:opacity-50">
              {saving ? "Registering..." : "Register network equipment"}
            </button>
          </form>
        </div>

        <div className="glass-panel rounded-xl p-5 xl:col-span-3 space-y-4">
          <h2 className="font-semibold text-lg">Registered equipment ({clients.length})</h2>
          {loading ? <p className="text-sm text-gray-400">Loading devices...</p> : clients.length === 0 ? (
            <p className="text-sm text-gray-400">No RADIUS-enabled equipment registered yet.</p>
          ) : clients.map((client) => (
            <div key={client.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="font-semibold">{client.name} <span className="text-xs text-gray-400">· {client.vendor}</span></div>
                <div className="text-xs text-gray-400 mt-1">{client.model || "Model not specified"} · RADIUS source: {client.nasname}</div>
                {isPlatformAdmin && client.tenant && <div className="text-xs text-gray-500 mt-1">Operator: {client.tenant.name}</div>}
                <div className="text-xs mt-2">
                  <span className={client.isActive ? "text-emerald-400" : "text-amber-400"}>{client.isActive ? "Enabled" : "Disabled"}</span>
                  {client.router && <span className="text-gray-500"> · Linked router: {client.router.name}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => rotateSecret(client)} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1"><RotateCw size={13}/> Rotate secret</button>
                <button onClick={() => toggleClient(client)} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10">{client.isActive ? "Disable" : "Enable"}</button>
                <button onClick={() => deleteClient(client)} className="text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300"><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {oneTimeSecret && oneTimeConfig && (
        <div className="glass-panel rounded-xl border border-emerald-500/30 p-5 space-y-4">
          <h2 className="text-lg font-bold text-emerald-300">Save this RADIUS configuration now</h2>
          <p className="text-sm text-gray-300">The shared secret is displayed only once. Copy it and enter it into the equipment's RADIUS settings. Do not send it to anyone.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg bg-black/20 p-3"><label className="text-xs text-gray-500">Authentication server</label><div className="font-mono break-all">{oneTimeConfig.authenticationServer}</div><div className="text-xs text-gray-400">UDP {oneTimeConfig.authenticationPort}</div></div>
            <div className="rounded-lg bg-black/20 p-3"><label className="text-xs text-gray-500">Accounting server</label><div className="font-mono break-all">{oneTimeConfig.accountingServer}</div><div className="text-xs text-gray-400">UDP {oneTimeConfig.accountingPort}</div></div>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <label className="text-xs text-gray-500">Shared secret · {oneTimeConfig.authenticationProtocol}</label>
            <div className="font-mono break-all text-sm mt-1">{oneTimeSecret}</div>
            <button onClick={() => copyText(oneTimeSecret)} className="mt-3 px-3 py-2 bg-white/10 rounded-lg text-sm flex items-center gap-2"><Copy size={14}/> Copy shared secret</button>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-100">
            This registers the device with PoaFi. On the router/controller, enable its hotspot captive portal, configure RADIUS PAP and accounting, and use WISPr bandwidth attributes if the device supports them. Otherwise map the PoaFi Filter-Id to a local bandwidth profile. Compatibility depends on the exact model and firmware.
          </div>
          <button onClick={() => { setOneTimeSecret(""); setOneTimeConfig(null); }} className="text-sm text-gray-400 underline">I have saved the secret</button>
        </div>
      )}

      <div className="glass-panel rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">How an Operator starts selling internet</h2>
        <ol className="list-decimal ml-5 space-y-2 text-sm text-gray-300">
          <li>Register compatible equipment and configure its captive portal to use PoaFi RADIUS.</li>
          <li>Create internet packages in <strong>My Packages</strong>.</li>
          <li>Generate voucher batches in <strong>My Vouchers</strong>, or configure mobile-money checkout after payment integration is approved.</li>
          <li>Customers connect to the Wi-Fi network and enter their voucher in the equipment's hotspot login page.</li>
          <li>The equipment asks PoaFi to authenticate the voucher. PoaFi starts the voucher timer on the first successful RADIUS login and records accounting updates.</li>
        </ol>
        <p className="text-xs text-amber-300">Important: this shared integration works only with equipment that supports external RADIUS PAP hotspot authentication and accounting. It does not automatically configure SSIDs, VLANs, radio settings, captive-portal redirects or vendor-specific speed shaping. Test with one device and a disposable voucher first.</p>
      </div>
    </div>
  );
}
