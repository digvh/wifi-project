"use client";

import { useEffect, useState } from "react";
import { 
  ClipboardCheck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Building, 
  ShieldAlert,
  Search,
  KeyRound,
  RefreshCw
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Application = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Approval modal state
  const [approvingApp, setApprovingApp] = useState<Application | null>(null);
  const [approvalPassword, setApprovalPassword] = useState("PoaFiPass2026!");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Rejection modal state
  const [rejectingApp, setRejectingApp] = useState<Application | null>(null);
  const [rejectNote, setRejectNote] = useState("Vigezo havijakidhi vigezo vya mkoa huu kwa sasa.");

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/applications");
      setApplications(res.applications || []);
    } catch (err: any) {
      console.error("Failed to load applications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "PLATFORM_ADMIN") {
      fetchApplications();
    }
  }, [user]);

  const handleApprove = async () => {
    if (!approvingApp) return;
    setActionLoading(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await apiFetch(`/applications/${approvingApp.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ password: approvalPassword }),
      });
      setActionSuccess(res.message);
      setTimeout(() => {
        setApprovingApp(null);
        setActionSuccess("");
        fetchApplications();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || "Failed to approve application");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingApp) return;
    setActionLoading(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await apiFetch(`/applications/${rejectingApp.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note: rejectNote }),
      });
      setActionSuccess(res.message);
      setTimeout(() => {
        setRejectingApp(null);
        setActionSuccess("");
        fetchApplications();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || "Failed to reject application");
    } finally {
      setActionLoading(false);
    }
  };

  if (user?.role !== "PLATFORM_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-gray-400 mt-2">Only Super Admins can review and approve operator applications.</p>
      </div>
    );
  }

  const filteredApps = applications.filter((app) => {
    const matchesStatus = statusFilter === "ALL" || app.status === statusFilter;
    const matchesSearch =
      app.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Operator Applications</h1>
            {pendingCount > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-xs px-2.5 py-1 rounded-full font-bold animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Review and approve prospective Wi-Fi hotspot operators who applied through the public portal
          </p>
        </div>

        <button
          onClick={fetchApplications}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm text-gray-300 w-fit"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by business name, contact, city or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
          />
        </div>

        <div className="flex gap-2">
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? "bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/40"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table / Cards */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-[#00f3ff] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading applications...</p>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="glass-panel p-12 text-center text-gray-400 rounded-2xl">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#00f3ff]" />
          <p className="text-base font-medium text-gray-300">No applications found</p>
          <p className="text-xs text-gray-500 mt-1">
            {statusFilter !== "ALL"
              ? `No applications currently with status ${statusFilter}`
              : "When operators apply via the public website, their submissions will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all shadow-lg"
            >
              <div>
                {/* Header & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00f3ff]/20 to-[#9d00ff]/20 border border-[#00f3ff]/30 flex items-center justify-center text-[#00f3ff]">
                      <Building size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{app.businessName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                        <MapPin size={12} className="text-[#00f3ff]" />
                        <span>{app.city}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                      app.status === "PENDING"
                        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                        : app.status === "APPROVED"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-gray-300 py-3 border-y border-white/5 my-3">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-500 shrink-0" />
                    <span>{app.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-500 shrink-0" />
                    <span className="truncate">{app.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-500 shrink-0" />
                    <a href={`tel:${app.phone}`} className="text-[#00f3ff] hover:underline">
                      {app.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock size={14} className="shrink-0" />
                    <span>Applied: {new Date(app.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Message */}
                {app.message && (
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-xs text-gray-400 italic mb-4">
                    &ldquo;{app.message}&rdquo;
                  </div>
                )}

                {/* Rejection Note */}
                {app.reviewNote && (
                  <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 text-xs text-red-300 mb-4">
                    <strong>Review note:</strong> {app.reviewNote}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {app.status === "PENDING" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setApprovingApp(app);
                        setActionError("");
                        setActionSuccess("");
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40 rounded-xl text-xs font-bold transition-colors"
                    >
                      <CheckCircle size={14} />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => {
                        setRejectingApp(app);
                        setActionError("");
                        setActionSuccess("");
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-xl text-xs font-bold transition-colors"
                    >
                      <XCircle size={14} />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : app.status === "APPROVED" ? (
                  <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-green-400 font-semibold bg-green-500/5 rounded-xl border border-green-500/20">
                    <CheckCircle size={14} />
                    <span>Active Tenant Account Created</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-red-400 font-semibold bg-red-500/5 rounded-xl border border-red-500/20">
                    <XCircle size={14} />
                    <span>Application Rejected</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {approvingApp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="text-green-400" />
              <span>Approve Operator</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Approving will create a new tenant workspace for{" "}
              <strong className="text-white">{approvingApp.businessName}</strong> and generate login credentials for{" "}
              <strong className="text-[#00f3ff]">{approvingApp.email}</strong>.
            </p>

            {actionError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-xl mt-4">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="bg-green-500/10 border border-green-500/40 text-green-400 text-xs p-3 rounded-xl mt-4">
                {actionSuccess}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Assign Initial Password for Operator:
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={approvalPassword}
                    onChange={(e) => setApprovalPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
                    placeholder="Min 8 characters"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Share this password with the operator so they can sign in to the portal.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setApprovingApp(null)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !approvalPassword || approvalPassword.length < 8}
                  onClick={handleApprove}
                  className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? "Processing..." : "Confirm & Create Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingApp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <XCircle className="text-red-400" />
              <span>Reject Application</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Mark application for <strong className="text-white">{rejectingApp.businessName}</strong> as rejected.
            </p>

            {actionError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-xl mt-4">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="bg-green-500/10 border border-green-500/40 text-green-400 text-xs p-3 rounded-xl mt-4">
                {actionSuccess}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Reason / Note for rejection:</label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRejectingApp(null)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !rejectNote}
                  onClick={handleReject}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

