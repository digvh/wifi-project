"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Building, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  CheckCircle, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  BookOpen
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
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch("/applications", {
        method: "POST",
        body: JSON.stringify(formData),
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
            ? "Tuma ombi lako la kujiunga na jukwaa letu ili uweze kusanidi routers zako, kuuza vifurushi kwa njia ya kidijitali na kupokea 90% ya mapato yako kiotomatiki."
            : "Apply for your tenant account to connect routers, automate M-Pesa voucher sales, and collect 90% direct payouts with zero upfront platform cost."}
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
                ? "Hongera! Ombi Lako Limepokelewa Kikamilifu."
                : "Congratulations! Application Submitted Successfully."}
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-lg mx-auto leading-relaxed">
              {lang === "sw" ? (
                <>
                  Timu yetu ya usimamizi imepokea ombi la biashara yako ya{" "}
                  <strong className="text-[#00f3ff]">{formData.businessName}</strong>. Tutawasiliana nawe ndani ya saa
                  24 kupitia namba ya simu au barua pepe uliyoweka.
                </>
              ) : (
                <>
                  Our platform administration team has received your request for{" "}
                  <strong className="text-[#00f3ff]">{formData.businessName}</strong>. We will review and contact you
                  within 24 hours to activate your credentials.
                </>
              )}
            </p>
          </div>

          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between text-gray-400">
              <span>{lang === "sw" ? "Barua Pepe:" : "Email:"}</span>
              <span className="text-white font-mono">{formData.email}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{lang === "sw" ? "Namba ya Simu:" : "Phone:"}</span>
              <span className="text-white font-mono">{formData.phone}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{lang === "sw" ? "Mkoa / Eneo:" : "City / Region:"}</span>
              <span className="text-white">{formData.city}</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/guide"
              className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
            >
              <BookOpen size={16} />
              <span>{lang === "sw" ? "Soma Mwongozo wa Router" : "Read Router Guide in the Meantime"}</span>
            </Link>

            <a
              href="https://wa.me/255754000000?text=Habari%20PoaFi,%20nimetuma%20ombi%20la%20kujiunga%20kama%20operator."
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
            >
              <span>{lang === "sw" ? "Uanzishwaji wa Haraka (WhatsApp)" : "Instant Fast-Track (WhatsApp)"}</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Benefits & Trust */}
          <div className="space-y-6 lg:col-span-1">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-[#00f3ff]" size={18} />
                <span>{lang === "sw" ? "Nini Kinafuata Baada ya Kutuma?" : "What Happens Next?"}</span>
              </h3>
              <ul className="space-y-3 text-xs text-gray-400 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    1
                  </span>
                  <span>
                    {lang === "sw"
                      ? "Super Admin anapitia maelezo yako na kuthibitisha eneo lako."
                      : "Admin reviews your hotspot location & contact profile."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    2
                  </span>
                  <span>
                    {lang === "sw"
                      ? "Unatengenezewa akaunti ya Operator Workspace na kutumiwa nenosiri."
                      : "Your dedicated tenant workspace & login are provisioned."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    3
                  </span>
                  <span>
                    {lang === "sw"
                      ? "Unaunganisha router yako na kuanza kuuza intaneti mara moja!"
                      : "Connect your router and start collecting Wi-Fi revenue!"}
                  </span>
                </li>
              </ul>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-2">
              <p className="text-xs text-gray-300 font-medium">
                {lang === "sw" ? "Tayari unayo akaunti iliyothibitishwa?" : "Already have an approved account?"}
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
              {lang === "sw" ? "Taarifa za Biashara Yako" : "Business & Location Details"}
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              {lang === "sw"
                ? "Tafadhali jaza taarifa sahihi ili tuweze kuwasiliana nawe kwa urahisi."
                : "Please provide accurate contact info so our team can approve your workspace."}
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
                    {lang === "sw" ? "Barua Pepe *" : "Email Address *"}
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
                    {lang === "sw" ? "Mkoa & Wilaya *" : "City & District *"}
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

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  {lang === "sw"
                    ? "Aina ya Router / Maelezo ya Ziada (Optional)"
                    : "Router Model / Extra Notes (Optional)"}
                </label>
                <textarea
                  rows={3}
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
                    <span>{lang === "sw" ? "Tuma Ombi la Kujiunga" : "Submit Operator Application"}</span>
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
