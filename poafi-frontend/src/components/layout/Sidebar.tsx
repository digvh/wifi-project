"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Users, Router, Ticket, LogOut, CreditCard, Package, ClipboardCheck, Globe, Radio, Wrench, Wallet, MapPin, Settings, Menu, X, Gauge, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import NotificationBell from "@/components/layout/NotificationBell";

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const adminLinks = [
    { name: t("Dashibodi Kuu", "Global Dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("Maombi ya Waendeshaji", "Operator Applications"), href: "/applications", icon: ClipboardCheck },
    { name: t("Waendeshaji (Tenants)", "Operators (Tenants)"), href: "/tenants", icon: Users },
    { name: t("Routers & Gateways", "Routers & Gateways"), href: "/routers", icon: Router },
    { name: t("Vifaa vya RADIUS", "RADIUS Devices"), href: "/radius", icon: Radio },
    { name: t("Msaada wa Vifaa", "Device Setup"), href: "/device-setup", icon: Wrench },
    { name: t("Orodha ya Vifaa", "Device Catalogue"), href: "/device-catalog", icon: Globe },
    { name: t("Kipima Kasi (ISP)", "ISP Speed Test"), href: "/speedtest", icon: Gauge },
    { name: t("Malipo ya Mfumo", "System Billing"), href: "/billing", icon: CreditCard },
  ];

  const operatorLinks = [
    { name: t("Dashibodi Yangu", "My Dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("Maeneo Yangu", "My Sites"), href: "/sites", icon: MapPin },
    { name: t("Routers Zangu", "My Routers"), href: "/routers", icon: Router },
    { name: t("Vifaa vya RADIUS", "RADIUS Devices"), href: "/radius", icon: Radio },
    { name: t("Kipima Kasi (ISP)", "ISP Speed Test"), href: "/speedtest", icon: Gauge },
    { name: t("Msaada wa Vifaa", "Device Setup"), href: "/device-setup", icon: Wrench },
    { name: t("Vifurushi Vyangu", "My Packages"), href: "/packages", icon: Package },
    { name: t("Vocha Zangu", "My Vouchers"), href: "/vouchers", icon: Ticket },
    { name: t("Mifumo ya Malipo", "Payment Gateways"), href: "/payment-gateways", icon: SlidersHorizontal },
    { name: t("Pochi & Kutoa Pesa", "Wallet & Payouts"), href: "/payouts", icon: Wallet },
    { name: t("Mapato & Malipo", "Revenue & Payments"), href: "/billing", icon: CreditCard },
    { name: t("Mipangilio", "Settings"), href: "/settings", icon: Settings },
  ];

  const links = user?.role === "PLATFORM_ADMIN" ? adminLinks : operatorLinks;

  const sidebarContent = (
    <>
      <div className="p-5 lg:p-6">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="text-2xl font-bold block">
            Poa<span className="text-[#00f3ff]">Fi</span>{" "}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30">
              {user?.role === "PLATFORM_ADMIN" ? t("Msimamizi", "Admin") : t("Mwendeshaji", "Operator")}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t("Funga menyu", "Close menu")}
            className="lg:hidden p-2 rounded-xl bg-white/5 text-gray-300 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1 truncate">{user?.email}</p>

        {/* Language Toggle */}
        <div className="mt-3 flex items-center bg-white/5 border border-white/10 rounded-xl p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setLang("sw")}
            className={`flex-1 py-1 rounded-lg font-bold transition-all ${
              lang === "sw" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            🇹🇿 Kiswahili
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`flex-1 py-1 rounded-lg font-bold transition-all ${
              lang === "en" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? "bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30 font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
            >
              <Icon size={19} /><span className="text-sm">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Link href="/" target="_blank" className="flex items-center gap-3 px-4 py-2.5 w-full text-xs text-gray-400 hover:text-[#00f3ff] hover:bg-white/5 rounded-xl transition-all">
          <Globe size={16} /><span>{t("Tazama Tovuti ya Umma", "View Public Site")}</span>
        </Link>
        <button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
          <LogOut size={18} /><span className="font-medium">{t("Ondoka", "Logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile / Tablet Sticky Header */}
      <header className="lg:hidden print:hidden sticky top-0 z-40 glass-panel mx-3 mt-3 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 border border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Fungua menyu", "Open menu")}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white hover:border-[#00f3ff]/50 transition-colors shrink-0"
          >
            <Menu size={20} />
          </button>
          <Link href="/dashboard" className="text-lg font-bold truncate">
            Poa<span className="text-[#00f3ff]">Fi</span>
          </Link>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30 shrink-0">
            {user?.role === "PLATFORM_ADMIN" ? t("Msimamizi", "Admin") : t("Mwendeshaji", "Operator")}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell compact />
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => setLang("sw")}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${
                lang === "sw" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              SW
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${
                lang === "en" ? "bg-[#00f3ff] text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex print:hidden w-64 glass-panel m-4 rounded-2xl flex-col h-[calc(100vh-2rem)] shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="relative z-10 w-72 max-w-[85vw] h-full bg-[#090c18]/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
