"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Package, ShieldAlert, Trash2, Building2, CheckCircle2, RefreshCw, Sparkles, Gift, PauseCircle, PlayCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

type DurationUnit = "hours" | "minutes" | "seconds";

function toDurationMinutes(value: string, unit: DurationUnit): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (unit === "hours") return Math.max(1, Math.round(num * 60));
  if (unit === "seconds") return Math.max(1, Math.round(num / 60));
  return Math.max(1, Math.round(num));
}

export default function PackagesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isSuperAdmin = user?.role === "PLATFORM_ADMIN";

  const [packages, setPackages] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [filterTenantId, setFilterTenantId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");
  const [formData, setFormData] = useState({
    name: "1 Hour Pass",
    priceTzs: "500",
    durationValue: "1",
    downloadKbps: "3000",
    uploadKbps: "1000",
    isOffer: false,
    offerType: "FIRST_TIME_FREE" as "FIRST_TIME_FREE" | "LIMITED_PROMO" | "HAPPY_HOUR",
    originalPriceTzs: "",
    offerEndsAt: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPackages = async (tenantFilter?: string) => {
    try {
      setLoading(true);
      const query = tenantFilter ? `?tenantId=${tenantFilter}` : "";
      const calls: Promise<any>[] = [apiFetch(`/packages${query}`)];

      if (isSuperAdmin) {
        calls.push(apiFetch("/tenants"));
      }

      const [pkgRes, tenantsRes] = await Promise.all(calls);
      setPackages(pkgRes.packages || []);

      if (tenantsRes?.tenants) {
        setTenants(tenantsRes.tenants);
        if (tenantsRes.tenants.length > 0 && !selectedTenantId) {
          setSelectedTenantId(tenantsRes.tenants[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages(filterTenantId);
  }, [user, filterTenantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isSuperAdmin && !selectedTenantId) {
      setError(t("Tafadhali chagua Mwendeshaji kwanza", "Please select an Operator to create package for"));
      return;
    }

    const durationMinutes = toDurationMinutes(formData.durationValue, durationUnit);
    if (durationMinutes < 1) {
      setError(t("Tafadhali weka muda sahihi wa kifurushi", "Please enter a valid package duration"));
      return;
    }

    try {
      await apiFetch("/packages", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          priceTzs: formData.isOffer && formData.offerType === "FIRST_TIME_FREE" ? "0" : formData.priceTzs,
          durationMinutes: String(durationMinutes),
          downloadKbps: formData.downloadKbps,
          uploadKbps: formData.uploadKbps,
          tenantId: isSuperAdmin ? selectedTenantId : undefined,
          isOffer: formData.isOffer,
          offerType: formData.isOffer ? formData.offerType : null,
          offerActive: true,
          originalPriceTzs:
            formData.isOffer && formData.offerType !== "FIRST_TIME_FREE" && formData.originalPriceTzs
              ? Number(formData.originalPriceTzs)
              : null,
          offerEndsAt:
            formData.isOffer && formData.offerEndsAt
              ? new Date(formData.offerEndsAt).toISOString()
              : null,
        }),
      });
      setSuccess(t("Kifurushi kimeundwa kikamilifu!", "Package created successfully!"));
      fetchPackages(filterTenantId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleOffer = async (pkg: any) => {
    try {
      await apiFetch(`/packages/${pkg.id}`, {
        method: "PUT",
        body: JSON.stringify({ offerActive: !pkg.offerActive }),
      });
      setSuccess(
        !pkg.offerActive
          ? t("Ofa imewashwa kwenye portal!", "Offer activated on portal!")
          : t("Ofa imesitishwa kwa muda!", "Offer paused on portal!")
      );
      fetchPackages(filterTenantId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t(`Una uhakika unataka kufuta kifurushi "${name}"?`, `Are you sure you want to delete package "${name}"?`))) return;
    try {
      await apiFetch(`/packages/${id}`, { method: "DELETE" });
      setSuccess(t("Kifurushi kimefutwa kikamilifu", "Package deleted successfully"));
      fetchPackages(filterTenantId);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="text-[#00f3ff] w-8 h-8" />
            <span>{t("Vifurushi vya Intaneti", "Internet Packages")}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t("Weka bei, kasi na muda wa matumizi kwa wateja wako wa Wi-Fi.", "Configure pricing, speeds, and time durations for your hotspot portals.")}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-xs text-gray-300">
            <Building2 className="text-[#00f3ff] w-4 h-4" />
            <span>{t("Chuja kwa Mwendeshaji:", "Filter by Operator:")}</span>
            <select
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="bg-[#0a0a1a] border border-white/20 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#00f3ff]"
            >
              <option value="">{t("Wote", "All Operators")} ({tenants.length})</option>
              {tenants.map(tItem => (
                <option key={tItem.id} value={tItem.id}>
                  {tItem.name} ({tItem.slug})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-sm">
          <ShieldAlert className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="text-green-400 bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-panel p-6 h-fit rounded-2xl border border-white/10 space-y-4"
        >
          <h2 className="text-lg font-bold text-white">{t("Unda Kifurushi", "Create Package")}</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {isSuperAdmin && (
              <div className="space-y-1">
                <label className="text-[11px] text-[#00f3ff] font-bold flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>{t("Chagua Mwendeshaji: *", "Select Operator: *")}</span>
                </label>
                <select
                  required
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full bg-[#0a0a1a] border border-[#00f3ff]/40 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                >
                  <option value="">{t("-- Chagua Mwendeshaji --", "-- Select Operator --")}</option>
                  {tenants.map(tItem => (
                    <option key={tItem.id} value={tItem.id}>
                      🏢 {tItem.name} ({tItem.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">{t("Jina la Kifurushi", "Package Name")}</label>
              <input
                type="text"
                placeholder={t("mfano: Saa 10", "Package Name (e.g. 10 Hours)")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">{t("Bei (TZS)", "Price (TZS)")}</label>
              <input
                type="number"
                placeholder="500"
                disabled={formData.isOffer && formData.offerType === "FIRST_TIME_FREE"}
                value={formData.isOffer && formData.offerType === "FIRST_TIME_FREE" ? "0" : formData.priceTzs}
                onChange={(e) => setFormData({ ...formData, priceTzs: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff] disabled:opacity-50"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">{t("Muda wa Matumizi", "Duration")}</label>
              <div className="grid grid-cols-5 gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder={durationUnit === "hours" ? "1" : durationUnit === "minutes" ? "60" : "60"}
                  value={formData.durationValue}
                  onChange={(e) => setFormData({ ...formData, durationValue: e.target.value })}
                  className="col-span-3 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                  aria-label={t("Kipimo cha muda", "Duration unit")}
                  className="col-span-2 bg-[#0a0a1a] border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                >
                  <option value="hours">{t("Saa", "Hours")}</option>
                  <option value="minutes">{t("Dakika", "Minutes")}</option>
                  <option value="seconds">{t("Sekunde", "Seconds")}</option>
                </select>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {(() => {
                  const mins = toDurationMinutes(formData.durationValue, durationUnit);
                  if (mins <= 0) return t("Weka namba kubwa kuliko 0", "Enter a value greater than 0");
                  return durationUnit === "seconds"
                    ? t(`= Dakika ${mins} (kiwango cha chini dakika 1)`, `= ${mins} min (minimum 1 minute)`)
                    : t(`= Dakika ${mins}`, `= ${mins} minutes`);
                })()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">{t("Kupakua (Kbps)", "Down (Kbps)")}</label>
                <input
                  type="number"
                  placeholder="3000"
                  value={formData.downloadKbps}
                  onChange={(e) => setFormData({ ...formData, downloadKbps: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">{t("Kupakia (Kbps)", "Up (Kbps)")}</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={formData.uploadKbps}
                  onChange={(e) => setFormData({ ...formData, uploadKbps: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-3">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Gift size={14} /> {t("Weka Kama Kifurushi cha Ofa (Hiari)", "Make this an Offer Package (Optional)")}
                </span>
                <input
                  type="checkbox"
                  checked={formData.isOffer}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData((prev) => ({
                      ...prev,
                      isOffer: checked,
                      ...(checked && prev.offerType === "FIRST_TIME_FREE"
                        ? { priceTzs: "0", durationValue: "5", name: prev.name === "1 Hour Pass" ? "5 Min Free Trial" : prev.name }
                        : {}),
                    }));
                    if (checked && formData.offerType === "FIRST_TIME_FREE") {
                      setDurationUnit("minutes");
                    }
                  }}
                  className="rounded accent-amber-400"
                />
              </label>

              {formData.isOffer && (
                <div className="space-y-3 pt-1 border-t border-amber-500/20">
                  <div>
                    <label className="text-[11px] font-medium text-gray-300 block mb-1">
                      {t("Aina ya Ofa", "Offer Type")}
                    </label>
                    <select
                      value={formData.offerType}
                      onChange={(e) => {
                        const nextType = e.target.value as "FIRST_TIME_FREE" | "LIMITED_PROMO" | "HAPPY_HOUR";
                        setFormData((prev) => ({
                          ...prev,
                          offerType: nextType,
                          ...(nextType === "FIRST_TIME_FREE"
                            ? { priceTzs: "0", durationValue: "5", name: "5 Min Free Trial" }
                            : { priceTzs: prev.priceTzs === "0" ? "500" : prev.priceTzs }),
                        }));
                        if (nextType === "FIRST_TIME_FREE") {
                          setDurationUnit("minutes");
                        }
                      }}
                      className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400"
                    >
                      <option value="FIRST_TIME_FREE">
                        {t("Ofa ya Bure Mara ya Kwanza (0 TZS — Mara Moja Tu)", "First-Time Free Trial (0 TZS — Once Only)")}
                      </option>
                      <option value="LIMITED_PROMO">
                        {t("Ofa ya Punguzo la Muda", "Limited-Time Promo / Discount")}
                      </option>
                      <option value="HAPPY_HOUR">
                        {t("Ofa Maalum / Happy Hour", "Happy Hour / Special Deal")}
                      </option>
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formData.offerType === "FIRST_TIME_FREE"
                        ? t(
                            "Mteja mpya anapata intaneti ya bure siku ya kwanza (mfano dakika 5), kisha hawezi kuipata tena.",
                            "New visitors get free Wi-Fi once on their first visit (e.g. 5 mins), and can never claim it again."
                          )
                        : t(
                            "Huonekana na lebo maalum ya ofa kwenye portal ya wateja.",
                            "Highlighted with a promotional badge on the customer portal."
                          )}
                    </p>
                  </div>

                  {formData.offerType !== "FIRST_TIME_FREE" && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-300 block mb-1">
                        {t("Bei ya Zamani kabla ya punguzo (TZS, hiari)", "Original Price before discount (TZS, optional)")}
                      </label>
                      <input
                        type="number"
                        placeholder="1000"
                        value={formData.originalPriceTzs}
                        onChange={(e) => setFormData({ ...formData, originalPriceTzs: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-medium text-gray-300 block mb-1">
                      {t("Mwisho wa Ofa (hiari)", "Offer Expiry (optional)")}
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.offerEndsAt}
                      onChange={(e) => setFormData({ ...formData, offerEndsAt: e.target.value })}
                      className="w-full bg-[#0a0a1a] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl text-sm transition-opacity hover:opacity-90 shadow-lg shadow-[#00f3ff]/20"
            >
              {t("Hifadhi Kifurushi", "Save Package")}
            </motion.button>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="glass-panel p-6 md:col-span-2 rounded-2xl border border-white/10 space-y-4"
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-white">{t("Vifurushi", "Packages")} ({packages.length})</h2>
            <button
              onClick={() => fetchPackages(filterTenantId)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("Sasisha", "Refresh")}
            </button>
          </div>

          <div className="space-y-3">
            {packages.length === 0 ? (
              <p className="text-gray-400 text-xs p-4">{t("Hakuna vifurushi vilivyoundwa bado.", "No packages created yet.")}</p>
            ) : (
              packages.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  whileHover={{ y: -2 }}
                  className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#9d00ff]/20 text-[#9d00ff] rounded-xl border border-[#9d00ff]/30">
                      <Package size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-base text-white">{p.name}</p>
                        {p.isOffer && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            !p.offerActive
                              ? "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              : p.offerType === "FIRST_TIME_FREE"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }`}>
                            <Sparkles size={10} />
                            {!p.offerActive
                              ? t("OFA IMESITISHWA", "OFFER PAUSED")
                              : p.offerType === "FIRST_TIME_FREE"
                                ? t("BURE MARA YA KWANZA", "FREE FIRST-TIME")
                                : p.offerType === "HAPPY_HOUR"
                                  ? t("HAPPY HOUR", "HAPPY HOUR")
                                  : t("OFA MAALUM", "PROMO OFFER")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {p.durationMinutes >= 1440
                          ? `${(p.durationMinutes / 1440).toFixed(p.durationMinutes % 1440 === 0 ? 0 : 1)} ${t("Siku", "Days")}`
                          : p.durationMinutes >= 60
                            ? `${(p.durationMinutes / 60).toFixed(p.durationMinutes % 60 === 0 ? 0 : 1)} ${t("Saa", "Hrs")} (${p.durationMinutes} ${t("Dak", "Min")})`
                            : `${p.durationMinutes} ${t("Dakika", "Minutes")}`} • {Math.round(p.downloadKbps / 1000)} Mbps {t("Kupakua", "Down")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {p.isOffer && p.originalPriceTzs && p.originalPriceTzs > p.priceTzs && (
                        <p className="text-[11px] text-gray-500 line-through">
                          TZS {Number(p.originalPriceTzs).toLocaleString()}
                        </p>
                      )}
                      <p className="font-bold text-[#00f3ff] text-lg">
                        {Number(p.priceTzs) === 0 ? t("BURE", "FREE") : `TZS ${Number(p.priceTzs).toLocaleString()}`}
                      </p>
                    </div>
                    {p.isOffer && (
                      <button
                        onClick={() => handleToggleOffer(p)}
                        className={`p-2 rounded-lg transition-colors border text-xs flex items-center gap-1 ${
                          p.offerActive
                            ? "text-amber-300 hover:bg-amber-500/10 border-amber-500/20"
                            : "text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/20"
                        }`}
                        title={p.offerActive ? t("Sitisha ofa", "Pause offer") : t("Washa ofa", "Activate offer")}
                      >
                        {p.offerActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors border border-red-500/10"
                      title={t("Futa kifurushi", "Delete package")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
