"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  Wifi, 
  Menu, 
  X, 
  PhoneCall, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Sparkles,
  Globe
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";

function PublicNavbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { lang, setLang } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { 
      name: lang === "sw" ? "Mwanzo" : "Home", 
      href: "/" 
    },
    { 
      name: lang === "sw" ? "Kuhusu Sisi" : "About Us", 
      href: "/about" 
    },
    { 
      name: lang === "sw" ? "Mwongozo wa Router" : "Router Guide", 
      href: "/guide" 
    },
    { 
      name: lang === "sw" ? "Wasiliana Nasi" : "Contact", 
      href: "/contact" 
    },
  ];

  return (
    <>
      {/* Top Banner - Tanzania Support Notice */}
      <div className="bg-gradient-to-r from-[#00f3ff]/15 via-[#9d00ff]/15 to-[#00f3ff]/15 border-b border-white/10 py-1.5 px-4 text-center text-xs">
        <span className="font-semibold text-[#00f3ff]">🇹🇿 PoaFi Tanzania:</span>{" "}
        {lang === "sw"
          ? "Mfumo unaoongoza wa malipo ya Wi-Fi kwa M-Pesa, Tigo Pesa, Airtel Money na Halopesa."
          : "The leading Wi-Fi billing platform supporting M-Pesa, Tigo Pesa, Airtel Money & Halopesa."}{" "}
        <Link href="/register" className="underline hover:text-[#00f3ff] font-bold ml-1">
          {lang === "sw" ? "Jiunge leo bure →" : "Apply now for free →"}
        </Link>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/85 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00f3ff] to-[#9d00ff] p-[2px] shadow-lg shadow-[#00f3ff]/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0a0a0f] rounded-[10px] flex items-center justify-center">
                <Wifi className="w-5 h-5 text-[#00f3ff]" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight">
                Poa<span className="text-[#00f3ff]">Fi</span>
              </span>
              <span className="text-[10px] block font-mono text-gray-400 tracking-wider uppercase -mt-1">
                Hotspot Billing
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    active
                      ? "bg-[#00f3ff] text-black font-bold shadow-md shadow-[#00f3ff]/30"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs & Language Switcher */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language Selector Pill */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLang("sw")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  lang === "sw"
                    ? "bg-[#00f3ff] text-black shadow-sm shadow-[#00f3ff]/40"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Badili lugha kuwa Kiswahili"
              >
                <span>🇹🇿</span>
                <span>SW</span>
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  lang === "en"
                    ? "bg-[#00f3ff] text-black shadow-sm shadow-[#00f3ff]/40"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Switch language to English"
              >
                <span>🇬🇧</span>
                <span>EN</span>
              </button>
            </div>

            <Link
              href="/portal"
              className="text-xs text-gray-300 hover:text-[#00f3ff] px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 border border-white/5 hover:border-white/20"
            >
              <Wifi size={14} className="text-[#00f3ff]" />
              <span>Customer Portal</span>
            </Link>

            {user ? (
              <Link
                href="/dashboard"
                className="text-xs bg-white/10 hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-xl transition-colors border border-white/20"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-xs text-gray-300 hover:text-white px-3 py-2 rounded-xl transition-colors"
              >
                {lang === "sw" ? "Ingia / Login" : "Login"}
              </Link>
            )}

            <Link
              href="/register"
              className="text-xs bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold px-4 py-2.5 rounded-xl hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/20 flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>{lang === "sw" ? "Tuma Maombi / Apply" : "Apply as Operator"}</span>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Lang Button */}
            <button
              onClick={() => setLang(lang === "sw" ? "en" : "sw")}
              className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <span>{lang === "sw" ? "🇹🇿 SW" : "🇬🇧 EN"}</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white focus:outline-none"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0e0e17] border-b border-white/10 px-4 pt-3 pb-6 space-y-3">
            {/* Mobile Language Switcher */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Globe size={14} />
                <span>{lang === "sw" ? "Chagua Lugha" : "Choose Language"}:</span>
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setLang("sw")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    lang === "sw" ? "bg-[#00f3ff] text-black" : "bg-white/5 text-gray-400"
                  }`}
                >
                  🇹🇿 Kiswahili
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    lang === "en" ? "bg-[#00f3ff] text-black" : "bg-white/5 text-gray-400"
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-xl text-sm ${
                    pathname === item.href
                      ? "bg-[#00f3ff]/15 text-[#00f3ff] font-bold"
                      : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
              <Link
                href="/portal"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-gray-300"
              >
                <Wifi size={14} className="text-[#00f3ff]" />
                <span>{lang === "sw" ? "Portal ya Mteja" : "Customer Portal"}</span>
              </Link>

              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-gray-300"
              >
                {lang === "sw" ? "Ingia / Login" : "Operator Login"}
              </Link>

              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="col-span-2 flex items-center justify-center gap-1.5 py-3 px-4 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold rounded-xl text-xs shadow-lg"
              >
                <Sparkles size={14} />
                <span>{lang === "sw" ? "Jiunge Kama Operator" : "Apply as Operator"}</span>
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function PublicFooter() {
  const { lang } = useLanguage();

  return (
    <footer className="bg-[#060609] border-t border-white/10 pt-16 pb-12 text-sm text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand info */}
        <div className="space-y-4 md:col-span-1">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00f3ff] to-[#9d00ff] flex items-center justify-center text-black font-black text-sm">
              PF
            </div>
            <span className="text-xl font-black text-white">
              Poa<span className="text-[#00f3ff]">Fi</span>
            </span>
          </Link>
          <p className="text-xs text-gray-400 leading-relaxed">
            {lang === "sw"
              ? "Mfumo wa kisasa wa kusimamia routers na kukusanya malipo ya intaneti kwa watoa huduma wa Wi-Fi kote Tanzania."
              : "Modern Wi-Fi hotspot management and automated mobile billing system for internet operators across Tanzania."}
          </p>
          <div className="flex items-center gap-2 text-xs text-[#00f3ff]">
            <ShieldCheck size={16} />
            <span>{lang === "sw" ? "100% Salama na Uthibitisho wa Papo Hapo" : "100% Secure & Real-time Verification"}</span>
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">
            {lang === "sw" ? "Viungo vya Haraka" : "Quick Links"}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/" className="hover:text-[#00f3ff] transition-colors">
                {lang === "sw" ? "Mwanzo (Home)" : "Home"}
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[#00f3ff] transition-colors">
                {lang === "sw" ? "Kuhusu PoaFi (About Us)" : "About Us"}
              </Link>
            </li>
            <li>
              <Link href="/guide" className="hover:text-[#00f3ff] transition-colors">
                {lang === "sw" ? "Mwongozo wa Kusanidi Router" : "Router Configuration Guide"}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#00f3ff] transition-colors">
                {lang === "sw" ? "Wasiliana Nasi (Contact)" : "Contact Support"}
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-[#00f3ff] transition-colors text-[#00f3ff] font-semibold">
                {lang === "sw" ? "Tuma Maombi ya Operator →" : "Apply as Operator →"}
              </Link>
            </li>
          </ul>
        </div>

        {/* Supported Routers */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">
            {lang === "sw" ? "Routers Zinazokubalika" : "Supported Routers"}
          </h4>
          <ul className="space-y-1.5 text-xs text-gray-400">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff]" />
              <span>MikroTik RouterOS (v6 & v7)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff]" />
              <span>TP-Link Omada SDN & SafeStream</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff]" />
              <span>Ruijie Reyee Cloud Routers</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff]" />
              <span>Cudy Enterprise & Comfast APs</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff]" />
              <span>Wavlink Outdoor Access Points</span>
            </li>
          </ul>
        </div>

        {/* Contact Details */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">
            {lang === "sw" ? "Mawasiliano / Helpdesk" : "Support Helpdesk"}
          </h4>
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-[#00f3ff] shrink-0 mt-0.5" />
              <span>Makumbusho Towers, Dar es Salaam, Tanzania</span>
            </div>
            <div className="flex items-center gap-2.5">
              <PhoneCall size={16} className="text-[#00f3ff] shrink-0" />
              <span>+255 754 000 000 / +255 655 000 000</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail size={16} className="text-[#00f3ff] shrink-0" />
              <span>support@poafi.co.tz</span>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white underline"
              >
                <span>{lang === "sw" ? "Operator Login →" : "Sign in to Dashboard →"}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} PoaFi Hotspot Billing Platform. {lang === "sw" ? "Haki zote zimehifadhiwa." : "All rights reserved."}</p>
        <div className="flex items-center gap-4">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {lang === "sw" ? "Mifumo Yote Ipo Hewani (99.9% Uptime)" : "All Systems Operational (99.9% Uptime)"}
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-white selection:bg-[#00f3ff] selection:text-black">
      <PublicNavbar />
      <main className="flex-1">{children}</main>

      {/* Floating WhatsApp Help Pill */}
      <a
        href="https://wa.me/255754000000?text=Habari%20PoaFi!%20Ninahitaji%20msaada%20wa%20kufunga%20router%20yangu%20au%20kujiunga."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-3 rounded-full shadow-2xl shadow-[#25D366]/40 transition-transform hover:scale-105 group text-sm font-bold"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
        <span>WhatsApp Msaada / Help</span>
      </a>

      <PublicFooter />
    </div>
  );
}
