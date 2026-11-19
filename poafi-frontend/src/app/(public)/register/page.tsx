"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Building, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Lock,
  Eye,
  EyeOff,
  Send, 
  CheckCircle, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  BookOpen,
  KeyRound
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

export default function OperatorRegisterPage() {
  const { lang, setLang } = useLanguage();

  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    password: "",
    confirmPassword: "",
    message: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password.length < 8) {
      setError(
        lang === "sw" 
          ? "Nenosiri lazima liwe na angalau herufi 8." 
          : "Password must be at least 8 characters long."
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(
        lang === "sw" 
          ? "Manenosiri hayafanani. Tafadhali hakiki tena." 
          : "Passwords do not match. Please re-enter."
      );
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/applications", {
        method: "POST",
        body: JSON.stringify({
          businessName: formData.businessName,
          contactName: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          city: formData.city,
          password: formData.password,
          message: formData.message,
        }),
      });

      setSuccess(true);
    } catch (err: any) {
      setError(
        err.message ||
          (lang === "sw"
            ? "Imeshindwa kuwasilisha ombi. Tafadhali hakikisha taarifa zako ni sahihi."
            : "Failed to submit application. Please check your details and try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Page Header */}
      <div className="text-center space-y-3">
        {/* Language selector badge */}
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00f3ff]/10 border border-[#00f3ff]/20 text-xs font-bold text-[#00f3ff]">
            <Sparkles size={14} />
            <span>{lang === "sw" ? "Fomu ya Maombi ya Mtoa Huduma" : "Operator Onboarding Application"}</span>
          </div>

          <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full text-xs font-semibold">
            <button
              onClick={() => setLang("sw")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "sw" ? "bg-[#00f3ff] text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              🇹🇿 SW
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "en" ? "bg-[#00f3ff] text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              🇬🇧 EN
            </button>
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white">
          {lang === "sw" ? "Jiunge na Mtandao wa PoaFi Kama Operator" : "Apply to Become a PoaFi Wi-Fi Operator"}
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
          {lang === "sw"
            ? "Tengeneza nenosiri lako mwenyewe litakalotumika kuingia kwenye jukwaa lako. Taarifa zako za eneo na biashara zitajazwa moja kwa moja bila kuhitaji kuandika upya."
            : "Create your own password to log in to your dashboard. Your business & location details will automatically set up your initial site with zero duplicate typing."}
        </p>
      </div>

      {success ? (
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-green-500/30 bg-gradient-to-b from-green-500/10 via-transparent to-transparent text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-green-500/20 text-green-400 flex items-center justify-center mx-auto border border-green-500/30">
            <CheckCircle size={36} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {lang === "sw"
                ? "Hongera! Ombi na Nenosiri Lako Vimerekodiwa."
                : "Congratulations! Application & Password Saved."}
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-lg mx-auto leading-relaxed">
              {lang === "sw" ? (
                <>
                  Ombi la biashara ya <strong className="text-[#00f3ff]">{formData.businessName}</strong> limepokelewa.
                  Nenosiri uliloweka litatumika kuingia moja kwa moja kwenye akaunti yako punde itakapothibitishwa!
                </>
              ) : (
                <>
                  Application for <strong className="text-[#00f3ff]">{formData.businessName}</strong> received.
                  Your password has been saved securely — you will sign in using it immediately upon activation!
                </>
              )}
            </p>
          </div>

          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between text-gray-400">
              <span>{lang === "sw" ? "Barua Pepe ya Kuingilia:" : "Login Email:"}</span>
              <span className="text-white font-mono">{formData.email}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{lang === "sw" ? "Nenosiri:" : "Password:"}</span>
              <span className="text-green-400 font-mono">•••••••• ({lang === "sw" ? "Uliyoweka" : "Yours"})</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{lang === "sw" ? "Eneo la Mwanzo (Site):" : "Initial Location (Site):"}</span>
              <span className="text-[#00f3ff]">{formData.city}</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="px-6 py-3 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold rounded-xl text-xs transition-opacity hover:opacity-90 flex items-center gap-2"
            >
              <span>{lang === "sw" ? "Nenda Kwenye Ukurasa wa Kuingia (Login)" : "Go to Sign In Page"}</span>
              <ArrowRight size={14} />
            </Link>

            <Link
              href="/guide"
              className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
            >
              <BookOpen size={16} />
              <span>{lang === "sw" ? "Soma Mwongozo wa Router" : "Read Router Guide"}</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Benefits & Trust */}
          <div className="space-y-6 lg:col-span-1">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-[#00f3ff]" size={18} />
                <span>{lang === "sw" ? "Faida za Kujiandikisha" : "Zero-Effort Setup"}</span>
              </h3>
              <ul className="space-y-3 text-xs text-gray-400 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#00f3ff]/20 text-[#00f3ff] font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    ✓
                  </span>
                  <span>
                    {lang === "sw"
                      ? "Unatengeneza nenosiri lako sasa — hakuna nenosiri la muda au kubahatisha."
                      : "Create your own secure password now — no temporary passwords."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#00f3ff]/20 text-[#00f3ff] font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    ✓
                  </span>
                  <span>
                    {lang === "sw"
                      ? "Eneo lako na jina la biashara vitatengeneza Site yako ya kwanza kiotomatiki."
                      : "Your city & business name automatically initialize your primary Site."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#00f3ff]/20 text-[#00f3ff] font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    ✓
                  </span>
                  <span>
                    {lang === "sw"
                      ? "Unganisha MikroTik, Omada, au UniFi na upokee 90% ya mapato yako ya intaneti moja kwa moja."
                      : "Connect MikroTik, Omada or UniFi and collect 90% net revenue directly."}
                  </span>
                </li>
              </ul>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-2">
              <p className="text-xs text-gray-300 font-medium">
                {lang === "sw" ? "Tayari unayo akaunti iliyothibitishwa?" : "Already have an account?"}
              </p>
              <Link
                href="/login"
                className="text-xs text-[#00f3ff] hover:underline font-bold inline-flex items-center gap-1 mt-1"
              >
                <span>{lang === "sw" ? "Ingia Kwenye Akaunti Yako (Login)" : "Sign in to Dashboard"}</span> &rarr;
              </Link>
            </div>
          </div>

          {/* Right Column: Application Form */}
          <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-2">
              {lang === "sw" ? "Taarifa za Biashara & Nenosiri" : "Business Details & Password"}
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              {lang === "sw"
                ? "Weka taarifa zako na nenosiri lako la siri utakolotumia kuingia kwenye akaunti yako."
                : "Enter your contact info and personal password to access your operator dashboard."}
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3.5 rounded-xl mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {lang === "sw" ? "Jina la Biashara / Hotspot Name *" : "Hotspot / Business Name *"}
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                    placeholder="Mwananyamala HighSpeed Wi-Fi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    {lang === "sw" ? "Jina la Msimamizi *" : "Full Name *"}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                      placeholder="Juma Ali"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    {lang === "sw" ? "Namba ya Simu *" : "Phone Number *"}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                      placeholder="0754 123 456"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    {lang === "sw" ? "Barua Pepe (Email ya Kuingilia) *" : "Email Address (Login ID) *"}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                      placeholder="juma@gmail.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    {lang === "sw" ? "Mkoa & Wilaya (Eneo la Kwanza / Site) *" : "City & District (Primary Site) *"}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                      placeholder="Dar es Salaam (Kinondoni)"
                    />
                  </div>
                </div>
              </div>

              {/* Operator's Own Password Fields */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#00f3ff]">
                  <KeyRound size={16} />
                  <span>{lang === "sw" ? "Tengeneza Nenosiri Lako la Kuingilia" : "Create Your Login Password"}</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {lang === "sw"
                    ? "Hili ndilo nenosiri utakolotumia kuingia kwenye dashboard yako. Lihifadhi vizuri."
                    : "This password will be used to log in to your operator workspace. Minimum 8 characters."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      {lang === "sw" ? "Nenosiri *" : "Password *"}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      {lang === "sw" ? "Thibitisha Nenosiri *" : "Confirm Password *"}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`w-full bg-black/40 border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none ${
                          formData.confirmPassword && formData.password !== formData.confirmPassword
                            ? "border-red-500"
                            : "border-white/10 focus:border-[#00f3ff]"
                        }`}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {lang === "sw"
                    ? "Aina ya Router / Maelezo ya Ziada (Optional)"
                    : "Router Model / Extra Notes (Optional)"}
                </label>
                <textarea
                  rows={2}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff] resize-none"
                  placeholder={
                    lang === "sw"
                      ? "Mfano: Nina MikroTik hEX na Antena mbili za Comfast..."
                      : "e.g. I have a MikroTik hEX router and 2 Comfast outdoor APs..."
                  }
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold rounded-xl text-xs hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={16} />
                    <span>{lang === "sw" ? "Tuma Ombi la Kujiunga" : "Submit Operator Registration"}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
