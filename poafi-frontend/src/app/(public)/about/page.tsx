"use client";

import Link from "next/link";
import { 
  Target, 
  Eye, 
  MapPin, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Globe
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
  const { lang, setLang } = useLanguage();

  const regions = [
    "Dar es Salaam",
    "Arusha",
    "Mwanza",
    "Dodoma",
    "Zanzibar",
    "Mbeya",
    "Tanga",
    "Morogoro",
  ];

  const differentiators = [
    {
      title: lang === "sw" ? "Imeundwa Maalumu kwa Tanzania" : "Built Specifically for Tanzania",
      desc: lang === "sw"
        ? "Tofauti na mifumo ya kigeni kama Mikhmon au RadiusDesk, PoaFi imeundwa kwa mazingira ya Tanzania—inaunganishwa moja kwa moja na M-Pesa, Tigo Pesa, Airtel Money na Halopesa."
        : "Unlike generic foreign software (e.g. Mikhmon or RadiusDesk), PoaFi is custom-engineered for East Africa with native, zero-latency integration to M-Pesa, Tigo Pesa, Airtel Money, and Halopesa.",
    },
    {
      title: lang === "sw" ? "Gawio la Uwazi la 90%" : "Transparent 90% Revenue Share",
      desc: lang === "sw"
        ? "Hakuna ada zilizofichwa au michango mikubwa ya kila mwezi. Unalipia mfumo kupitia asilimia 10% ndogo ya mauzo halisi unayofanya, hivyo operator anaondoka na 90% ya faida yote."
        : "No hidden setup fees or heavy monthly subscriptions. The platform only retains a minimal 10% operational fee on completed vouchers, leaving you with 90% net revenue in your wallet.",
    },
    {
      title: lang === "sw" ? "Uchapishaji wa Vocha za Karatasi (POS Thermal)" : "Thermal & POS Voucher Printing",
      desc: lang === "sw"
        ? "Kwa wateja wasiotumia simu janja au wanaopenda vocha za mikononi, mfumo unachapa vocha safi kwa kutumia thermal printer ya Bluetooth au karatasi ya kawaida ya A4."
        : "For offline walk-ins and local retail duka distribution, operators can bulk-generate and print clean scratch vouchers with QR codes via Bluetooth thermal printers or standard A4 sheets.",
    },
    {
      title: lang === "sw" ? "Ujumbe wa Simu (SMS) wa Papo Hapo" : "Real-Time Instant SMS Receipts",
      desc: lang === "sw"
        ? "Mteja akinunua kifurushi mtandaoni anapokea SMS ya uthibitisho na kodi ya vocha yake mara moja kwa lugha ya Kiswahili au Kiingereza."
        : "Customers who purchase Wi-Fi vouchers online receive an instant SMS receipt containing their voucher code, validity duration, and reconnect instructions.",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* 1. Header / Intro */}
      <section className="text-center max-w-4xl mx-auto space-y-4">
        {/* Language selector badge */}
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00f3ff]/10 border border-[#00f3ff]/20 text-xs font-bold text-[#00f3ff]">
            <Sparkles size={14} />
            <span>{lang === "sw" ? "Kuhusu Sisi" : "About PoaFi"}</span>
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

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          {lang === "sw"
            ? "Tunawezesha Wajasiriamali wa Kitanzania Kumiliki Miundombinu ya Wi-Fi"
            : "Empowering Local Entrepreneurs to Build Profitable Wi-Fi Infrastructure"}
        </h1>
        <p className="text-base sm:text-lg text-gray-300 leading-relaxed pt-2">
          {lang === "sw"
            ? "PoaFi ni jukwaa la kidijitali linalorahisisha usimamizi, uuzaji na ukusanyaji wa mapato ya intaneti kwa wamiliki wa routers na maeneo ya Wi-Fi Hotspots nchini Tanzania."
            : "PoaFi is an automated cloud management and billing platform purpose-built to help router owners turn regular internet lines into lucrative, self-service Wi-Fi hotspot businesses."}
        </p>
      </section>

      {/* 2. Mission & Vision Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 space-y-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-[#00f3ff]/15 text-[#00f3ff] flex items-center justify-center font-bold">
            <Target size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {lang === "sw" ? "Dhamira Yetu" : "Our Mission"}
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            {lang === "sw"
              ? "Kuwezesha kila kijana, mjasiriamali na mfanyabiashara wa Kitanzania kugeuza intaneti ya kawaida kuwa biashara inayojiendesha yenyewe kiotomatiki, bila kuhitaji maarifa magumu ya TEHAMA au mtaji mkubwa wa mifumo ya kigeni."
              : "To democratize high-speed internet access across East Africa by equipping independent operators with robust, automated billing tools that require zero coding knowledge or expensive software licenses."}
          </p>
        </div>

        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-white/10 space-y-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-[#9d00ff]/15 text-[#9d00ff] flex items-center justify-center font-bold">
            <Eye size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {lang === "sw" ? "Maono Yetu" : "Our Vision"}
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            {lang === "sw"
              ? "Kuwa jukwaa namba moja la miundombinu ya Wi-Fi Afrika Mashariki linalounganisha mamilioni ya watumiaji na intaneti ya kasi, nafuu na inayotegemewa katika kila mtaa, kituo cha mabasi, chuo kikuu na soko."
              : "To become East Africa's leading Wi-Fi connectivity backbone, connecting millions of daily users with affordable, reliable, on-demand internet in every neighborhood, bus terminal, campus, and marketplace."}
          </p>
        </div>
      </section>

      {/* 3. Why PoaFi is Different */}
      <section className="space-y-10">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f3ff] mb-2">
            {lang === "sw" ? "Kwa Nini PoaFi?" : "The PoaFi Difference"}
          </h2>
          <h3 className="text-3xl font-extrabold text-white">
            {lang === "sw" ? "Kwanini Watoa Huduma Wanachagua PoaFi" : "Why Wi-Fi Operators Choose PoaFi"}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {differentiators.map((item, idx) => (
            <div key={idx} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-[#00f3ff] font-bold text-base">
                <CheckCircle size={18} className="shrink-0" />
                <h4>{item.title}</h4>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed pl-6">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Coverage across Tanzania */}
      <section className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/15 text-center space-y-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-[#00f3ff] uppercase tracking-wider">
          <MapPin size={16} />
          <span>{lang === "sw" ? "Huduma Zetu Tanzania Nzima" : "Coverage Across Tanzania"}</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
          {lang === "sw"
            ? "Inatumika na Waendeshaji wa Wi-Fi Katika Mikoa Mikuu"
            : "Active Hotspots Across Major Regions"}
        </h3>
        <p className="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto">
          {lang === "sw"
            ? "Mfumo wa PoaFi unafanya kazi kwenye mtandao wowote wa Fiber au simu (TTCL, Zantel, Halotel, Airtel, Tigo, Vodacom) popote ulipo Tanzania."
            : "PoaFi operates smoothly across any upstream ISP or LTE provider (TTCL Fiber, Zuku, Vodacom, Tigo, Airtel, Halotel) anywhere in Tanzania."}
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-4">
          {regions.map((reg) => (
            <span
              key={reg}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-200"
            >
              📍 {reg}
            </span>
          ))}
        </div>
      </section>

      {/* 5. CTA */}
      <section className="text-center space-y-6 pt-4">
        <h3 className="text-2xl sm:text-4xl font-extrabold text-white">
          {lang === "sw"
            ? "Je, Una Eneo Lenye Watu Wengi? Anzisha Wi-Fi Yako Leo."
            : "Have a High-Foot-Traffic Location? Start Your Hotspot Today."}
        </h3>
        <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
          {lang === "sw"
            ? "Usajili unachukua chini ya dakika 2. Timu yetu itakusaidia kusanidi router yako bila gharama za ziada."
            : "Registration takes less than 2 minutes. Our engineers are standing by to guide your router installation for free."}
        </p>
        <div>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-extrabold text-sm rounded-2xl hover:opacity-95 shadow-xl shadow-[#00f3ff]/20 transition-all"
          >
            <span>{lang === "sw" ? "Tuma Maombi ya Kuwa Operator" : "Apply as Operator (Free)"}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
