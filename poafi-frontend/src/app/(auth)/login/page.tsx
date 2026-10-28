"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft, Wifi, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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

      login(data.token, data.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0f]">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00f3ff]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9d00ff]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top back link */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center text-sm">
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-gray-400 hover:text-[#00f3ff] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Rudi Mwanzo / Back to Home</span>
        </Link>
        <Link 
          href="/portal" 
          className="flex items-center gap-1.5 text-gray-400 hover:text-[#00f3ff] transition-colors"
        >
          <Wifi size={16} />
          <span>Customer Portal</span>
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 w-full max-w-md relative z-10 border border-white/10 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00f3ff] to-[#9d00ff] text-black font-black text-xl mb-3 shadow-lg shadow-[#00f3ff]/20">
            PF
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Poa<span className="text-[#00f3ff]">Fi</span> Portal
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Ingia kusimamia mtandao wako wa Wi-Fi / Sign in to manage your network
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Barua Pepe / Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-500" />
              <input
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-[#00f3ff] transition-colors placeholder:text-gray-600"
                placeholder="mfano@poafi.com" 
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-300">
                Nenosiri / Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-500" />
              <input
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-[#00f3ff] transition-colors placeholder:text-gray-600"
                placeholder="••••••••" 
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold py-3.5 rounded-xl hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/20 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Ingia / Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-sm text-gray-400">
            Unataka kuanzisha biashara ya Wi-Fi mtaani kwako?
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 mt-2 text-[#00f3ff] font-semibold hover:underline text-sm"
          >
            <UserPlus size={16} />
            <span>Tuma Maombi ya Kuwa Operator / Apply as Operator &rarr;</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
