"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Ticket, Printer, RefreshCw, Trash2, CheckCircle2, ShieldAlert, Sparkles, Grid } from "lucide-react";

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [generatedBatch, setGeneratedBatch] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [printLayout, setPrintLayout] = useState<"thermal" | "grid">("thermal");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async () => {
    try {
      const [packagesData, vouchersData] = await Promise.all([
        apiFetch("/packages"),
        apiFetch(`/vouchers?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ""}`),
      ]);
      setPackages(packagesData.packages || []);
      if (packagesData.packages && packagesData.packages.length > 0 && !selectedPackage) {
        setSelectedPackage(packagesData.packages[0].id);
      }
      setVouchers(vouchersData.vouchers || []);
      setTotalPages(vouchersData.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, statusFilter]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch("/vouchers/generate", {
        method: "POST",
        body: JSON.stringify({ packageId: selectedPackage, quantity }),
      });
      setGeneratedBatch(res);
      setSuccess(`Successfully generated ${res.count} vouchers!`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to delete this voucher batch?")) return;
    try {
      await apiFetch(`/vouchers/batch/${batchId}`, { method: "DELETE" });
      setSuccess("Batch deleted successfully");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selectedPkgMeta = packages.find((p) => p.id === selectedPackage);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Screen Header (Hidden during print) */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="text-[#00f3ff]" /> Voucher Generator & POS Thermal Printing
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Create batches of high-security 8-character codes and print professional retail thermal receipts.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 border border-white/10"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="print:hidden text-red-400 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-2 text-sm">
          <ShieldAlert size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="print:hidden text-green-400 bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* Generator & Print Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Generator Form */}
        <div className="glass-panel p-6 h-fit space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-[#00f3ff]" /> Generate Voucher Batch
          </h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Select Package</label>
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="w-full bg-[#0a0a1a] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff] text-sm"
                required
              >
                <option value="" disabled>Select Package...</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — TZS {p.priceTzs.toLocaleString()} ({p.durationMinutes}m)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Batch Quantity (Codes to generate)</label>
              <input
                type="number"
                placeholder="Quantity (e.g. 50)"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00f3ff] text-sm"
                required
                min="1"
                max="500"
              />
              <p className="text-[10px] text-gray-400 mt-1">Maximum 500 vouchers per batch.</p>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity text-sm shadow-lg"
            >
              Generate {quantity} Voucher Codes
            </button>
          </form>

          {/* Generated Batch Preview & Print Control */}
          {generatedBatch && (
            <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-green-400">
                  Ready: {generatedBatch.codes.length} Codes
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPrintLayout("thermal")}
                    className={`px-2 py-1 text-[10px] rounded ${
                      printLayout === "thermal" ? "bg-[#00f3ff] text-black font-bold" : "bg-white/10 text-gray-300"
                    }`}
                  >
                    POS Thermal
                  </button>
                  <button
                    onClick={() => setPrintLayout("grid")}
                    className={`px-2 py-1 text-[10px] rounded ${
                      printLayout === "grid" ? "bg-[#00f3ff] text-black font-bold" : "bg-white/10 text-gray-300"
                    }`}
                  >
                    A4 Grid
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="bg-white text-black font-bold text-xs px-3 py-1 rounded flex items-center gap-1.5 shadow"
                  >
                    <Printer size={13} /> Print
                  </button>
                </div>
              </div>

              <div className="bg-[#050510] border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-[#00f3ff] grid grid-cols-2 gap-2 text-center">
                {generatedBatch.codes.map((code: string, i: number) => (
                  <div key={i} className="bg-white/5 py-1.5 px-2 rounded border border-white/5">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voucher History Table */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-semibold">Voucher Inventory</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0a0a1a] border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
            >
              <option value="">All Vouchers</option>
              <option value="UNUSED">Unused Only (In Stock)</option>
              <option value="ACTIVE">Active (Currently Browsing)</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="p-3">Package</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Batch ID</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vouchers.map((v) => {
                  const isUnused = v.status === "UNUSED";
                  const isActive = v.status === "ACTIVE";
                  return (
                    <tr key={v.id} className="hover:bg-white/5">
                      <td className="p-3 font-medium flex items-center gap-2">
                        <Ticket size={16} className="text-[#00f3ff]" />
                        {v.package?.name}
                      </td>
                      <td className="p-3 font-mono font-semibold text-white">
                        TZS {v.package?.priceTzs?.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            isUnused
                              ? "bg-green-500/20 text-green-400"
                              : isActive
                              ? "bg-[#00f3ff]/20 text-[#00f3ff]"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-400">
                        {v.batchId.slice(0, 14)}...
                      </td>
                      <td className="p-3 text-xs text-gray-400">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleDeleteBatch(v.batchId)}
                          className="text-red-400 hover:text-red-300 p-1.5"
                          title="Delete entire batch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-3 text-xs text-gray-400 border-t border-white/5">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          PRINT ONLY AREA: Formatted for 58mm POS Thermal Roll or A4 Scratch Cards
         ========================================================================= */}
      {generatedBatch && (
        <div className="hidden print:block text-black bg-white">
          <div className={printLayout === "grid" ? "grid grid-cols-3 gap-4 p-4" : "space-y-6 max-w-[280px] mx-auto p-2"}>
            {generatedBatch.codes.map((code: string, idx: number) => (
              <div
                key={idx}
                className="border-2 border-dashed border-black p-4 text-center rounded-lg page-break-inside-avoid space-y-2 bg-white"
                style={{ breakInside: "avoid" }}
              >
                <div className="border-b border-black pb-1.5">
                  <h3 className="font-extrabold text-base tracking-tight uppercase">PoaFi High-Speed Wi-Fi</h3>
                  <p className="text-[10px] uppercase font-semibold">Tanzania Carrier Network</p>
                </div>

                <div>
                  <span className="text-[10px] text-gray-700 uppercase font-medium">Wi-Fi Voucher Code</span>
                  <div className="text-2xl font-mono font-black tracking-widest my-1 border-2 border-black py-1 px-2 rounded bg-gray-50">
                    {code}
                  </div>
                </div>

                <div className="text-xs font-semibold space-y-0.5 border-t border-black pt-1.5">
                  <p className="font-bold">{generatedBatch.packageName}</p>
                  <p className="text-sm font-black">TZS {generatedBatch.price?.toLocaleString()}</p>
                </div>

                <div className="border-t border-gray-300 pt-1 text-[9px] text-gray-600 leading-tight">
                  <p>1. Unganisha na Wi-Fi ya PoaFi</p>
                  <p>2. Fungua portal & weka kodi hii</p>
                  <p className="mt-1 font-mono text-[8px]">Ref: {generatedBatch.batchId.slice(0, 8)} • No. {idx + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
