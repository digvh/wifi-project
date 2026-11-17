"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Wifi, Server, ShieldAlert, CheckCircle2, Trash2, Users, RefreshCw, Cloud, Copy, X, Building2, Zap, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const VENDORS = [
  { value: "MIKROTIK", label: "MikroTik (RouterOS Live API)", defaultPort: 8728 },
  { value: "TPLINK_OMADA", label: "TP-Link Omada SDN (Live Controller API + RADIUS)", defaultPort: 8043 },
  { value: "RUIJIE", label: "Ruijie / Reyee (RADIUS / Cloud Planned)", defaultPort: 443 },
  { value: "UBIQUITI_UNIFI", label: "Ubiquiti UniFi (RADIUS / Controller Planned)", defaultPort: 443 },
  { value: "CUDY", label: "Cudy (RADIUS / AP Only)", defaultPort: 80 },
  { value: "COMFAST", label: "Comfast (RADIUS / AP Only)", defaultPort: 80 },
  { value: "WAVLINK", label: "Wavlink (RADIUS / AP Only)", defaultPort: 80 },
  { value: "GENERIC", label: "Other / RADIUS Only", defaultPort: 80 },
];

export default function RoutersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [routers, setRouters] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [deviceModels, setDeviceModels] = useState<any[]>([]);
  const [filterTenantId, setFilterTenantId] = useState("");

  const [formData, setFormData] = useState({
    tenantId: "", 
    siteId: "", 
    deviceModelId: "", 
    name: "", 
    host: "", 
    apiPort: 8728, 
    username: "", 
    password: "", 
    vendor: "MIKROTIK",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  // Cloud Setup Modal State
  const [cloudModal, setCloudModal] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [setupRequestId, setSetupRequestId] = useState<string | null>(null);
  const [appliedPrefill, setAppliedPrefill] = useState(false);

  // Quick Setup (zero-touch enrollment) state
  const [enroll, setEnroll] = useState<any>(null);
  const [enrollStatus, setEnrollStatus] = useState<any>(null);
  const [enrollName, setEnrollName] = useState("");
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollResult, setEnrollResult] = useState<any>(null);
  const [omadaDiscovering, setOmadaDiscovering] = useState(false);
  const [omadaDiscovery, setOmadaDiscovery] = useState<any>(null);

  const handleDiscoverOmada = async () => {
    setError(""); setSuccess(""); setOmadaDiscovery(null);
    if (!formData.host || !formData.username || !formData.password) {
      setError("Enter the Omada Controller host/IP, username and password first, then click Discover.");
      return;
    }
    setOmadaDiscovering(true);
    try {
      const res = await apiFetch("/routers/discover/omada", {
        method: "POST",
        body: JSON.stringify({
          host: formData.host,
          port: formData.apiPort || 8043,
          username: formData.username,
          password: formData.password,
        }),
      });
      setOmadaDiscovery(res.discovery);
      setFormData((prev) => ({
        ...prev,
        vendor: "TPLINK_OMADA",
        name: res.discovery?.suggestedName || prev.name,
      }));
      setSuccess(res.message || "Omada Controller discovered and form auto-filled!");
    } catch (err: any) {
      setError(err.message || "Failed to connect to Omada Controller");
    } finally {
      setOmadaDiscovering(false);
    }
  };

  const startEnrollment = async () => {
    setError(""); setSuccess("");
    if (isSuperAdmin && !formData.tenantId) {
      setError("Select an Operator first, then press Quick Setup.");
      return;
    }
    setEnrollBusy(true);
    try {
      const res = await apiFetch("/routers/enrollment/start", {
        method: "POST",
        body: JSON.stringify({ tenantId: formData.tenantId || undefined, siteId: formData.siteId || undefined }),
      });
      setEnroll(res);
      setEnrollStatus({ setupStatus: "AWAITING_ENROLLMENT", discovered: null });
      setEnrollName("");
      setEnrollResult(null);
    } catch (err: any) { setError(err.message); } finally { setEnrollBusy(false); }
  };

  // Poll the server until the router phones home, then auto-fill the form
  useEffect(() => {
    if (!enroll?.routerId) return;
    if (enrollStatus?.setupStatus !== "AWAITING_ENROLLMENT") return;
    const timer = setInterval(async () => {
      try {
        const s = await apiFetch(`/routers/${enroll.routerId}/enrollment-status`);
        setEnrollStatus(s);
        if (s.setupStatus === "DISCOVERED" && s.discovered) {
          setEnrollName((prev) => prev || s.discovered.identity || "");
        }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(timer);
  }, [enroll?.routerId, enrollStatus?.setupStatus]);

  const confirmEnrollment = async () => {
    if (!enroll) return;
    setEnrollBusy(true); setError("");
    try {
      const res = await apiFetch(`/routers/${enroll.routerId}/confirm-enrollment`, {
        method: "POST",
        body: JSON.stringify({
          name: enrollName,
          siteId: formData.siteId || undefined,
          setupRequestId: setupRequestId || undefined,
        }),
      });
      setEnrollResult(res);
      setSetupRequestId(null);
      fetchData(filterTenantId);
    } catch (err: any) { setError(err.message); } finally { setEnrollBusy(false); }
  };

  const closeEnroll = () => { setEnroll(null); setEnrollStatus(null); setEnrollResult(null); fetchData(filterTenantId); };

  const fetchData = async (tenantFilter?: string) => {
    try {
      const routerQuery = tenantFilter ? `?tenantId=${tenantFilter}` : "";
      const calls: Promise<any>[] = [
        apiFetch(`/routers${routerQuery}`),
        apiFetch("/device-catalog"),
      ];

      if (isSuperAdmin) {
        calls.push(apiFetch("/tenants"));
      }

      const [routersRes, catRes, tenantsRes] = await Promise.all(calls);
      const loadedRouters = routersRes.routers || [];
      const loadedDevices = catRes.devices || [];

      setRouters(loadedRouters);
      setDeviceModels(loadedDevices);

      if (tenantsRes?.tenants) {
        setTenants(tenantsRes.tenants);
        if (tenantsRes.tenants.length > 0 && !formData.tenantId) {
          const firstTenantId = tenantsRes.tenants[0].id;
          setFormData(prev => ({ ...prev, tenantId: firstTenantId }));
          loadSitesForTenant(firstTenantId);
        }
      } else {
        loadSitesForTenant();
      }
    } catch (err: any) { 
      setError(err.message); 
    }
  };

  const loadSitesForTenant = async (tId?: string) => {
    try {
      const query = tId ? `?tenantId=${tId}` : "";
      const sitesRes = await apiFetch(`/sites${query}`);
      const loadedSites = sitesRes.sites || [];
      setSites(loadedSites);

      if (loadedSites.length > 0) {
        setFormData(prev => ({
          ...prev,
          siteId: loadedSites[0].id,
          name: prev.name || `${loadedSites[0].name.replace(" (Main Site)", "")} Hotspot`
        }));
      } else {
        setFormData(prev => ({ ...prev, siteId: "" }));
      }
    } catch (err: any) {
      console.warn("Could not load sites:", err.message);
    }
  };

  useEffect(() => { 
    fetchData(filterTenantId); 
  }, [user, filterTenantId]);

  // Support deep-link prefill from Device Setup ("Register this device" button)
  useEffect(() => {
    if (appliedPrefill || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const reqTenant = params.get("tenantId");
    const reqName = params.get("name");
    const reqVendor = params.get("vendor");
    const reqSetupId = params.get("setupRequestId");
    if (!reqTenant && !reqName && !reqVendor && !reqSetupId) return;

    setAppliedPrefill(true);
    if (reqSetupId) setSetupRequestId(reqSetupId);
    setFormData((prev) => ({
      ...prev,
      tenantId: reqTenant || prev.tenantId,
      name: reqName || prev.name,
      vendor: reqVendor && VENDORS.some((v) => v.value === reqVendor) ? reqVendor : prev.vendor,
    }));
    if (reqTenant) {
      loadSitesForTenant(reqTenant);
    }
  }, [appliedPrefill, tenants]);

  const handleTenantChange = (tId: string) => {
    setFormData(prev => ({ ...prev, tenantId: tId }));
    loadSitesForTenant(tId);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); 
    setSuccess("");
    try {
      await apiFetch("/routers", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          setupRequestId: setupRequestId || undefined,
        }),
      });
      setSuccess(
        setupRequestId
          ? "Router added and linked to Setup Request (marked CONFIGURED)!"
          : "Router added successfully!"
      );
      setSetupRequestId(null);
      setFormData(prev => ({ ...prev, name: "", host: "", username: "", password: "" }));
      fetchData(filterTenantId);
    } catch (err: any) { setError(err.message); }
  };

  const handleTest = async (id: string) => {
    setTestingId(id); setError(""); setSuccess("");
    try {
      const res = await apiFetch(`/routers/${id}/test`, { method: "POST" });
      setSuccess(`Connected to ${res.data.identity || "Router"} (${res.data.version || ""})`);
      fetchData(filterTenantId);
    } catch (err: any) { setError(err.message); fetchData(filterTenantId); } finally { setTestingId(null); }
  };

  const handleCloudSetup = async (id: string) => {
    setError(""); setSuccess("");
    try {
      const res = await apiFetch(`/routers/${id}/cloud-setup`, { method: "POST" });
      setCloudModal(res);
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this router?")) return;
    try {
      await apiFetch(`/routers/${id}`, { method: "DELETE" });
      setSuccess("Router deleted"); 
      fetchData(filterTenantId);
    } catch (err: any) { setError(err.message); }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto relative pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Server className="text-[#00f3ff] w-8 h-8" />
            <span>Network Gateways & Routers</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Register MikroTik, Omada, UniFi, or Ruijie devices.</p>
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

      {error && <div className="text-red-400 bg-red-500/10 p-4 rounded-xl flex items-center gap-2"><ShieldAlert size={18}/> {error}</div>}
      {success && <div className="text-green-400 bg-green-500/10 p-4 rounded-xl flex items-center gap-2"><CheckCircle2 size={18}/> {success}</div>}
      {setupRequestId && (
        <div className="bg-[#00f3ff]/10 border border-[#00f3ff]/30 text-[#00f3ff] p-3.5 rounded-xl text-xs flex items-center justify-between gap-3">
          <span>
            🔗 Creating or confirming a router now will automatically link it to Device Setup Request and mark it <strong>CONFIGURED</strong>.
          </span>
          <button
            type="button"
            onClick={() => setSetupRequestId(null)}
            className="text-white/70 hover:text-white underline shrink-0"
          >
            Unlink
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Router Form */}
        <div className="glass-panel p-6 lg:col-span-1 h-fit rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
            <Server size={20} className="text-[#00f3ff]" /> Add Gateway
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="p-3 rounded-xl border border-[#9d00ff]/30 bg-[#9d00ff]/5 space-y-2">
              <p className="text-[11px] text-gray-300">
                <strong className="text-white">Quick Setup (MikroTik):</strong> no typing needed. PoaFi gives you one script; paste it in the router and the form fills itself.
              </p>
              <button
                type="button"
                onClick={startEnrollment}
                disabled={enrollBusy}
                className="w-full bg-[#9d00ff]/20 hover:bg-[#9d00ff]/30 border border-[#9d00ff]/50 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap size={14} /> {enrollBusy ? "Preparing..." : "Quick Setup (Auto-Enroll Router)"}
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-500">— or add manually —</p>
            {isSuperAdmin && (
              <div className="space-y-1">
                <label className="text-[11px] text-[#00f3ff] font-bold flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>Chagua Operator wa Kumsaidia / Select Operator: *</span>
                </label>
                <select
                  required
                  value={formData.tenantId}
                  onChange={e => handleTenantChange(e.target.value)}
                  className="w-full bg-[#0a0a1a] border border-[#00f3ff]/40 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                >
                  <option value="">-- Chagua Operator / Select Operator --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      🏢 {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {sites.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 font-medium">Physical Site / Eneo (Auto-selected):</label>
                <select
                  value={formData.siteId}
                  onChange={e => setFormData({ ...formData, siteId: e.target.value })}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>
                      📍 {s.name} ({s.address || "Main"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">Device Brand / Vendor</label>
              <select 
                value={formData.vendor} 
                onChange={e => {
                  const chosen = VENDORS.find(v => v.value === e.target.value);
                  setOmadaDiscovery(null);
                  setFormData({...formData, vendor: e.target.value, apiPort: chosen?.defaultPort || formData.apiPort});
                }} 
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
              >
                {VENDORS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>

            {formData.vendor === "TPLINK_OMADA" && (
              <div className="p-3 rounded-xl border border-[#00f3ff]/30 bg-[#00f3ff]/5 space-y-2">
                <p className="text-[11px] text-gray-300">
                  <strong className="text-white">Omada Controller Auto-Fill:</strong> enter Controller IP/host, username &amp; password below, then click Discover to pull site &amp; device info.
                </p>
                <button
                  type="button"
                  onClick={handleDiscoverOmada}
                  disabled={omadaDiscovering}
                  className="w-full bg-[#00f3ff]/15 hover:bg-[#00f3ff]/25 border border-[#00f3ff]/40 text-[#00f3ff] font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Zap size={13} /> {omadaDiscovering ? "Connecting to Omada..." : "Discover from Omada Controller (Auto-Fill)"}
                </button>
                {omadaDiscovery && (
                  <div className="text-[11px] text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg p-2 space-y-1">
                    <p className="font-semibold">Controller v{omadaDiscovery.controllerVer} · {omadaDiscovery.sites?.length || 0} site(s) · {omadaDiscovery.devices?.length || 0} device(s)</p>
                    {omadaDiscovery.devices?.length > 0 && (
                      <p className="text-gray-300 font-mono truncate">
                        Devices: {omadaDiscovery.devices.map((d: any) => `${d.name} (${d.model})`).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">Router Name</label>
              <input 
                required 
                placeholder="e.g. Arusha Central Hotspot" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]" 
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[11px] text-gray-400 font-medium block mb-1">IP Address or Hostname</label>
                <input 
                  required 
                  placeholder="e.g. 192.168.88.1 or cloud.domain.com" 
                  value={formData.host} 
                  onChange={e => setFormData({...formData, host: e.target.value})} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]" 
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">API Port</label>
                <input 
                  required 
                  type="number"
                  min={1}
                  max={65535}
                  value={formData.apiPort} 
                  onChange={e => setFormData({...formData, apiPort: parseInt(e.target.value) || 8728})} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff] font-mono" 
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">Router Admin Username</label>
              <input 
                required 
                placeholder="Username (e.g. admin)" 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]" 
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">Router Password</label>
              <input 
                required 
                type="password" 
                placeholder="Password" 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]" 
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm transition-opacity hover:opacity-90 shadow-lg shadow-[#00f3ff]/20"
            >
              Save Gateway
            </button>
          </form>
        </div>

        {/* Routers List */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-4 rounded-2xl border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Registered Devices ({routers.length})</h2>
            <button onClick={() => fetchData(filterTenantId)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {routers.length === 0 ? (
            <p className="text-gray-400 text-xs p-4">No routers registered yet.</p>
          ) : (
            routers.map(r => (
              <div key={r.id} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{r.name}</h3>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-[#00f3ff] font-semibold">{r.vendor}</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{r.host}:{r.apiPort} {r.wgIp && `(Tunnel: ${r.wgIp})`}</p>

                  {/* Show Operator Name for Admin */}
                  {r.tenant && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-300 pt-1">
                      <Building2 size={13} className="text-[#00f3ff]" />
                      <span>Operator:</span>
                      <strong className="text-white">{r.tenant.name}</strong>
                      <code className="text-[#00f3ff] text-[10px] bg-black/40 px-1 rounded">{r.tenant.slug}</code>
                    </div>
                  )}

                  {r.site && (
                    <p className="text-xs text-gray-400">📍 Site: {r.site.name}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${r.status === 'ONLINE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {r.status}
                  </span>
                  
                  {r.vendor === 'MIKROTIK' && (
                    <button onClick={() => handleCloudSetup(r.id)} className="bg-[#00f3ff]/10 text-[#00f3ff] hover:bg-[#00f3ff]/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-[#00f3ff]/30 transition-colors">
                      <Cloud size={14} /> Cloud Setup
                    </button>
                  )}
                  
                  <button onClick={() => handleTest(r.id)} disabled={testingId === r.id} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                    {testingId === r.id ? "Testing..." : "Test"}
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Setup (Auto-Enroll) Modal */}
      {enroll && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0a0a1a] border border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Zap className="text-[#9d00ff]" /> Quick Setup: Auto-Enroll Router</h2>
              <button onClick={closeEnroll} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            {!enroll.callbackConfigured && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-lg">
                <strong>PUBLIC_API_URL is not set</strong> in the backend .env. Set it to the public HTTPS address of this API (e.g. https://api.poafi.com) and start again, otherwise the router cannot report back.
              </div>
            )}

            {enrollStatus?.setupStatus === "AWAITING_ENROLLMENT" && (
              <>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Open WinBox and connect to the MikroTik.</li>
                  <li>Open <strong>New Terminal</strong>, paste the script below and press Enter.</li>
                  <li>Keep this window open. The form fills itself within seconds.</li>
                </ol>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-300">Router Script</label>
                    <button onClick={() => handleCopy(enroll.script, "enroll")} className="text-xs text-[#00f3ff] flex items-center gap-1">
                      {copied === "enroll" ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied === "enroll" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="bg-black/60 p-4 rounded-xl text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap border border-white/10 max-h-64">{enroll.script}</pre>
                </div>
                {isSuperAdmin && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-gray-300">PoaFi Server Peer Config (admin)</label>
                      <button onClick={() => handleCopy(enroll.serverConfig, "enrollserver")} className="text-xs text-[#00f3ff] flex items-center gap-1">
                        {copied === "enrollserver" ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied === "enrollserver" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <pre className="bg-black/60 p-3 rounded-xl text-xs text-amber-300 font-mono whitespace-pre-wrap border border-white/10">{enroll.serverConfig}</pre>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-[#00f3ff] bg-[#00f3ff]/5 border border-[#00f3ff]/20 rounded-lg p-3">
                  <Loader2 size={16} className="animate-spin" /> Waiting for the router to report in... (token valid 30 minutes)
                </div>
              </>
            )}

            {enrollStatus?.setupStatus === "EXPIRED" && (
              <div className="text-red-400 bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-sm">
                The enrollment token expired. Close this window and press Quick Setup again.
              </div>
            )}

            {(enrollStatus?.setupStatus === "DISCOVERED" || enrollStatus?.setupStatus === "CONFIRMED" || enrollStatus?.setupStatus === "CONFIGURED") && enrollStatus?.discovered && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/30 p-3 rounded-lg text-sm">
                  <CheckCircle2 size={16} /> Device found. Details filled in automatically.
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ["Model", enrollStatus.discovered.model],
                    ["Serial number", enrollStatus.discovered.serial],
                    ["RouterOS version", enrollStatus.discovered.version],
                    ["Tunnel IP", enrollStatus.tunnelIp],
                    ["API port", "8728"],
                    ["API user", "poafi-cloud (generated)"],
                  ].map(([label, value]) => (
                    <div key={label as string} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <p className="text-gray-400">{label}</p>
                      <p className="text-white font-mono mt-0.5 break-all">{value || "-"}</p>
                    </div>
                  ))}
                </div>
                {!enrollResult && (
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium block mb-1">Router name (auto-filled from device identity, editable)</label>
                    <input value={enrollName} onChange={(e) => setEnrollName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]" />
                  </div>
                )}
                {enrollResult && (
                  <div className={`text-xs p-3 rounded-lg border ${enrollResult.connection?.ok ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30"}`}>
                    {enrollResult.message}
                    {enrollResult.connection?.error && <p className="mt-1 opacity-80">Reason: {enrollResult.connection.error}</p>}
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
                  {!enrollResult ? (
                    <button onClick={confirmEnrollment} disabled={enrollBusy} className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
                      {enrollBusy ? "Confirming..." : "Confirm & Activate Router"}
                    </button>
                  ) : (
                    <button onClick={closeEnroll} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-sm">Done</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cloud Setup Modal */}
      {cloudModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0a0a1a] border border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Cloud className="text-[#00f3ff]"/> MikroTik Cloud Provisioning</h2>
              <button onClick={() => setCloudModal(null)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="bg-[#00f3ff]/10 border border-[#00f3ff]/30 text-[#00f3ff] text-xs p-3 rounded-lg">
              Copy the script below. Open WinBox, connect to your MikroTik, open "New Terminal", paste the script, and press Enter. PoaFi will automatically establish a secure WireGuard tunnel.
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-300">1. Router Script (Paste into WinBox)</label>
                <button onClick={() => handleCopy(cloudModal.script, 'router')} className="text-xs text-[#00f3ff] flex items-center gap-1">
                  {copied === 'router' ? <CheckCircle2 size={12}/> : <Copy size={12}/>} {copied === 'router' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-black/60 p-4 rounded-xl text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap border border-white/10">{cloudModal.script}</pre>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-300">2. PoaFi Server Config (Admin Only)</label>
                <button onClick={() => handleCopy(cloudModal.serverConfig, 'server')} className="text-xs text-[#00f3ff] flex items-center gap-1">
                  {copied === 'server' ? <CheckCircle2 size={12}/> : <Copy size={12}/>} {copied === 'server' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-black/60 p-4 rounded-xl text-xs text-amber-300 font-mono overflow-x-auto whitespace-pre-wrap border border-white/10">{cloudModal.serverConfig}</pre>
            </div>

            <div className="pt-4 border-t border-white/10 text-right">
              <button onClick={() => setCloudModal(null)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
