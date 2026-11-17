"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { 
  Wrench, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Filter, 
  AlertCircle, 
  ShieldAlert, 
  MessageSquare,
  RefreshCw,
  Edit3,
  Server,
  Truck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABELS: Record<string, string> = {
  DEVICE_RECEIVED: "Kifaa Kimepokelewa / Device received",
  CONFIGURED: "Imesanidiwa / Configured, ready to ship",
  SHIPPED_BACK: "Imetumwa / Shipped back",
  CANCELLED: "Imeghairiwa / Cancelled",
};

const TYPE_LABELS: Record<string, string> = {
  PHYSICAL_HANDOVER: "Physical handover",
  REMOTE: "Remote setup",
  ASSISTED: "Admin assisted",
  SELF: "Self setup",
};

type SetupRequest = {
  id: string;
  tenantId: string;
  requestType: string;
  serialNumber?: string | null;
  macAddress?: string | null;
  status: string;
  deviceName: string | null;
  deviceVendor: string | null;
  notes: string | null;
  adminNotes?: string | null;
  createdAt: string;
  tenant?: { id: string; name: string; slug: string } | null;
  router?: { id: string; name: string; host: string; vendor: string } | null;
  assignedTo?: { id: string; email: string } | null;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export default function DeviceSetupPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [requests, setRequests] = useState<SetupRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Filter state for Admin
  const [filterTenantId, setFilterTenantId] = useState("");

  // Form state
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceVendor, setDeviceVendor] = useState("MIKROTIK");
  const [requestType, setRequestType] = useState("PHYSICAL_HANDOVER");
  const [serialNumber, setSerialNumber] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [courierInfo, setCourierInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Admin Assistance / Status Update Modal State
  const [assistingRequest, setAssistingRequest] = useState<SetupRequest | null>(null);
  const [updateStatus, setUpdateStatus] = useState("IN_PROGRESS");
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadRequests = async (tenantId?: string) => {
    setLoading(true);
    try {
      const query = tenantId ? `?tenantId=${tenantId}` : "";
      const res = await apiFetch(`/device-setup${query}`);
      setRequests(res.requests || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load setup requests");
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await apiFetch("/tenants");
      setTenants(res.tenants || []);
      if (res.tenants?.length > 0 && !selectedTenantId) {
        setSelectedTenantId(res.tenants[0].id);
      }
    } catch (err: any) {
      console.warn("Could not load tenants for admin:", err.message);
    }
  };

  useEffect(() => {
    loadRequests(filterTenantId);
    if (isSuperAdmin) {
      loadTenants();
    }
  }, [filterTenantId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (isSuperAdmin && !selectedTenantId) {
      setError("Tafadhali chagua Operator wa kumsaidia / Please select an Operator to assist");
      setSubmitting(false);
      return;
    }

    try {
      await apiFetch("/device-setup", {
        method: "POST",
        body: JSON.stringify({
          requestType,
          tenantId: isSuperAdmin ? selectedTenantId : undefined,
          deviceName,
          deviceVendor,
          serialNumber: serialNumber || undefined,
          macAddress: macAddress || undefined,
          notes: requestType === "PHYSICAL_HANDOVER" && courierInfo
            ? `${notes}\n\n[Courier / delivery details] ${courierInfo}`
            : notes,
        }),
      });
      setSuccess("Ombi la kusanidi kifaa limewasilishwa kikamilifu! / Device setup request created successfully!");
      setDeviceName("");
      setNotes("");
      setSerialNumber("");
      setMacAddress("");
      setCourierInfo("");
      setShowForm(false);
      await loadRequests(filterTenantId);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistingRequest) return;
    setUpdating(true);
    setError("");
    try {
      await apiFetch(`/device-setup/${assistingRequest.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: updateStatus,
          adminNotes,
        }),
      });
      setSuccess(`Setup request for ${assistingRequest.deviceName} updated to ${updateStatus}`);
      setAssistingRequest(null);
      await loadRequests(filterTenantId);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update request");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Wrench className="text-[#00f3ff] w-8 h-8" />
            <span>Msaada wa Vifaa / Device Setup Requests</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isSuperAdmin
              ? "Saidia ma-operator kusanidi routers, access points (MikroTik, Omada, UniFi) na mtandao wao."
              : "Omba msaada kutoka kwa wahandisi wa PoaFi kusanidi router au access point yako."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadRequests(filterTenantId)}
            className="px-3.5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-xl text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-[#00f3ff]/20 flex items-center gap-2 transition-all hover:opacity-90"
          >
            <Plus size={16} />
            <span>{showForm ? "Cancel" : isSuperAdmin ? "Msaidie Operator Mpya" : "Omba Msaada (New Request)"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 flex items-center gap-3 text-sm">
          <ShieldAlert className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-4 flex items-center gap-3 text-sm">
          <CheckCircle2 className="text-green-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Operator in-app status notifications */}
      {!isSuperAdmin &&
        requests
          .filter((r) => ["DEVICE_RECEIVED", "IN_PROGRESS", "CONFIGURED", "SHIPPED_BACK"].includes(r.status))
          .slice(0, 3)
          .map((r) => (
            <div
              key={`alert-${r.id}`}
              className="bg-[#00f3ff]/10 border border-[#00f3ff]/30 text-white rounded-xl p-4 flex items-center gap-3 text-xs"
            >
              <Truck className="text-[#00f3ff] shrink-0" size={18} />
              <div>
                <p className="font-bold">
                  {r.deviceName || "Kifaa Chako"} — {STATUS_LABELS[r.status] || "Inashughulikiwa / In Progress"}
                </p>
                {r.adminNotes && <p className="text-gray-300 mt-0.5">{r.adminNotes}</p>}
              </div>
            </div>
          ))}

      {/* Admin Operator Filter Toolbar */}
      {isSuperAdmin && (
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Building2 className="text-[#00f3ff] w-4 h-4" />
            <span className="font-semibold">Chagua Operator / Select Operator to Help:</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="bg-[#0a0a1a] border border-[#00f3ff]/40 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#00f3ff] w-full sm:w-64"
            >
              <option value="">Wote / All Operators ({tenants.length})</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  🏢 {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* New Request / Help Operator Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4 rounded-2xl border border-white/10 max-w-2xl animate-in fade-in duration-200">
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <Wrench size={18} className="text-[#00f3ff]" />
            <span>{isSuperAdmin ? "Msaidie Operator Kusanidi Kifaa" : "Wasilisha Ombi la Kusanidi Kifaa"}</span>
          </h2>

          {/* Admin Operator Dropdown */}
          {isSuperAdmin && (
            <div className="p-4 bg-[#00f3ff]/5 border border-[#00f3ff]/20 rounded-xl space-y-1.5">
              <label className="text-xs font-bold text-[#00f3ff] flex items-center gap-2">
                <Building2 size={14} />
                <span>Chagua Operator wa Kumsaidia / Select Operator to Assist: *</span>
              </label>
              <select
                required
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/20 rounded-lg p-2.5 text-xs text-white focus:border-[#00f3ff] outline-none"
              >
                <option value="">-- Chagua Operator / Select Operator --</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400">
                Ombi hili litahusishwa na akaunti ya mwendeshaji huyu wa Wi-Fi.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-2">
              Njia ya Usanidi / How should the device be set up? *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "PHYSICAL_HANDOVER", title: "Nitatuma Kifaa / Send device to PoaFi", desc: "Post the router to the PoaFi admin. It is configured, tested and sent back ready to plug in." },
                { id: "REMOTE", title: "Nitasanidi Mwenyewe / I will set it up remotely", desc: "Use Quick Setup on the Routers page: paste one script and the device registers itself." },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setRequestType(opt.id)}
                  className={`p-3 rounded-xl border cursor-pointer text-xs transition-all ${requestType === opt.id ? "border-[#00f3ff] bg-[#00f3ff]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                >
                  <p className="font-bold text-white mb-1">{opt.title}</p>
                  <p className="text-gray-400">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Jina la Kifaa (Device Name) *
            </label>
            <input
              required
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="mfano: MikroTik hEX S - Hotspot ya Sokoni"
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Aina ya Kifaa / Brand Vendor *
            </label>
            <select
              value={deviceVendor}
              onChange={(e) => setDeviceVendor(e.target.value)}
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
            >
              <option value="MIKROTIK">MikroTik RouterOS (Live API + Quick Setup)</option>
              <option value="TPLINK_OMADA">TP-Link Omada (Live Controller API + RADIUS)</option>
              <option value="UBIQUITI_UNIFI">Ubiquiti UniFi (RADIUS / Controller Planned)</option>
              <option value="RUIJIE">Ruijie / Reyee (RADIUS / Cloud Planned)</option>
              <option value="CUDY">Cudy (RADIUS / AP Only)</option>
              <option value="COMFAST">Comfast (RADIUS / AP Only)</option>
              <option value="WAVLINK">Wavlink (RADIUS / AP Only)</option>
              <option value="GENERIC">Other / RADIUS Only</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Serial Number</label>
              <input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Printed on the router label"
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">MAC Address</label>
              <input
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder="e.g. 4C:5E:0C:12:34:56"
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
              />
            </div>
          </div>

          {requestType === "PHYSICAL_HANDOVER" && (
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Courier / Delivery Details (bus company, parcel number, phone) 
              </label>
              <input
                value={courierInfo}
                onChange={(e) => setCourierInfo(e.target.value)}
                placeholder="e.g. Abood Bus, parcel #1234, driver 07xx xxx xxx"
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              Maelekezo au Maelezo ya Msaada unaohitajika (Notes / Instructions) *
            </label>
            <textarea
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eleza kwa ufupi unachotaka kusanidiwa (mfano: Kuunganisha captive portal, kugawa IP pool, usanidi wa Mesh APs...)"
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none min-h-[100px]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity hover:opacity-90 shadow-lg shadow-[#00f3ff]/20"
          >
            {submitting ? "Inawasilisha..." : isSuperAdmin ? "Hifadhi Ombi la Msaada" : "Tuma Ombi la Msaada"}
          </button>
        </form>
      )}

      {/* Requests History List */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-[#00f3ff]" />
            <span>Historia ya Maombi / Setup Requests ({requests.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <div className="w-8 h-8 border-2 border-[#00f3ff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p>Inapakia maombi...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Hakuna maombi ya kusanidi vifaa yaliyopatikana.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((req) => (
              <div key={req.id} className="p-5 space-y-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-bold text-white text-base">{req.deviceName || "Kifaa Kisicho na Jina"}</p>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-[#00f3ff] border border-white/10">
                      {req.deviceVendor || "GENERIC"}
                    </span>

                    {/* Status Badge */}
                    {req.status === "PENDING" && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Clock size={12} /> Inasubiri / Pending
                      </span>
                    )}
                    {req.status === "IN_PROGRESS" && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 animate-pulse">
                        <Wrench size={12} /> Inashughulikiwa / In Progress
                      </span>
                    )}
                    {req.status === "COMPLETED" && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Imekamilika / Completed
                      </span>
                    )}
                    {["DEVICE_RECEIVED", "CONFIGURED", "SHIPPED_BACK", "CANCELLED"].includes(req.status) && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {STATUS_LABELS[req.status]}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 border border-white/10 rounded-full px-2 py-0.5">
                      {TYPE_LABELS[req.requestType] || req.requestType}
                    </span>
                  </div>

                  {/* Admin Actions */}
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {!req.router && (
                        <Link
                          href={`/routers?tenantId=${encodeURIComponent(req.tenantId)}&name=${encodeURIComponent(req.deviceName || "")}&vendor=${encodeURIComponent(req.deviceVendor || "MIKROTIK")}&setupRequestId=${encodeURIComponent(req.id)}`}
                          className="bg-[#00f3ff]/15 hover:bg-[#00f3ff]/25 text-[#00f3ff] border border-[#00f3ff]/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors w-fit"
                        >
                          <Server size={13} />
                          <span>Register this device</span>
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setAssistingRequest(req);
                          setUpdateStatus(req.status);
                          setAdminNotes(req.adminNotes || "");
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors w-fit"
                      >
                        <Edit3 size={13} className="text-[#00f3ff]" />
                        <span>Sasisha / Assist Operator</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {req.tenant && (
                    <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg w-fit border border-white/5">
                      <Building2 size={13} className="text-[#00f3ff]" />
                      <span>Operator:</span>
                      <strong className="text-white">{req.tenant.name}</strong>
                      <code className="text-[#00f3ff] text-[10px] bg-black/40 px-1.5 py-0.5 rounded">{req.tenant.slug}</code>
                    </div>
                  )}
                  {req.serialNumber && (
                    <span className="text-xs text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 font-mono">
                      S/N: <strong className="text-white">{req.serialNumber}</strong>
                    </span>
                  )}
                  {req.macAddress && (
                    <span className="text-xs text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 font-mono">
                      MAC: <strong className="text-white">{req.macAddress}</strong>
                    </span>
                  )}
                  {req.router && (
                    <span className="text-xs text-green-300 bg-green-500/10 px-2.5 py-1.5 rounded-lg border border-green-500/20 flex items-center gap-1.5">
                      <Server size={12} /> Linked Router: <strong>{req.router.name}</strong> ({req.router.host})
                    </span>
                  )}
                </div>

                {/* Operator Notes */}
                {req.notes && (
                  <p className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <strong>Maelezo ya Operator:</strong> {req.notes}
                  </p>
                )}

                {/* Admin Notes / Engineering feedback */}
                {req.adminNotes && (
                  <div className="text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={13} />
                      <span>Maelekezo ya Mhandisi / Engineer Notes:</span>
                    </div>
                    <p className="text-gray-200">{req.adminNotes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>Iliwasilishwa: {new Date(req.createdAt).toLocaleString()}</span>
                  {req.assignedTo && (
                    <span>Mhandisi: {req.assignedTo.email}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Assistance Modal */}
      {assistingRequest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-lg w-full border border-white/20 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="text-[#00f3ff]" />
              <span>Sasisha Msaada: {assistingRequest.deviceName}</span>
            </h3>

            {assistingRequest.tenant && (
              <p className="text-xs text-gray-400">
                Operator: <strong className="text-white">{assistingRequest.tenant.name}</strong> ({assistingRequest.tenant.slug})
              </p>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Hali ya Msaada (Status):</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-[#00f3ff] outline-none"
                >
                  <option value="PENDING">Inasubiri / Waiting for device (PENDING)</option>
                  <option value="DEVICE_RECEIVED">Kifaa Kimepokelewa / Device received</option>
                  <option value="IN_PROGRESS">Inashughulikiwa / Being configured (IN_PROGRESS)</option>
                  <option value="CONFIGURED">Imesanidiwa / Configured, ready to send back</option>
                  <option value="SHIPPED_BACK">Imetumwa Kwa Operator / Shipped back to operator</option>
                  <option value="COMPLETED">Imekamilika / Completed (installed &amp; online)</option>
                  <option value="CANCELLED">Imeghairiwa / Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Maelekezo ya Mhandisi / Admin Configuration Notes:
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Eleza hatua zilizochukuliwa, script iliyotumiwa, au maelekezo kwa ajili ya operator..."
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-xs text-white focus:border-[#00f3ff] outline-none min-h-[100px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssistingRequest(null)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-xl text-xs font-semibold text-gray-300 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-2.5 rounded-xl text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updating ? "Inasasisha..." : "Hifadhi Mabadiliko"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
