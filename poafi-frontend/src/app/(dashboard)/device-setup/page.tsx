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
import { useLanguage } from "@/context/LanguageContext";

const STATUS_LABELS: Record<string, { sw: string; en: string }> = {
  DEVICE_RECEIVED: { sw: "Kifaa Kimepokelewa", en: "Device received" },
  CONFIGURED: { sw: "Imesanidiwa, tayari kutumwa", en: "Configured, ready to ship" },
  SHIPPED_BACK: { sw: "Imetumwa kurudi", en: "Shipped back" },
  CANCELLED: { sw: "Imeghairiwa", en: "Cancelled" },
};

const TYPE_LABELS: Record<string, { sw: string; en: string }> = {
  PHYSICAL_HANDOVER: { sw: "Kutuma kifaa halisi", en: "Physical handover" },
  REMOTE: { sw: "Usanidi wa mbali", en: "Remote setup" },
  ASSISTED: { sw: "Msaada wa msimamizi", en: "Admin assisted" },
  SELF: { sw: "Usanidi binafsi", en: "Self setup" },
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
  const { t } = useLanguage();
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
      setError(t("Tafadhali chagua Mwendeshaji wa kumsaidia", "Please select an Operator to assist"));
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
            ? `${notes}\n\n[${t("Maelezo ya usafirishaji", "Courier / delivery details")}] ${courierInfo}`
            : notes,
        }),
      });
      setSuccess(t("Ombi la kusanidi kifaa limewasilishwa kikamilifu!", "Device setup request created successfully!"));
      setDeviceName("");
      setNotes("");
      setSerialNumber("");
      setMacAddress("");
      setCourierInfo("");
      setShowForm(false);
      await loadRequests(filterTenantId);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || t("Imeshindikana kutuma ombi", "Failed to submit request"));
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
      setSuccess(
        t(
          `Ombi la ${assistingRequest.deviceName} limesasishwa kuwa ${updateStatus}`,
          `Setup request for ${assistingRequest.deviceName} updated to ${updateStatus}`
        )
      );
      setAssistingRequest(null);
      await loadRequests(filterTenantId);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || t("Imeshindikana kusasisha ombi", "Failed to update request"));
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
            <span>{t("Msaada wa Vifaa", "Device Setup Requests")}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isSuperAdmin
              ? t(
                  "Saidia waendeshaji kusanidi routers, access points (MikroTik, Omada, UniFi) na mtandao wao.",
                  "Help operators configure routers, access points (MikroTik, Omada, UniFi), and their network.",
                )
              : t(
                  "Omba msaada kutoka kwa wahandisi wa PoaFi kusanidi router au access point yako.",
                  "Request remote or physical setup assistance from PoaFi engineers for your router or AP.",
                )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadRequests(filterTenantId)}
            className="px-3.5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-xl text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{t("Sasisha", "Refresh")}</span>
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-[#00f3ff]/20 flex items-center gap-2 transition-all hover:opacity-90"
          >
            <Plus size={16} />
            <span>
              {showForm
                ? t("Ghairi", "Cancel")
                : isSuperAdmin
                  ? t("Msaidie Mwendeshaji Mpya", "Assist New Operator")
                  : t("Omba Msaada", "New Setup Request")}
            </span>
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
                  {r.deviceName || t("Kifaa Chako", "Your Device")} —{" "}
                  {STATUS_LABELS[r.status]
                    ? t(STATUS_LABELS[r.status].sw, STATUS_LABELS[r.status].en)
                    : t("Inashughulikiwa", "In Progress")}
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
            <span className="font-semibold">{t("Chuja kwa Mwendeshaji:", "Filter by Operator:")}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="bg-[#0a0a1a] border border-[#00f3ff]/40 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#00f3ff] w-full sm:w-64"
            >
              <option value="">{t("Waendeshaji Wote", "All Operators")} ({tenants.length})</option>
              {tenants.map((tItem) => (
                <option key={tItem.id} value={tItem.id}>
                  🏢 {tItem.name} ({tItem.slug})
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
            <span>
              {isSuperAdmin
                ? t("Msaidie Mwendeshaji Kusanidi Kifaa", "Help Operator Configure Device")
                : t("Wasilisha Ombi la Kusanidi Kifaa", "Submit Device Setup Request")}
            </span>
          </h2>

          {/* Admin Operator Dropdown */}
          {isSuperAdmin && (
            <div className="p-4 bg-[#00f3ff]/5 border border-[#00f3ff]/20 rounded-xl space-y-1.5">
              <label className="text-xs font-bold text-[#00f3ff] flex items-center gap-2">
                <Building2 size={14} />
                <span>{t("Chagua Mwendeshaji wa Kumsaidia *", "Select Operator to Assist *")}</span>
              </label>
              <select
                required
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/20 rounded-lg p-2.5 text-xs text-white focus:border-[#00f3ff] outline-none"
              >
                <option value="">{t("-- Chagua Mwendeshaji --", "-- Select Operator --")}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400">
                {t("Ombi hili litahusishwa na akaunti ya mwendeshaji huyu wa Wi-Fi.", "This request will be linked to this Wi-Fi operator's account.")}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-2">
              {t("Njia ya Usanidi *", "Setup Method *")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: "PHYSICAL_HANDOVER",
                  title: t("Nitatuma Kifaa Kwa PoaFi", "Send physical device to PoaFi"),
                  desc: t(
                    "Tuma router kwa msimamizi wa PoaFi. Itasanidiwa, itajaribiwa na kurudishwa tayari kuunganishwa.",
                    "Post the router to the PoaFi admin. It is configured, tested and sent back ready to plug in.",
                  ),
                },
                {
                  id: "REMOTE",
                  title: t("Nitasanidi Kwa Mbali", "I will set it up remotely"),
                  desc: t(
                    "Tumia Quick Setup kwenye ukurasa wa Routers: bandika script moja na kifaa kitajisajili chenyewe.",
                    "Use Quick Setup on the Routers page: paste one script and the device registers itself.",
                  ),
                },
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
              {t("Jina la Kifaa *", "Device Name *")}
            </label>
            <input
              required
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={t("mfano: MikroTik hEX S - Hotspot ya Sokoni", "e.g. MikroTik hEX S - Market Hotspot")}
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              {t("Aina ya Kifaa (Mtengenezaji) *", "Device Brand / Vendor *")}
            </label>
            <select
              value={deviceVendor}
              onChange={(e) => setDeviceVendor(e.target.value)}
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
            >
              <option value="MIKROTIK">{t("MikroTik RouterOS (API ya Moja kwa Moja + Usanidi wa Haraka)", "MikroTik RouterOS (Live API + Quick Setup)")}</option>
              <option value="TPLINK_OMADA">{t("TP-Link Omada (API ya Kidhibiti + RADIUS)", "TP-Link Omada (Live Controller API + RADIUS)")}</option>
              <option value="UBIQUITI_UNIFI">{t("Ubiquiti UniFi (RADIUS / Kidhibiti Inayopangwa)", "Ubiquiti UniFi (RADIUS / Controller Planned)")}</option>
              <option value="RUIJIE">{t("Ruijie / Reyee (RADIUS / Wingu Inayopangwa)", "Ruijie / Reyee (RADIUS / Cloud Planned)")}</option>
              <option value="CUDY">{t("Cudy (RADIUS / AP Pekee)", "Cudy (RADIUS / AP Only)")}</option>
              <option value="COMFAST">{t("Comfast (RADIUS / AP Pekee)", "Comfast (RADIUS / AP Only)")}</option>
              <option value="WAVLINK">{t("Wavlink (RADIUS / AP Pekee)", "Wavlink (RADIUS / AP Only)")}</option>
              <option value="GENERIC">{t("Nyingine / RADIUS Pekee", "Other / RADIUS Only")}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Namba ya Kifaa (Serial Number)", "Serial Number")}</label>
              <input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={t("Imeandikwa kwenye stika ya router", "Printed on the router label")}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Anwani ya MAC (MAC Address)", "MAC Address")}</label>
              <input
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder={t("mfano: 4C:5E:0C:12:34:56", "e.g. 4C:5E:0C:12:34:56")}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
              />
            </div>
          </div>

          {requestType === "PHYSICAL_HANDOVER" && (
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                {t("Maelezo ya Usafirishaji (kampuni ya basi, namba ya kifurushi, simu)", "Courier / Delivery Details (bus company, parcel number, phone)")}
              </label>
              <input
                value={courierInfo}
                onChange={(e) => setCourierInfo(e.target.value)}
                placeholder={t("mfano: Abood Bus, kifurushi #1234, dereva 07xx xxx xxx", "e.g. Abood Bus, parcel #1234, driver 07xx xxx xxx")}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              {t("Maelekezo au Maelezo ya Msaada Unaohitajika *", "Notes / Setup Instructions *")}
            </label>
            <textarea
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                "Eleza kwa ufupi unachotaka kusanidiwa (mfano: Kuunganisha captive portal, kugawa IP pool, usanidi wa Mesh APs...)",
                "Briefly describe what needs setup (e.g. Connect captive portal, assign IP pool, configure Mesh APs...)"
              )}
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none min-h-[100px]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-opacity hover:opacity-90 shadow-lg shadow-[#00f3ff]/20"
          >
            {submitting
              ? t("Inawasilisha...", "Submitting...")
              : isSuperAdmin
                ? t("Hifadhi Ombi la Msaada", "Save Setup Assistance")
                : t("Tuma Ombi la Msaada", "Submit Setup Request")}
          </button>
        </form>
      )}

      {/* Requests History List */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-[#00f3ff]" />
            <span>{t("Historia ya Maombi ya Usanidi", "Setup Requests History")} ({requests.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <div className="w-8 h-8 border-2 border-[#00f3ff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p>{t("Inapakia maombi...", "Loading requests...")}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {t("Hakuna maombi ya kusanidi vifaa yaliyopatikana.", "No device setup requests found.")}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((req) => (
              <div key={req.id} className="p-5 space-y-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-bold text-white text-base">{req.deviceName || t("Kifaa Kisicho na Jina", "Unnamed Device")}</p>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-[#00f3ff] border border-white/10">
                      {req.deviceVendor || "GENERIC"}
                    </span>

                    {/* Status Badge */}
                    {req.status === "PENDING" && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Clock size={12} /> {t("Inasubiri", "Pending")}
                      </span>
                    )}
                    {req.status === "IN_PROGRESS" && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 animate-pulse">
                        <Wrench size={12} /> {t("Inashughulikiwa", "In Progress")}
                      </span>
                    )}
                    {req.status === "COMPLETED" && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                        <CheckCircle2 size={12} /> {t("Imekamilika", "Completed")}
                      </span>
                    )}
                    {["DEVICE_RECEIVED", "CONFIGURED", "SHIPPED_BACK", "CANCELLED"].includes(req.status) && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {t(STATUS_LABELS[req.status].sw, STATUS_LABELS[req.status].en)}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 border border-white/10 rounded-full px-2 py-0.5">
                      {TYPE_LABELS[req.requestType]
                        ? t(TYPE_LABELS[req.requestType].sw, TYPE_LABELS[req.requestType].en)
                        : req.requestType}
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
                          <span>{t("Sajili kifaa hiki", "Register this device")}</span>
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
                        <span>{t("Sasisha Msaada", "Assist Operator")}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {req.tenant && (
                    <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg w-fit border border-white/5">
                      <Building2 size={13} className="text-[#00f3ff]" />
                      <span>{t("Mwendeshaji:", "Operator:")}</span>
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
                      <Server size={12} /> {t("Router Iliyounganishwa:", "Linked Router:")} <strong>{req.router.name}</strong> ({req.router.host})
                    </span>
                  )}
                </div>

                {/* Operator Notes */}
                {req.notes && (
                  <p className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <strong>{t("Maelezo ya Mwendeshaji:", "Operator Notes:")}</strong> {req.notes}
                  </p>
                )}

                {/* Admin Notes / Engineering feedback */}
                {req.adminNotes && (
                  <div className="text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={13} />
                      <span>{t("Maelekezo ya Mhandisi:", "Engineer Notes:")}</span>
                    </div>
                    <p className="text-gray-200">{req.adminNotes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>{t("Iliwasilishwa:", "Submitted:")} {new Date(req.createdAt).toLocaleString()}</span>
                  {req.assignedTo && (
                    <span>{t("Mhandisi:", "Engineer:")} {req.assignedTo.email}</span>
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
              <span>{t("Sasisha Msaada:", "Update Request:")} {assistingRequest.deviceName}</span>
            </h3>

            {assistingRequest.tenant && (
              <p className="text-xs text-gray-400">
                {t("Mwendeshaji:", "Operator:")} <strong className="text-white">{assistingRequest.tenant.name}</strong> ({assistingRequest.tenant.slug})
              </p>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">{t("Hali ya Msaada:", "Request Status:")}</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-[#00f3ff] outline-none"
                >
                  <option value="PENDING">{t("Inasubiri kifaa (PENDING)", "Waiting for device (PENDING)")}</option>
                  <option value="DEVICE_RECEIVED">{t("Kifaa kimepokelewa", "Device received")}</option>
                  <option value="IN_PROGRESS">{t("Inashughulikiwa (IN_PROGRESS)", "Being configured (IN_PROGRESS)")}</option>
                  <option value="CONFIGURED">{t("Imesanidiwa, tayari kurudishwa", "Configured, ready to send back")}</option>
                  <option value="SHIPPED_BACK">{t("Imetumwa kwa mwendeshaji", "Shipped back to operator")}</option>
                  <option value="COMPLETED">{t("Imekamilika (imefungwa na iko mtandaoni)", "Completed (installed & online)")}</option>
                  <option value="CANCELLED">{t("Imeghairiwa", "Cancelled")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  {t("Maelekezo ya Mhandisi kwa Mwendeshaji:", "Engineer Configuration Notes:")}
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={t(
                    "Eleza hatua zilizochukuliwa, script iliyotumiwa, au maelekezo kwa ajili ya mwendeshaji...",
                    "Describe steps taken, script used, or instructions for the operator..."
                  )}
                  className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-xs text-white focus:border-[#00f3ff] outline-none min-h-[100px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssistingRequest(null)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-xl text-xs font-semibold text-gray-300 transition-colors"
                >
                  {t("Funga", "Close")}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-2.5 rounded-xl text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updating ? t("Inasasisha...", "Updating...") : t("Hifadhi Mabadiliko", "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
