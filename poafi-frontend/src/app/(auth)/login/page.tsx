"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft, Wifi, UserPlus, Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const { login } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setLoginSuccess(true);
      login(data.token, data.user);
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch (err: any) {
      setError(
        err.message ||
          t(
            "Imeshindwa kuingia. Tafadhali hakiki taarifa zako.",
            "Failed to sign in. Please verify your credentials.",
          ),
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#070712]">
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00f3ff]/20 rounded-full blur-[100px] pointer-events-none" 
      />
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9d00ff]/20 rounded-full blur-[100px] pointer-events-none" 
      />

      {/* Top navigation & language switch */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center text-xs gap-2">
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-gray-400 hover:text-[#00f3ff] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>{t("Rudi Mwanzo", "Home")}</span>
        </Link>

        <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-0.5 rounded-full">
          <button
            type="button"
            onClick={() => setLang("sw")}
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              lang === "sw" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            🇹🇿 SW
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              lang === "en" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            🇬🇧 EN
          </button>
        </div>

        <Link 
          href="/portal" 
          className="flex items-center gap-1.5 text-gray-400 hover:text-[#00f3ff] transition-colors"
        >
          <Wifi size={14} />
          <span>{t("Portal ya Mteja", "Customer Portal")}</span>
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 25, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass-panel p-8 w-full max-w-md relative z-10 border border-white/10 shadow-2xl rounded-3xl backdrop-blur-xl"
      >
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00f3ff] to-[#9d00ff] text-black font-black text-2xl mb-3 shadow-lg shadow-[#00f3ff]/25">
            <span>PF</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#070712] animate-ping" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Poa<span className="text-[#00f3ff]">Fi</span> Core
          </h1>
          <p className="text-gray-400 mt-1.5 text-xs">
            {t("Ingia kusimamia mtandao wako wa Wi-Fi", "Sign in to manage your Wi-Fi network")}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/40 text-red-400 p-3.5 rounded-xl mb-6 text-xs text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              {t("Barua Pepe", "Email Address")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-xs focus:outline-none focus:border-[#00f3ff] transition-all placeholder:text-gray-600"
                placeholder="juma@example.com" 
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                {t("Nenosiri", "Password")}
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-white text-xs focus:outline-none focus:border-[#00f3ff] transition-all placeholder:text-gray-600"
                placeholder="••••••••" 
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || loginSuccess}
            className="w-full bg-gradient-to-r from-[#00f3ff] via-[#6a00ff] to-[#9d00ff] text-white font-extrabold py-3.5 rounded-xl hover:opacity-95 transition-all shadow-lg shadow-[#00f3ff]/20 disabled:opacity-50 flex items-center justify-center text-xs relative overflow-hidden"
          >
            {loginSuccess ? (
              <span className="flex items-center gap-1.5 text-white font-bold">
                <CheckCircle2 size={16} className="text-green-300 animate-bounce" />
                <span>{t("Imefanikiwa! Inaelekeza...", "Signed in! Redirecting...")}</span>
              </span>
            ) : loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t("Inathibitisha...", "Authenticating...")}</span>
              </div>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>{t("Ingia Kwenye Akaunti", "Sign In")}</span>
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-gray-400">
            {t("Unataka kuanzisha biashara ya Wi-Fi mtaani kwako?", "Want to start a Wi-Fi hotspot business?")}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 mt-2 text-[#00f3ff] font-bold hover:underline text-xs"
          >
            <UserPlus size={14} />
            <span>{t("Jisajili na Utengeneze Nenosiri Lako →", "Register as Operator →")}</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
