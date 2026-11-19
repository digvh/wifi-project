"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { 
  Trash2, 
  Key, 
  ShieldAlert, 
  Building2, 
  Plus, 
  AlertTriangle, 
  CheckCircle
} from "lucide-react";

export default function TenantsPage() {
  const { t } = useLanguage();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login Modal State
  const [loginTenantId, setLoginTenantId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Delete Operator Modal State (Admin)
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState("");

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/tenants");
      setTenants(data.tenants || []);
    } catch (err: any) {
      setError(err.message || t("Imeshindikana kupakia waendeshaji", "Failed to load operators"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiFetch("/tenants", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setName("");
      setSlug("");
      setSuccess(t("Mwendeshaji ameundwa kwa mafanikio!", "Operator created successfully!"));
      fetchTenants();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTenant) return;
    setIsDeleting(true);
    setDeleteModalError("");

    try {
      const res = await apiFetch(`/tenants/${deletingTenant.id}`, { method: "DELETE" });
      setSuccess(res.message || t("Mwendeshaji amefutwa kwa mafanikio", "Operator deleted successfully"));
      setDeletingTenant(null);
      fetchTenants();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setDeleteModalError(err.message || t("Imeshindikana kufuta mwendeshaji", "Failed to delete operator"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLogin = async (tenantId: string, userId: string, email: string) => {
    if (
      !confirm(
        t(
          `Futa akaunti ya kuingia ${email}? Hii HAITAFUTA Mwendeshaji, ruta, vifurushi wala kumbukumbu za biashara.`,
          `Delete the login account ${email}? This will NOT delete the Operator, routers, packages or business records.`
        )
      )
    )
      return;
    setError("");
    try {
      await apiFetch(`/tenants/${tenantId}/users/${userId}`, { method: "DELETE" });
      setSuccess(t(`Akaunti ya kuingia ${email} imefutwa.`, `Login account ${email} deleted.`));
      fetchTenants();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoginSuccess("");
    setLoginLoading(true);
    try {
      await apiFetch(`/tenants/${loginTenantId}/create-login`, {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setLoginSuccess(
        t(
          "Akaunti imeundwa kwa mafanikio! Mpatie mwendeshaji taarifa hizi za kuingia.",
          "Login created successfully! Give these credentials to the operator."
        )
      );
      setLoginEmail("");
      setLoginPassword("");
      fetchTenants();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Building2 className="text-[#00f3ff] w-8 h-8" />
          <span>{t("Waendeshaji wa Wi-Fi (Tenants)", "Wi-Fi Operators (Tenants)")}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {t("Simamia waendeshaji wa hotspot, tengeneza akaunti na uangalie mitandao yao nchini.", "Manage hotspot operators, create accounts, and monitor tenant deployments across Tanzania.")}
        </p>
      </div>

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-sm">
          <ShieldAlert className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="text-green-400 bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="glass-panel p-6 md:col-span-1 h-fit rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="text-[#00f3ff]" />
            <h2 className="text-lg font-bold text-white">{t("Ongeza Mwendeshaji Mpya", "Add New Operator")}</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t("Jina la Biashara ya Mwendeshaji", "Operator Business Name")}</label>
              <input
                type="text"
                placeholder={t("mfano: Serengeti Wi-Fi Solutions", "e.g. Serengeti Wi-Fi Solutions")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t("Utambulisho (Slug)", "Slug Identifier")}</label>
              <input
                type="text"
                placeholder={t("mfano: serengeti-wifi", "e.g. serengeti-wifi")}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f3ff] outline-none font-mono"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#00f3ff]/20 text-sm"
            >
              {t("Unda Mwendeshaji", "Create Operator")}
            </button>
          </form>
        </div>

        {/* List of Operators */}
        <div className="glass-panel p-6 md:col-span-2 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{t("Waendeshaji Waliosajiliwa", "Registered Operators")} ({tenants.length})</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-[#00f3ff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">{t("Inapakia waendeshaji...", "Loading operators...")}</p>
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-gray-400 text-sm p-4">{t("Hakuna waendeshaji waliosajiliwa bado.", "No operators registered yet.")}</p>
          ) : (
            <div className="space-y-3">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-base">{tenant.name}</p>
                      <code className="text-xs text-[#00f3ff] bg-black/40 px-2 py-0.5 rounded font-mono">
                        {tenant.slug}
                      </code>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
                      <span>{t("Ruta", "Routers")}: <strong className="text-white">{tenant._count?.routers || 0}</strong></span>
                      <span>•</span>
                      <span>{t("Vifurushi", "Packages")}: <strong className="text-white">{tenant._count?.packages || 0}</strong></span>
                      <span>•</span>
                      <span>{t("Maeneo", "Sites")}: <strong className="text-white">{tenant._count?.sites || 0}</strong></span>
                    </div>

                    {/* Users list */}
                    <div className="mt-2 space-y-1">
                      {(tenant.users || []).map((account: any) => (
                        <div key={account.id} className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="text-[#00f3ff] font-medium">{account.email}</span>
                          <span className="text-gray-500 text-[10px]">({account.role})</span>
                          <button
                            onClick={() => handleDeleteLogin(tenant.id, account.id, account.email)}
                            className="text-red-400 hover:text-red-300 p-0.5 transition-colors"
                            title={t("Futa akaunti hii ya kuingia", "Delete this login account")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {(!tenant.users || tenant.users.length === 0) && (
                        <p className="text-xs text-amber-400">{t("Hakuna akaunti ya kuingia iliyosajiliwa", "No login account registered")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() => {
                        setLoginTenantId(tenant.id);
                        setLoginSuccess("");
                      }}
                      className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Key size={14} className="text-[#00f3ff]" />
                      <span>{t("Ongeza Akaunti", "Add Login")}</span>
                    </button>
                    <button
                      onClick={() => {
                        setDeletingTenant(tenant);
                        setDeleteModalError("");
                        setDeleteConfirmText("");
                      }}
                      className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>{t("Futa", "Delete")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Operator Confirmation Modal (Admin) */}
      {deletingTenant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-red-500/40 bg-zinc-950 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/20 rounded-xl border border-red-500/30">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t("Futa Mwendeshaji (Yote)", "Delete Operator (Cascade)")}</h3>
                <p className="text-xs text-red-400 font-mono">{deletingTenant.slug}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {t("Una uhakika unataka kumfuta kabisa mwendeshaji", "Are you sure you want to completely delete operator")}{" "}
              <strong className="text-white">{deletingTenant.name}</strong>?
            </p>

            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl text-xs text-red-200 space-y-1">
              <p className="font-semibold text-red-400">{t("Yafuatayo yatafutwa kabisa:", "The following will be permanently erased:")}</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                <li>{deletingTenant._count?.routers || 0} {t("Ruta na mipangilio ya WireGuard", "Router(s) and WireGuard configs")}</li>
                <li>{deletingTenant._count?.packages || 0} {t("Vifurushi na Vocha zote", "Package(s) and all Vouchers")}</li>
                <li>{deletingTenant._count?.sites || 0} {t("Maeneo na wateja wa RADIUS", "Site(s) and RADIUS clients")}</li>
                <li>{t("Akaunti zote za kuingia za mwendeshaji na historia ya malipo", "All operator login accounts & payment history")}</li>
              </ul>
            </div>

            {deleteModalError && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-xs p-3 rounded-xl">
                {deleteModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t("Andika", "Type")} <span className="text-red-400 font-mono font-bold">DELETE</span> {t("kuthibitisha:", "to confirm:")}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTenant(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 py-2.5 rounded-xl text-xs font-semibold transition-all"
              >
                {t("Ghairi", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-40"
              >
                <Trash2 size={15} />
                <span>{isDeleting ? t("Inafuta...", "Deleting...") : t("Futa Mwendeshaji", "Delete Operator")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Creation Modal */}
      {loginTenantId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold mb-1 text-white">{t("Unda Akaunti ya Mwendeshaji", "Create Operator Login")}</h2>
            <p className="text-xs text-gray-400 mb-4">
              {t("Unda taarifa za kuingia kwenye mfumo kwa mwendeshaji huyu.", "Create portal access credentials for this operator.")}
            </p>

            {loginSuccess && (
              <div className="text-green-400 bg-green-500/10 border border-green-500/30 p-3 rounded-xl mb-4 text-xs flex items-center gap-2">
                <CheckCircle size={15} className="shrink-0" />
                <span>{loginSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">{t("Barua Pepe ya Mwendeshaji", "Operator Email")}</label>
                <input
                  type="email"
                  placeholder="operator@poafi.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">{t("Nenosiri la Muda", "Temporary Password")}</label>
                <input
                  type="text"
                  placeholder={t("Nenosiri imara...", "Strong password...")}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#00f3ff]"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLoginTenantId(null)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-xl text-xs font-semibold text-gray-300 transition-colors"
                >
                  {t("Funga", "Close")}
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-2.5 rounded-xl text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loginLoading ? t("Inahifadhi...", "Saving...") : t("Hifadhi Taarifa", "Save Credentials")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
