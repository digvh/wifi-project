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

const ROUTER_ENDPOINT_CATEGORIES = ["ROUTER", "GATEWAY", "CONTROLLER"];

function vendorKeyForBrand(brand: string) {
  const compact = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const known: Record<string, string> = {
    mikrotik: "MIKROTIK",
    tplink: "TPLINK_OMADA",
    ruijie: "RUIJIE",
    reyee: "RUIJIE",
    cudy: "CUDY",
    comfast: "COMFAST",
    wavlink: "WAVLINK",
  };
  return known[compact] || brand.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export default function RoutersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [routers, setRouters] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [deviceModels, setDeviceModels] = useState<any[]>([]);
  const [vendorOptions, setVendorOptions] = useState<any[]>(VENDORS);
  const [integrationInfo, setIntegrationInfo] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tenantId: "",
    deviceModelId: "",
    siteName: "",
    installationAddress: "",
    connectionMode: "DIRECT",
    installationNotes: "",
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
  const [editingRouterId, setEditingRouterId] = useState<string | null>(null);
  const [activeSessionsRouterId, setActiveSessionsRouterId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [provisioningRouterId, setProvisioningRouterId] = useState<string | null>(null);
  const [provisioningData, setProvisioningData] = useState<any | null>(null);
  const [provisioningStatus, setProvisioningStatus] = useState<any | null>(null);
  const [generatingProvisioning, setGeneratingProvisioning] = useState(false);

  const fetchData = async () => {
    try {
      const [catalogueData, capabilityData] = await Promise.all([
        apiFetch("/device-catalog"),
        apiFetch("/routers/integration-capabilities"),
      ]);
      const models = catalogueData.devices || [];
      const capabilities = capabilityData.integrations || [];
      setDeviceModels(models);
      setIntegrationInfo(capabilities);

      const eligibleBrands: string[] = Array.from(new Set<string>(
        models
          .filter((model: any) => ROUTER_ENDPOINT_CATEGORIES.includes(String(model.category).toUpperCase()))
          .map((model: any): string => String(model.brand))
      ));
      const additionalVendors = eligibleBrands
        .map((brand) => ({
          value: vendorKeyForBrand(brand),
          label: brand,
          defaultPort: 443,
          color: "text-gray-300 border-white/10 bg-white/5",
        }))
        .filter((option) => !VENDORS.some((known) => known.value === option.value));
      setVendorOptions([...VENDORS, ...additionalVendors]);
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
    const target = vendorOptions.find((v) => v.value === vendor);
    setFormData((prev) => ({
      ...prev,
      vendor,
      apiPort: target ? target.defaultPort : 443,
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
      if (editingRouterId && !formData.password) delete (payload as any).password;
      await apiFetch(editingRouterId ? `/routers/${editingRouterId}` : "/routers", {
        method: editingRouterId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(editingRouterId ? "Router details updated successfully!" : "Router registered successfully!");
      setEditingRouterId(null);
      setFormData({
        tenantId: isSuperAdmin && tenants.length > 0 ? tenants[0].id : (user?.tenantId || ""),
        deviceModelId: "",
        siteName: "",
        installationAddress: "",
        connectionMode: "DIRECT",
        installationNotes: "",
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


  const generateProvisioningScript = async (routerId: string) => {
    setGeneratingProvisioning(true);
    setProvisioningRouterId(routerId);
    setProvisioningData(null);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch("/routers/" + routerId + "/provisioning-script", { method: "POST" });
      setProvisioningData(result);
      setSuccess("A one-time MikroTik setup script was generated. Review it before running it in Winbox.");
    } catch (err: any) {
      setError(err.message || "Could not generate the MikroTik setup script");
    } finally {
      setGeneratingProvisioning(false);
    }
  };


  const refreshProvisioningStatus = async (routerId: string) => {
    try {
      const result = await apiFetch("/routers/" + routerId + "/provisioning-status");
      setProvisioningStatus(result.enrollment || null);
    } catch (err: any) {
      setError(err.message || "Could not refresh provisioning status");
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
            Register and assign physical network devices to Operators. MikroTik has a live API adapter; other vendor integrations are not yet active.
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


      {provisioningData && (
        <div className="glass-panel p-6 space-y-4 border border-cyan-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">MikroTik cloud-assisted setup</h2>
              <p className="text-xs text-gray-400 mt-1">Router address: {provisioningData.assignedAddress} · Token expires: {new Date(provisioningData.expiresAt).toLocaleString()}</p>
            </div>
            <button onClick={() => { setProvisioningData(null); setProvisioningStatus(null); setProvisioningRouterId(null); }} className="text-xs text-gray-300 bg-white/10 px-3 py-2 rounded-lg">Close</button>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs p-3 rounded-lg">
            {provisioningData.warning} Test on your isolated VirtualBox MikroTik first. Do not run on a production router until the PoaFi WireGuard hub has been configured and reviewed.
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">1. RouterOS script — run in Winbox Terminal</h3>
              <button onClick={() => navigator.clipboard.writeText(provisioningData.script)} className="text-xs bg-cyan-500/15 text-cyan-200 px-3 py-2 rounded-lg">Copy script</button>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-gray-200">{provisioningData.script}</pre>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">2. Server peer command — platform administrator only</h3>
              <div className="flex gap-2">
                <button onClick={() => provisioningRouterId && refreshProvisioningStatus(provisioningRouterId)} className="text-xs bg-white/10 text-gray-200 px-3 py-2 rounded-lg">Refresh enrollment</button>
                <button onClick={() => navigator.clipboard.writeText(provisioningStatus?.routerPublicKey ? provisioningData.serverPeerCommand.replace("<ROUTER_PUBLIC_KEY_FROM_ENROLLMENT>", provisioningStatus.routerPublicKey) : provisioningData.serverPeerCommand)} className="text-xs bg-white/10 text-gray-200 px-3 py-2 rounded-lg">Copy command</button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap break-all bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-gray-200">{provisioningStatus?.routerPublicKey ? provisioningData.serverPeerCommand.replace("<ROUTER_PUBLIC_KEY_FROM_ENROLLMENT>", provisioningStatus.routerPublicKey) : provisioningData.serverPeerCommand}</pre>
            <p className="text-xs text-gray-400">Enrollment status: {provisioningStatus?.status || "Not refreshed yet"}</p>
            {provisioningStatus?.routerPublicKey && <p className="text-xs text-gray-300 break-all">Router public key: {provisioningStatus.routerPublicKey}</p>}
            <p className="text-xs text-gray-400">Replace the placeholder with the router public key returned by the enrollment callback, then apply this on the WireGuard hub. The UI does not mark the router online merely because a script was generated.</p>
          </div>
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
                {vendorOptions.map((v) => {
                  const integration = integrationInfo.find((item) => item.vendor === v.value);
                  const stateLabel = integration?.driverAvailable ? " — LIVE DRIVER" : " — INVENTORY ONLY / DRIVER PENDING";
                  return <option key={v.value} value={v.value}>{v.label}{stateLabel}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Catalogue Device Model (optional)</label>
              <select
                value={formData.deviceModelId}
                onChange={(e) => setFormData({ ...formData, deviceModelId: e.target.value })}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-white focus:border-[#00f3ff] outline-none text-sm"
              >
                <option value="">Select model or register without catalogue link</option>
                {deviceModels
                  .filter((model) => ROUTER_ENDPOINT_CATEGORIES.includes(String(model.category).toUpperCase()))
                  .map((model) => (
                    <option key={model.id} value={model.id}>{model.brand} {model.model} — {model.category}</option>
                  ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">Choose the exact model of the physical device. Add it to Device Catalogue first if it is missing.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Installation Site</label>
                <input value={formData.siteName} onChange={(e) => setFormData({ ...formData, siteName: e.target.value })} placeholder="e.g. Arusha Main Branch" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Installation Address / Area</label>
                <input value={formData.installationAddress} onChange={(e) => setFormData({ ...formData, installationAddress: e.target.value })} placeholder="Street, ward, town" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Management Connection Path</label>
              <select value={formData.connectionMode} onChange={(e) => setFormData({ ...formData, connectionMode: e.target.value })} className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-white text-sm">
                <option value="DIRECT">Direct network access</option>
                <option value="VPN">Private VPN</option>
                <option value="SECURE_TUNNEL">Secure outbound tunnel</option>
                <option value="CLOUD_CONTROLLER">Manufacturer cloud controller</option>
              </select>
              <p className="text-[11px] text-amber-400 mt-1">This records the intended access path. VPN/tunnel connectivity must be deployed separately before remote access works.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Installation Notes</label>
              <textarea value={formData.installationNotes} onChange={(e) => setFormData({ ...formData, installationNotes: e.target.value })} placeholder="Installation or configuration notes" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm min-h-20" />
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
                required={!editingRouterId}
              />
            </div>

            {editingRouterId && <button type="button" onClick={() => { setEditingRouterId(null); setFormData({ tenantId: isSuperAdmin ? (tenants[0]?.id || "") : (user?.tenantId || ""), deviceModelId: "", siteName: "", installationAddress: "", connectionMode: "DIRECT", installationNotes: "", name: "", vendor: "MIKROTIK", host: "", apiPort: 8728, username: "", password: "" }); }} className="w-full bg-white/10 text-white py-2 rounded-lg">Cancel editing</button>}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity text-sm shadow-lg"
            >
              {editingRouterId ? "Update Gateway Router" : "Save Gateway Router"}
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
              const vendorMeta = vendorOptions.find((v) => v.value === r.vendor) || {
                label: r.vendor,
                color: "text-gray-300 border-white/10 bg-white/5",
              };
              const driverAvailable = integrationInfo.some((item) => item.vendor === r.vendor && item.driverAvailable);
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
                        {r.host}:{r.apiPort} • Operator: {r.tenant?.name || "Global"}{r.deviceModel ? ` • ${r.deviceModel.brand} ${r.deviceModel.model}` : " • Model not linked"}{r.siteName ? ` • Site: ${r.siteName}` : ""}
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
                      onClick={() => {
                        setEditingRouterId(r.id);
                        setFormData({ tenantId: r.tenantId || "", deviceModelId: r.deviceModelId || r.deviceModel?.id || "", siteName: r.siteName || "", installationAddress: r.installationAddress || "", connectionMode: r.connectionMode || "DIRECT", installationNotes: r.installationNotes || "", name: r.name || "", vendor: r.vendor || "MIKROTIK", host: r.host || "", apiPort: r.apiPort || 8728, username: r.username || "", password: "" });
                        setError(""); setSuccess("");
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-lg"
                    >Edit</button>

                    {r.vendor === "MIKROTIK" && (
                      <button
                        onClick={() => generateProvisioningScript(r.id)}
                        disabled={generatingProvisioning && provisioningRouterId === r.id}
                        title="Generate a one-time WireGuard bootstrap script"
                        className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs px-3 py-2 rounded-lg border border-cyan-500/20 disabled:opacity-50"
                      >
                        {generatingProvisioning && provisioningRouterId === r.id ? "Generating..." : "Cloud setup"}
                      </button>
                    )}
                    <button
                      onClick={() => viewSessions(r.id)}
                      disabled={!driverAvailable}
                      title={driverAvailable ? "View live sessions" : "This vendor's live API adapter is not implemented"}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Users size={14} /> Sessions
                    </button>

                    <button
                      onClick={() => handleTest(r.id)}
                      disabled={testingId === r.id || !driverAvailable}
                      title={driverAvailable ? "Test the registered vendor adapter" : "This vendor's live API adapter is not implemented"}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingId === r.id ? "Testing..." : driverAvailable ? "Test Connection" : "Integration Pending"}
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
