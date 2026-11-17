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
  Lock,
  Layers,
  Router,
  Radio
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [tenant, setTenant] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState("MIXED");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      const data = await apiFetch("/tenants/settings");
      if (data?.tenant) {
        setTenant(data.tenant);
        setPaymentMode(data.tenant.paymentMode || "MIXED");
        setBusinessName(data.tenant.name || "");
      }
    } catch (err: any) {
      // In case user is platform admin or endpoint is not tenant-specific
      console.warn("Could not load tenant settings:", err.message);
    } finally {
      setLoading(false);
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
          name: businessName.trim() || undefined
        }),
      });
      setSuccess("Mipangilio imehifadhiwa kikamilifu! / Settings saved successfully!");
      fetchTenantSettings();
    } catch (err: any) {
      setError(err.message || "Imeshindwa kuhifadhi mipangilio / Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleteSuccess("");

    if (!deletePassword && confirmPhrase !== "DELETE") {
      setDeleteError("Tafadhali weka nenosiri lako au andika DELETE / Please enter your password or type DELETE to confirm");
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

      setDeleteSuccess(res.message || "Akaunti imefutwa kikamilifu / Account deleted successfully");
      
      // Delay logout slightly so user sees confirmation
      setTimeout(() => {
        logout();
        router.push("/login");
      }, 1800);
    } catch (err: any) {
      setDeleteError(err.message || "Imeshindwa kufuta akaunti / Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="text-[#00f3ff] w-8 h-8" />
          <span>Mipangilio ya Biashara / Operator Settings</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Sanidi namna wateja wako wanavyolipa na fikia huduma ya Wi-Fi kwenye mtandao wako.
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

      {/* Operator Summary Card */}
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
                Slug ya mfumo: <code className="text-[#00f3ff] bg-black/40 px-2 py-0.5 rounded">{tenant.slug}</code>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <p className="text-gray-400">Routers</p>
                <p className="text-base font-bold text-[#00f3ff]">{tenant._count?.routers || 0}</p>
              </div>
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <p className="text-gray-400">Vifurushi</p>
                <p className="text-base font-bold text-[#9d00ff]">{tenant._count?.packages || 0}</p>
              </div>
              <div className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-center">
                <p className="text-gray-400">Maeneo (Sites)</p>
                <p className="text-base font-bold text-emerald-400">{tenant._count?.sites || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Settings */}
      <div className="glass-panel p-6 rounded-2xl space-y-6 border border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Maelezo ya Biashara / Business Details</h2>
          <p className="text-xs text-gray-400 mb-4">
            Jina hili litaonekana kwa wateja wako kwenye ukurasa wa malipo ya Wi-Fi (Captive Portal).
          </p>
          <div className="max-w-md">
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Jina la Biashara (Hotspot Brand Name):
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="mfano: Mwanza SkyNet Hotspot"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00f3ff]"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">Hali ya Malipo ya Portal / Portal Payment Mode</h2>
          <p className="text-xs text-gray-400 mb-4">
            Chagua namna wateja wako wanavyolipa ili kupata intaneti. Unaweza kutumia malipo ya simu (M-Pesa, Tigo, n.k.), vocha zilizochapishwa, au zote mbili.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "MIXED",
                title: "Mchanganyiko / Mixed (Pendekezo)",
                badge: "Popular",
                desc: "Wateja wanaweza kulipa moja kwa moja kupitia simu (M-Pesa, Tigo Pesa, Airtel) AU kuweka nambari ya vocha.",
              },
              {
                id: "MOBILE_ONLY",
                title: "Malipo ya Simu Tu / Mobile Money Only",
                badge: "Digital",
                desc: "Wateja wanalipa tu mtandaoni kupitia simu zao. Sehemu ya vocha itafichwa.",
              },
              {
                id: "VOUCHER_ONLY",
                title: "Vocha Tu / Voucher Only",
                badge: "Physical",
                desc: "Wateja lazima wanunue na kuweka vocha iliyochapishwa mkononi. Malipo ya simu yatafichwa.",
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
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          paymentMode === mode.id
                            ? "border-[#00f3ff] bg-[#00f3ff]"
                            : "border-gray-500"
                        }`}
                      >
                        {paymentMode === mode.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                      <h3 className="font-bold text-white text-sm">{mode.title}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">{mode.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Hali:</span>
                  <span className={`font-semibold ${paymentMode === mode.id ? "text-[#00f3ff]" : "text-gray-400"}`}>
                    {paymentMode === mode.id ? "Imechaguliwa" : "Bofya kuchagua"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] hover:opacity-90 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-[#00f3ff]/20 disabled:opacity-50 transition-all"
          >
            <Save size={16} />
            <span>{saving ? "Inahifadhi..." : "Hifadhi Mipangilio / Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className="glass-panel p-6 rounded-2xl border border-red-500/30 bg-red-950/10 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-red-400">Eneo Hatari / Danger Zone</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Kufuta akaunti yako ya Operator ni kitendo cha kudumu na hakiwezi kurejeshwa. Taarifa zote zikiwemo
              routers, vifurushi, vocha, kumbukumbu za malipo, na maeneo (sites) zitafutwa kabisa kwenye mfumo wa PoaFi.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-red-300/80">
            ⚠️ Wateja waliopo kwenye Wi-Fi watakatwa mara moja baada ya kufuta akaunti.
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
            <span>Futa Akaunti Yangu / Delete Account</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-red-500/40 bg-zinc-950 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/20 rounded-xl border border-red-500/30">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Thibitisha Kufuta Akaunti</h3>
                <p className="text-xs text-red-400">Permanent Account Deletion</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl text-xs text-red-200 space-y-1.5">
              <p className="font-semibold text-red-400">Je, una uhakika unataka kufuta biashara yako ya Wi-Fi?</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                <li>Routers zako zote zitafutwa</li>
                <li>Vifurushi na vocha zote zitateketea</li>
                <li>Hautoweza kuingia tena kwenye akaunti hii</li>
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
                    <span>Weka Nenosiri Lako la Kuingilia (Password):</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Nenosiri lako..."
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
                    Au andika <span className="text-red-400 font-mono font-bold">DELETE</span> kuthibitisha:
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
                    Ghairi / Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleting || (!deletePassword && confirmPhrase !== "DELETE")}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                    <span>{deleting ? "Inafuta..." : "Ndio, Futa Milele"}</span>
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
