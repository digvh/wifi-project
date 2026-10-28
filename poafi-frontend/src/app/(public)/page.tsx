"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Wifi, 
  Smartphone, 
  Printer, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Server, 
  DollarSign, 
  Users, 
  Calculator, 
  FileText, 
  Sparkles,
  Globe
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function PublicHomePage() {
  const { lang, setLang } = useLanguage();

  // Calculator state
  const [dailyUsers, setDailyUsers] = useState(40);
  const [avgPrice, setAvgPrice] = useState(1000); // 1000 TZS average

  const monthlyGross = dailyUsers * avgPrice * 30;
  const operatorNet = Math.round(monthlyGross * 0.9); // 90% operator share
  const formattedNet = new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(operatorNet);
  const formattedGross = new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(monthlyGross);

  const routerBrands = [
    { 
      name: "MikroTik", 
      desc: lang === "sw" ? "RouterOS v6 & v7 API + Radius Hotspot" : "RouterOS v6 & v7 API + Radius Hotspot Integration", 
      popular: true 
    },
    { 
      name: "TP-Link", 
      desc: lang === "sw" ? "Omada Controller & SafeStream Multi-WAN" : "Omada SDN Controller & SafeStream Multi-WAN", 
      popular: true 
    },
    { 
      name: "Ruijie", 
      desc: lang === "sw" ? "Reyee Cloud & AP Hotspot Gateway" : "Reyee Cloud & Web-Auth Gateway", 
      popular: false 
    },
    { 
      name: "Cudy", 
      desc: lang === "sw" ? "Enterprise Gigabit Dual-Band Routers" : "Enterprise Gigabit Dual-Band Routers", 
      popular: false 
    },
    { 
      name: "Comfast", 
      desc: lang === "sw" ? "High-Power Outdoor Long-Range APs" : "High-Power Outdoor Long-Range Access Points", 
      popular: false 
    },
    { 
      name: "Wavlink", 
      desc: lang === "sw" ? "Mesh & High-Gain Omnidirectional APs" : "Mesh & High-Gain Omnidirectional APs", 
      popular: false 
    },
  ];

  const features = [
    {
      icon: Smartphone,
      title: lang === "sw" ? "Malipo ya Papo Hapo ya Simu" : "Direct Mobile Money Checkout",
      subtitle: "M-Pesa / Tigo / Airtel / Halo",
      desc: lang === "sw"
        ? "Wateja wanalipia intaneti moja kwa moja kupitia M-Pesa, Tigo Pesa, Airtel Money na Halopesa bila kuhitaji muuzaji."
        : "Customers pay seamlessly via M-Pesa, Tigo Pesa, Airtel Money, and Halopesa with automated instant activation.",
    },
    {
      icon: Printer,
      title: lang === "sw" ? "Uchapishaji wa Vocha za Karatasi" : "POS Thermal & A4 Voucher Printing",
      subtitle: "Bluetooth & Paper Vouchers",
      desc: lang === "sw"
        ? "Tengeneza na chapa vocha kwa wingi kwa ajili ya kuuza madukani au mtaani ukitumia thermal printer ya Bluetooth au karatasi ya A4."
        : "Generate and bulk-print clean scratch-card vouchers for retail shops and local agents using Bluetooth POS printers or A4 paper.",
    },
    {
      icon: Zap,
      title: lang === "sw" ? "Ufungaji na Ukatwaji wa Papo Hapo" : "Auto-Expiry & Bandwidth Quotas",
      subtitle: "Automated Traffic Control",
      desc: lang === "sw"
        ? "Muda au MB zikiisha, mfumo unamkata mteja kiotomatiki kwenye router bila wewe kuhangaika kufuatilia."
        : "When time or data expires, our engine disconnects the client automatically from your router with zero manual intervention.",
    },
    {
      icon: ShieldCheck,
      title: lang === "sw" ? "Ulinzi Dhidi ya Kushare Vocha" : "Anti-Sharing & MAC Binding",
      subtitle: "Revenue Protection",
      desc: lang === "sw"
        ? "Vocha ikitumika kwenye kifaa kimoja haiwezi kutumiwa na mtu mwingine, hivyo kuzuia upotevu wa mapato yako."
        : "Vouchers lock to the first connected device's MAC address, preventing unauthorized hotspot tethering and revenue leakage.",
    },
    {
      icon: DollarSign,
      title: lang === "sw" ? "Gawio la 90% Moja kwa Moja" : "Transparent 90% Revenue Share",
      subtitle: "Automated Operator Payouts",
      desc: lang === "sw"
        ? "Kama operator, unapata 90% ya mauzo yote yanayoingia moja kwa moja kwenye namba yako ya simu au akaunti ya benki."
        : "Operators receive 90% of all gross collections directly to their mobile wallet or bank account with automated split billing.",
    },
    {
      icon: Server,
      title: lang === "sw" ? "Inasaidia Brand 6 za Routers" : "Multi-Brand Hardware Support",
      subtitle: "Universal Compatibility",
      desc: lang === "sw"
        ? "Unganisha MikroTik, TP-Link, Ruijie au Cudy yako kwa dakika 5 tu kwa mwongozo wetu rahisi wa kiufundi."
        : "Connect any MikroTik, TP-Link, Ruijie, Cudy, or Comfast hardware in minutes using our plug-and-play adapter scripts.",
    },
  ];

  return (
    <div className="space-y-24 pb-24">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-10 md:pt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#00f3ff]/20 to-[#9d00ff]/20 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* Language Switcher Pill in Hero */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[#00f3ff]">
            <Sparkles size={14} />
            <span>
              {lang === "sw" ? "Mfumo Mpya wa Wi-Fi Hotspot Tanzania 2026" : "Tanzania's #1 Wi-Fi Hotspot Platform"}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full text-xs font-semibold">
            <span className="text-gray-400 pl-2 pr-1 text-[11px] flex items-center gap-1">
              <Globe size={12} />
              <span>{lang === "sw" ? "Lugha:" : "Language:"}</span>
            </span>
            <button
              onClick={() => setLang("sw")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "sw" ? "bg-[#00f3ff] text-black shadow-sm shadow-[#00f3ff]/40" : "text-gray-400 hover:text-white"
              }`}
            >
              🇹🇿 Kiswahili
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "en" ? "bg-[#00f3ff] text-black shadow-sm shadow-[#00f3ff]/40" : "text-gray-400 hover:text-white"
              }`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-tight">
          {lang === "sw" ? (
            <>
              Geuza Intaneti Yako Kuwa{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f3ff] via-[#6be5ff] to-[#9d00ff]">
                Biashara Inayoingiza Pesa
              </span>{" "}
              Kila Siku
            </>
          ) : (
            <>
              Turn Your Internet Into a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f3ff] via-[#6be5ff] to-[#9d00ff]">
                Profitable Automated Business
              </span>{" "}
              Every Day
            </>
          )}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
          {lang === "sw" ? (
            <>
              PoaFi ni mfumo wa kiotomatiki unaokuwezesha kuuza Wi-Fi mtaani, stendi, madukani au vyuoni kwa kutumia{" "}
              <strong className="text-white">M-Pesa, Tigo Pesa, Airtel Money</strong> na vocha za karatasi ukitumia router yoyote ya MikroTik au TP-Link.
            </>
          ) : (
            <>
              PoaFi is an end-to-end cloud platform empowering hotspot owners across Tanzania to bill Wi-Fi automatically via{" "}
              <strong className="text-white">M-Pesa, Tigo Pesa, Airtel Money</strong> and thermal vouchers on any MikroTik, TP-Link, or Ruijie router.
            </>
          )}
        </p>

        {/* Hero CTA buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-extrabold text-base rounded-2xl hover:opacity-95 shadow-xl shadow-[#00f3ff]/25 transition-all flex items-center justify-center gap-2 group"
          >
            <span>{lang === "sw" ? "Tuma Ombi la Kujiunga (Bure)" : "Apply as Operator (Free)"}</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/guide"
            className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <FileText size={18} className="text-[#00f3ff]" />
            <span>{lang === "sw" ? "Mwongozo wa Router (Kiswahili & EN)" : "Router Setup Guide (CLI & WinBox)"}</span>
          </Link>
        </div>

        {/* Quick Trust Badges */}
        <div className="mt-14 pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-left">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-[#00f3ff] shrink-0" size={24} />
            <div>
              <p className="text-lg font-bold text-white">99.9%</p>
              <p className="text-xs text-gray-400">{lang === "sw" ? "Uptime wa Mtandao" : "Platform Uptime"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-[#00f3ff] shrink-0" size={24} />
            <div>
              <p className="text-lg font-bold text-white">90% Payout</p>
              <p className="text-xs text-gray-400">{lang === "sw" ? "Mapato kwa Operator" : "Operator Revenue Share"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-[#00f3ff] shrink-0" size={24} />
            <div>
              <p className="text-lg font-bold text-white">&lt; 60s</p>
              <p className="text-xs text-gray-400">{lang === "sw" ? "Muda wa Malipo hadi Kupata Wi-Fi" : "Checkout to Wi-Fi Access"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-[#00f3ff] shrink-0" size={24} />
            <div>
              <p className="text-lg font-bold text-white">6+ Brands</p>
              <p className="text-xs text-gray-400">{lang === "sw" ? "Routers Zinazounganishwa" : "Supported Router Adapters"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS (3 SIMPLE STEPS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f3ff] mb-2">
            {lang === "sw" ? "Jinsi Mfumo Unavyofanya Kazi" : "How It Works"}
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
            {lang === "sw" ? "Hatua 3 Rahisi za Kuanza Kupokea Pesa" : "3 Easy Steps to Start Generating Revenue"}
          </h3>
          <p className="text-gray-400 text-sm mt-3">
            {lang === "sw"
              ? "Huna haja ya kuwa mhandisi wa mtandao. PoaFi inakurahisishia kuanzia kusanidi router hadi kupokea pesa."
              : "No complicated networking skills needed. PoaFi handles setup, automated voucher dispatch, and daily payouts."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Step 1 */}
          <div className="glass-panel p-8 rounded-3xl border border-white/10 relative group hover:border-[#00f3ff]/40 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-[#00f3ff]/10 border border-[#00f3ff]/30 text-[#00f3ff] flex items-center justify-center font-black text-xl mb-6">
              01
            </div>
            <h4 className="text-xl font-bold text-white mb-2">
              {lang === "sw" ? "Sanidi Router Yako" : "Connect Your Router"}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              {lang === "sw"
                ? "Chomeka MikroTik au TP-Link yako na uweke script yetu ya dakika 2. Unaweza kuisanidi mwenyewe au timu yetu ya kiufundi itakusaidia bure."
                : "Plug in your MikroTik or TP-Link router and paste our 2-minute setup script. Configure it yourself or let our team assist you remotely."}
            </p>
            <Link href="/guide" className="text-[11px] text-[#00f3ff] font-semibold flex items-center gap-1 hover:underline">
              <span>{lang === "sw" ? "Soma mwongozo wa hatua kwa hatua" : "Read step-by-step guide"}</span> &rarr;
            </Link>
          </div>

          {/* Step 2 */}
          <div className="glass-panel p-8 rounded-3xl border border-white/10 relative group hover:border-[#00f3ff]/40 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-[#9d00ff]/15 border border-[#9d00ff]/30 text-[#9d00ff] flex items-center justify-center font-black text-xl mb-6">
              02
            </div>
            <h4 className="text-xl font-bold text-white mb-2">
              {lang === "sw" ? "Weka Vifurushi & Bei" : "Create Pricing Packages"}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              {lang === "sw"
                ? "Weka vifurushi kulingana na eneo lako: Dakika 30 (TZS 500), Saa 3 (TZS 1,000), Siku Nzima (TZS 2,000), au Wiki Nzima (TZS 8,000)."
                : "Set flexible packages for your location: 30 Mins (TZS 500), 3 Hours (TZS 1,000), 24 Hours (TZS 2,000), or Weekly Unlimited (TZS 8,000)."}
            </p>
            <span className="text-[11px] text-[#9d00ff] font-semibold flex items-center gap-1">
              <span>{lang === "sw" ? "Wewe ndiye unayeamua bei zako" : "You define your own rates & bandwidth"}</span>
            </span>
          </div>

          {/* Step 3 */}
          <div className="glass-panel p-8 rounded-3xl border border-white/10 relative group hover:border-[#00f3ff]/40 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-xl mb-6">
              03
            </div>
            <h4 className="text-xl font-bold text-white mb-2">
              {lang === "sw" ? "Pokea Pesa Moja kwa Moja" : "Collect Automated Payouts"}
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              {lang === "sw"
                ? "Mteja akiunganisha Wi-Fi anafunguliwa Captive Portal ya kisasa, anachagua kifurushi, analipia kwa simu, na anapewa intaneti papo hapo."
                : "Customers connecting to Wi-Fi see your branded portal, select a package, pay via M-Pesa, and get high-speed internet instantly."}
            </p>
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <span>{lang === "sw" ? "Pesa inaingia bila wewe kuwepo" : "Passive income 24/7 on autopilot"}</span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f3ff] mb-2">
            {lang === "sw" ? "Sifa Kuu za Mfumo" : "Platform Features"}
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
            {lang === "sw"
              ? "Kila Kitu Unachohitaji Ili Kuendesha Mtandao Bila Stress"
              : "Everything You Need to Run an Unattended Wi-Fi Network"}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-white/25 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#00f3ff]/15 to-[#9d00ff]/15 border border-white/10 flex items-center justify-center text-[#00f3ff] group-hover:scale-110 transition-transform mb-4">
                  <Icon size={22} />
                </div>
                <h4 className="text-lg font-bold text-white mb-0.5">{feat.title}</h4>
                <p className="text-[11px] text-[#00f3ff] font-mono mb-2 uppercase">{feat.subtitle}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. OPERATOR REVENUE CALCULATOR */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/15 relative overflow-hidden bg-gradient-to-b from-white/[0.04] to-transparent shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00f3ff] mb-2">
                <Calculator size={16} />
                <span>{lang === "sw" ? "Kikokotoo cha Mapato" : "Operator Revenue Calculator"}</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                {lang === "sw" ? "Je, Unaweza Kuingiza Kiasi Gani kwa Mwezi?" : "How Much Can You Earn Every Month?"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {lang === "sw"
                  ? "Weka makadirio ya wateja wa eneo lako kuona makadirio ya faida yako (baada ya gawio la 90%)."
                  : "Estimate your daily users and package prices to project your monthly take-home profit (90% payout)."}
              </p>
            </div>
            <div className="bg-[#00f3ff]/10 border border-[#00f3ff]/30 p-4 rounded-2xl text-right">
              <span className="text-[11px] text-gray-400 uppercase font-mono block">
                {lang === "sw" ? "Makadirio ya Faida Yako" : "Estimated Net Earnings"}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-[#00f3ff] block mt-0.5">{formattedNet}</span>
              <span className="text-[10px] text-gray-500">
                {lang === "sw" ? "kwa mwezi (Gawio la 90%)" : "per month (90% operator share)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-gray-300">
                    {lang === "sw" ? "Wateja wanaonunua kwa siku:" : "Active buyers per day:"}
                  </span>
                  <span className="text-[#00f3ff] font-mono text-sm font-bold">
                    {dailyUsers} {lang === "sw" ? "wateja" : "users"}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={dailyUsers}
                  onChange={(e) => setDailyUsers(parseInt(e.target.value))}
                  className="w-full accent-[#00f3ff] h-2 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>10 {lang === "sw" ? "wateja" : "users"}</span>
                  <span>150 {lang === "sw" ? "wateja" : "users"}</span>
                  <span>300+ {lang === "sw" ? "wateja" : "users"}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-gray-300">
                    {lang === "sw" ? "Wastani wa bei ya kifurushi:" : "Average package price:"}
                  </span>
                  <span className="text-[#9d00ff] font-mono text-sm font-bold">TZS {avgPrice}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="3000"
                  step="250"
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(parseInt(e.target.value))}
                  className="w-full accent-[#9d00ff] h-2 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>TZS 500</span>
                  <span>TZS 1,500</span>
                  <span>TZS 3,000</span>
                </div>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col justify-between text-xs space-y-3">
              <div className="space-y-3">
                <div className="flex justify-between pb-2 border-b border-white/5">
                  <span className="text-gray-400">{lang === "sw" ? "Jumla ya Mapato (Gross):" : "Total Gross Revenue:"}</span>
                  <span className="font-mono text-white font-bold">{formattedGross}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-white/5">
                  <span className="text-gray-400">{lang === "sw" ? "Gawio Lako (90% Payout):" : "Your Net Payout (90%):"}</span>
                  <span className="font-mono text-emerald-400 font-bold">{formattedNet}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-white/5">
                  <span className="text-gray-400">{lang === "sw" ? "Ada ya Mfumo & SMS (10%):" : "Platform Fee & SMS (10%):"}</span>
                  <span className="font-mono text-gray-500">
                    {new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(monthlyGross * 0.1)}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/register"
                  className="w-full py-3 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold rounded-xl text-center block hover:opacity-95 text-xs shadow-lg shadow-[#00f3ff]/20"
                >
                  {lang === "sw" ? "Anza Kupokea Mapato Haya Sasa →" : "Start Earning This Revenue Today →"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SUPPORTED ROUTERS SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f3ff] mb-2">
            {lang === "sw" ? "Uoanifu wa Vifaa" : "Supported Hardware"}
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
            {lang === "sw" ? "Unayo Router Tayari? Inafanya Kazi na PoaFi" : "Already Have a Router? It Works with PoaFi"}
          </h3>
          <p className="text-gray-400 text-sm mt-3">
            {lang === "sw"
              ? "Huna haja ya kununua vifaa vipya vya gharama. Tunasaidia router maarufu zinazopatikana Kariakoo na kote Tanzania."
              : "No expensive proprietary hardware locks. We integrate with top brands readily available across East Africa."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {routerBrands.map((brand, i) => (
            <div
              key={i}
              className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-[#00f3ff]/40 transition-all flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[#00f3ff]">
                <Server size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-base">{brand.name}</h4>
                  {brand.popular && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00f3ff]/15 text-[#00f3ff] border border-[#00f3ff]/30 font-bold uppercase">
                      {lang === "sw" ? "Inayopendwa" : "Popular"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{brand.desc}</p>
                <Link
                  href="/guide"
                  className="inline-flex items-center gap-1 text-[11px] text-[#00f3ff] hover:underline mt-3 font-semibold"
                >
                  <span>{lang === "sw" ? "Angalia jinsi ya kuisanidi" : "View setup guide"}</span> &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. CALL TO ACTION BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel p-10 sm:p-16 rounded-3xl border border-white/20 relative overflow-hidden bg-gradient-to-r from-[#00f3ff]/10 via-[#9d00ff]/10 to-[#00f3ff]/10 text-center">
          <h3 className="text-3xl sm:text-5xl font-black text-white max-w-3xl mx-auto leading-tight">
            {lang === "sw" ? "Uko Tayari Kuanza Biashara Yako ya Wi-Fi Leo?" : "Ready to Start Your Wi-Fi Hotspot Business?"}
          </h3>
          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto mt-4 leading-relaxed">
            {lang === "sw"
              ? "Jiunge na mtandao wa wamiliki wa Wi-Fi kote nchini Tanzania. Usajili ni bure, na timu yetu ipo tayari kukusaidia kuanzia mwanzo."
              : "Join internet operators across Tanzania. Registration is free, and our engineering team is ready to help you get online today."}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-extrabold text-sm rounded-2xl hover:opacity-95 shadow-xl shadow-[#00f3ff]/20 transition-all"
            >
              {lang === "sw" ? "Tuma Maombi ya Bure / Apply Now →" : "Apply as Operator (Free) →"}
            </Link>

            <Link
              href="/contact"
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm rounded-2xl transition-all"
            >
              {lang === "sw" ? "Ongea na Mshauri wa Kiufundi" : "Talk to a Technical Specialist"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
