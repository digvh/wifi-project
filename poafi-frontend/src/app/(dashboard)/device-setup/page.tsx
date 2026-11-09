"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Wrench, Plus, CheckCircle2, Clock } from "lucide-react";

type SetupRequest = {
  id: string;
  requestType: string;
  status: string;
  deviceName: string | null;
  deviceVendor: string | null;
  notes: string | null;
  createdAt: string;
};

export default function DeviceSetupPage() {
  const [requests, setRequests] = useState<SetupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [deviceName, setDeviceName] = useState("");
  const [deviceVendor, setDeviceVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/device-setup");
      setRequests(res.requests || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load setup requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/device-setup", {
        method: "POST",
        body: JSON.stringify({
          requestType: "ASSISTED",
          deviceName,
          deviceVendor,
          notes,
        }),
      });
      setDeviceName("");
      setDeviceVendor("");
      setNotes("");
      setShowForm(false);
      await loadRequests();
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Device Setup Requests</h1>
          <p className="text-gray-400 text-sm mt-1">
            Request remote assistance from the PoaFi team to configure your router or access point.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg flex items-center gap-2"
        >
          <Plus size={16} />
          {showForm ? "Cancel" : "New Setup Request"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 flex items-center gap-3 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4 rounded-2xl max-w-2xl">
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <Wrench size={18} className="text-[#00f3ff]" /> Request Device Setup
          </h2>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Device Name</label>
            <input
              required
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. MikroTik hEX at Arusha Branch"
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Device Brand / Vendor</label>
            <input
              required
              value={deviceVendor}
              onChange={(e) => setDeviceVendor(e.target.value)}
              placeholder="e.g. MikroTik, TP-Link, Ubiquiti"
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Notes / Instructions</label>
            <textarea
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific details about your network or what you need help with..."
              className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-sm min-h-[100px]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-[#00f3ff]" /> Request History ({requests.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            You have no setup requests yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((req) => (
              <div key={req.id} className="p-4 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white">{req.deviceName || "Unnamed Device"}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                    {req.deviceVendor || "Unknown Vendor"}
                  </span>
                  {req.status === "PENDING" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
                      <Clock size={10} /> Pending
                    </span>
                  )}
                  {req.status === "COMPLETED" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Completed
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Submitted: {new Date(req.createdAt).toLocaleDateString()}
                </p>
                {req.notes && <p className="text-xs text-gray-500 italic mt-1">{req.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}