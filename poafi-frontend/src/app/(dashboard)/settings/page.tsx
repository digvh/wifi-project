"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Settings,
  Save,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [tenant, setTenant] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState("MIXED");
  const [businessName, setBusinessName] = useState("");
  const [portalColor, setPortalColor] = useState("#00f3ff");
  const [portalLogoUrl, setPortalLogoUrl] = useState("");
  const [portalTagline, setPortalTagline] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Account deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  useEffect(() => {
    fetchTenantSettings();
  }, []);

  const fetchTenantSettings = async () => {
    try {
      const data = await apiFetch("/tenants/settings");
      if (data?.tenant) {
        setTenant(data.tenant);
        setPaymentMode(data.tenant.paymentMode || "MIXED");
        setBusinessName(data.tenant.name || "");
        setPortalColor(data.tenant.portalColor || "#00f3ff");
        setPortalLogoUrl(data.tenant.portalLogoUrl || "");
        setPortalTagline(data.tenant.portalTagline || "");
        setSupportPhone(data.tenant.supportPhone || "");
      }
    } catch (err: any) {
      console.warn("Could not load tenant settings:", err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/tenants/settings", {
        method: "PATCH",
        body: JSON.stringify({
          paymentMode,
          name: businessName.trim() || undefined,
          portalColor,
          portalLogoUrl: portalLogoUrl.trim(),
          portalTagline: portalTagline.trim(),
          supportPhone: supportPhone.trim(),
        }),
      });
      setSuccess(t("Mipangilio imehifadhiwa kikamilifu!", "Settings saved successfully!"));
      fetchTenantSettings();
    } catch (err: any) {
      setError(err.message || t("Imeshindwa kuhifadhi mipangilio", "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleteSuccess("");

    if (!deletePassword && confirmPhrase !== "DELETE") {
      setDeleteError(
        t(
          "Tafadhali weka nenosiri lako au andika DELETE",
          "Please enter your password or type DELETE to confirm",
        ),
      );
      return;
    }

    try {
      setDeleting(true);
      const res = await apiFetch("/tenants/my-account", {
        method: "DELETE",
        body: JSON.stringify({
          password: deletePassword || undefined,
          confirmation: confirmPhrase || undefined,
        }),
      });

      setDeleteSuccess(res.message || t("Akaunti imefutwa kikamilifu", "Account deleted successfully"));

      setTimeout(() => {
        logout();
        router.push("/login");
      }, 1800);
    } catch (err: any) {
      setDeleteError(err.message || t("Imeshindwa kufuta akaunti", "Failed to delete account"));
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="text-[#00f3ff] w-8 h-8" />
          <span>{t("Mipangilio ya Biashara", "Operator Settings")}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {t(
            "Sanidi namna wateja wako wanavyolipa na kupata huduma ya Wi-Fi kwenye mtandao wako.",
            "Configure how your customers pay and connect on your Wi-Fi portal.",
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm flex items-center gap-3">
          <ShieldAlert className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle className="text-green-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {tenant && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#00f3ff]/10 to-transparent pointer-events-none rounded-full blur-2xl" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="text-[#00f3ff] w-5 h-5" />
                <h2 className="text-xl font-bold text-white">{tenant.name}</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t("Utambulisho wa mfumo:", "System slug:")}{" "}
                <code className="text-[#00f3ff] bg-black/40 px-2 py-0.5 rounded">{tenant.slug}</code>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <p className="text-gray-400">Routers</p>
                <p className="text-base font-bold text-[#00f3ff]">{tenant._count?.routers || 0}</p>
              </div>
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <p className="text-gray-400">{t("Vifurushi", "Packages")}</p>
                <p className="text-base font-bold text-[#9d00ff]">{tenant._count?.packages || 0}</p>
              </div>
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <p className="text-gray-400">{t("Maeneo", "Sites")}</p>
                <p className="text-base font-bold text-emerald-400">{tenant._count?.sites || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl space-y-6 border border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">{t("Maelezo ya Biashara", "Business Details")}</h2>
          <p className="text-xs text-gray-400 mb-4">
            {t(
              "Jina hili litaonekana kwa wateja wako kwenye ukurasa wa malipo ya Wi-Fi (Captive Portal).",
              "This name is displayed to customers on your Wi-Fi Captive Portal.",
            )}
          </p>
          <div className="max-w-md">
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              {t("Jina la Biashara (Hotspot Brand Name):", "Business Name (Hotspot Brand Name):")}
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t("mfano: Mwanza SkyNet Hotspot", "e.g. Mwanza SkyNet Hotspot")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">{t("Hali ya Malipo ya Portal", "Portal Payment Mode")}</h2>
          <p className="text-xs text-gray-400 mb-4">
            {t(
              "Chagua namna wateja wako wanavyolipa ili kupata intaneti. Unaweza kutumia malipo ya simu, vocha, au zote mbili.",
              "Choose how customers buy Wi-Fi: automated mobile money, printed vouchers, or both.",
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "MIXED",
                title: t("Mchanganyiko (Pendekezo)", "Mixed (Recommended)"),
                desc: t(
                  "Wateja wanaweza kulipa kwa simu (M-Pesa, Tigo Pesa, Airtel) AU kuweka vocha.",
                  "Customers can pay via Mobile Money (M-Pesa, Tigo, Airtel) or enter a printed Voucher.",
                ),
              },
              {
                id: "MOBILE_ONLY",
                title: t("Malipo ya Simu Pekee", "Mobile Money Only"),
                desc: t(
                  "Wateja wanalipa mtandaoni kupitia simu zao pekee. Sehemu ya vocha itafichwa.",
                  "Customers can only pay online via mobile money. Hides voucher input.",
                ),
              },
              {
                id: "VOUCHER_ONLY",
                title: t("Vocha Pekee", "Voucher Only"),
                desc: t(
                  "Wateja lazima waweke vocha iliyochapishwa. Malipo ya simu yatafichwa.",
                  "Customers must enter a printed voucher code. Hides mobile money payment.",
                ),
              },
            ].map((mode) => (
              <div
                key={mode.id}
                onClick={() => setPaymentMode(mode.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  paymentMode === mode.id
                    ? "bg-[#00f3ff]/10 border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.15)] ring-1 ring-[#00f3ff]"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMode === mode.id ? "border-[#00f3ff] bg-[#00f3ff]" : "border-gray-500"
                      }`}
                    >
                      {paymentMode === mode.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                    <h3 className="font-bold text-white text-sm">{mode.title}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">{mode.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                  <span>{t("Hali:", "Status:")}</span>
                  <span className={`font-semibold ${paymentMode === mode.id ? "text-[#00f3ff]" : "text-gray-400"}`}>
                    {paymentMode === mode.id ? t("Imechaguliwa", "Selected") : t("Bofya kuchagua", "Click to select")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Captive Portal Branding */}
        <div className="pt-4 border-t border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                {t("Mwonekano wa Captive Portal (Chapa Yako)", "Custom Captive Portal Branding")}
              </h3>
              <p className="text-xs text-gray-400">
                {t(
                  "Weka rangi yako, nembo (logo), kaulimbiu na namba ya msaada kwa wateja.",
                  "Customize brand accent color, logo, welcome tagline, and customer support phone."
                )}
              </p>
            </div>
            {tenant?.slug && (
              <a
                href={`/portal?tenant=${encodeURIComponent(tenant.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#00f3ff] hover:underline font-semibold shrink-0"
              >
                {t("Hakiki Portal Yako ↗", "Preview Portal ↗")}
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                {t("Rangi Kuu ya Portal", "Portal Accent Color")}
              </label>
              <div className="flex items-center gap-2.5 flex-wrap">
                <input
                  type="color"
                  value={portalColor}
                  onChange={(e) => setPortalColor(e.target.value)}
                  className="w-10 h-10 rounded-lg bg-transparent border border-white/20 cursor-pointer"
                />
                {["#00f3ff", "#10b981", "#f59e0b", "#ec4899", "#6366f1"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPortalColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      portalColor.toLowerCase() === c ? "border-white scale-110" : "border-white/20"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
                <code className="text-xs text-gray-400 font-mono">{portalColor}</code>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                {t("Simu ya Msaada kwa Wateja (Hiari)", "Customer Support Phone (Optional)")}
              </label>
              <input
                type="text"
                maxLength={30}
                placeholder="e.g. +255 754 000 000"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                {t("Kaulimbiu ya Karibu (Tagline, Hiari)", "Welcome Tagline (Optional)")}
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder={t("mfano: Intaneti ya Kasi ya Juu Mjini", "e.g. Fast Fiber Hotspot Wi-Fi")}
                value={portalTagline}
                onChange={(e) => setPortalTagline(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                {t("Kiungo cha Nembo (Logo URL, Hiari)", "Logo Image URL (Optional)")}
              </label>
              <input
                type="url"
                maxLength={400}
                placeholder="https://example.com/logo.png"
                value={portalLogoUrl}
                onChange={(e) => setPortalLogoUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] hover:opacity-90 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-[#00f3ff]/20 disabled:opacity-50 transition-all"
          >
            <Save size={16} />
            <span>{saving ? t("Inahifadhi...", "Saving...") : t("Hifadhi Mipangilio", "Save Settings")}</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-panel p-6 rounded-2xl border border-red-500/30 bg-red-950/10 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-red-400">{t("Eneo Hatari", "Danger Zone")}</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              {t(
                "Kufuta akaunti yako ya Operator ni kitendo cha kudumu na hakiwezi kurejeshwa. Taarifa zote zikiwemo routers, vifurushi, vocha, kumbukumbu za malipo, na maeneo zitafutwa kabisa kwenye mfumo wa PoaFi.",
                "Deleting your Operator account is permanent and cannot be undone. All routers, packages, vouchers, payment history, and sites will be permanently erased.",
              )}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-red-300/80">
            ⚠️ {t("Wateja waliopo kwenye Wi-Fi watakatwa mara moja baada ya kufuta akaunti.", "Connected Wi-Fi customers will be disconnected immediately after deletion.")}
          </div>
          <button
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteError("");
              setDeleteSuccess("");
              setDeletePassword("");
              setConfirmPhrase("");
            }}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0"
          >
            <Trash2 size={15} />
            <span>{t("Futa Akaunti Yangu", "Delete My Account")}</span>
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-red-500/40 bg-zinc-950 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/20 rounded-xl border border-red-500/30">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t("Thibitisha Kufuta Akaunti", "Confirm Account Deletion")}</h3>
                <p className="text-xs text-red-400">{t("Kufutwa kwa Kudumu", "Permanent Deletion")}</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl text-xs text-red-200 space-y-1.5">
              <p className="font-semibold text-red-400">
                {t("Je, una uhakika unataka kufuta biashara yako ya Wi-Fi?", "Are you sure you want to delete your Wi-Fi business?")}
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                <li>{t("Routers zako zote zitafutwa", "All your routers will be deleted")}</li>
                <li>{t("Vifurushi na vocha zote zitafutwa", "All packages and vouchers will be wiped")}</li>
                <li>{t("Hutaweza kuingia tena kwenye akaunti hii", "You will not be able to log in again")}</li>
              </ul>
            </div>

            {deleteError && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-red-400" />
                <span>{deleteError}</span>
              </div>
            )}

            {deleteSuccess && (
              <div className="bg-green-500/20 border border-green-500/50 text-green-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0 text-green-400" />
                <span>{deleteSuccess}</span>
              </div>
            )}

            {!deleteSuccess && (
              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-gray-300 mb-1.5">
                    <span>{t("Weka Nenosiri Lako la Kuingilia:", "Enter Your Account Password:")}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder={t("Nenosiri lako...", "Your password...")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    {t("Au andika DELETE kuthibitisha:", "Or type DELETE to confirm:")}
                  </label>
                  <input
                    type="text"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  >
                    {t("Ghairi", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={deleting || (!deletePassword && confirmPhrase !== "DELETE")}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                    <span>{deleting ? t("Inafuta...", "Deleting...") : t("Ndio, Futa Milele", "Yes, Delete Forever")}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
