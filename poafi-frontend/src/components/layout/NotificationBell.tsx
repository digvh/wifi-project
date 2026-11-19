"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

interface NotificationItem {
  id: string;
  severity: "error" | "warning" | "info" | "success";
  titleSw: string;
  titleEn: string;
  messageSw: string;
  messageEn: string;
  href: string;
  timestamp: string;
}

const SEEN_KEY = "poafi_seen_alert_ids_v1";

export default function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
      if (Array.isArray(saved)) setSeenIds(saved);
    } catch {
      // ignore storage errors
    }
  }, []);

  const fetchAlerts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch("/stats/notifications");
      if (Array.isArray(res?.alerts)) {
        setAlerts(res.alerts);
      }
    } catch {
      // keep existing alerts quietly if poll fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = alerts.filter((a) => !seenIds.includes(a.id)).length;

  const markAllSeen = () => {
    const allIds = Array.from(new Set([...seenIds, ...alerts.map((a) => a.id)]));
    setSeenIds(allIds);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(allIds.slice(-100)));
    } catch {
      // ignore storage errors
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      fetchAlerts();
    }
  };

  const renderIcon = (severity: NotificationItem["severity"]) => {
    switch (severity) {
      case "error":
        return <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />;
      case "warning":
        return <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />;
      case "success":
        return <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />;
      default:
        return <Info size={16} className="text-[#00f3ff] shrink-0 mt-0.5" />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={t("Arifa", "Notifications")}
        className={`relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#00f3ff]/40 transition-all text-gray-200 ${
          compact ? "p-2" : "px-3 py-2 text-xs font-medium"
        }`}
      >
        <Bell size={compact ? 17 : 15} className={unreadCount > 0 ? "text-[#00f3ff]" : "text-gray-300"} />
        {!compact && <span className="hidden sm:inline">{t("Arifa", "Alerts")}</span>}
        {unreadCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-[10px] font-black text-white flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.6)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-[88vw] sm:w-96 max-w-md z-50 rounded-2xl border border-white/15 bg-[#090d1e]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 bg-white/5">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-[#00f3ff]" />
                <span className="text-sm font-bold text-white">
                  {t("Arifa za Mfumo", "System Alerts")}
                </span>
                <span className="text-[11px] text-gray-400">({alerts.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchAlerts}
                  title={t("Onyesha upya", "Refresh")}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RefreshCw size={13} className={loading ? "animate-spin text-[#00f3ff]" : ""} />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllSeen}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#00f3ff]/10 text-[#00f3ff] hover:bg-[#00f3ff]/20 transition-colors"
                  >
                    <CheckCheck size={12} />
                    <span>{t("Soma zote", "Mark read")}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
              {alerts.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-gray-400 space-y-2">
                  <CheckCircle2 size={24} className="text-emerald-400 mx-auto opacity-80" />
                  <p>
                    {t(
                      "Kila kitu kiko sawa. Hakuna tahadhari mpya kwa sasa.",
                      "All clear! No active alerts or offline gateways right now."
                    )}
                  </p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const isUnread = !seenIds.includes(alert.id);
                  return (
                    <Link
                      key={alert.id}
                      href={alert.href}
                      onClick={() => {
                        if (!seenIds.includes(alert.id)) {
                          const next = [...seenIds, alert.id];
                          setSeenIds(next);
                          try {
                            localStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-100)));
                          } catch {
                            // ignore
                          }
                        }
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 hover:bg-white/5 transition-colors ${
                        isUnread ? "bg-[#00f3ff]/[0.04]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {renderIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white truncate">
                              {lang === "sw" ? alert.titleSw : alert.titleEn}
                            </p>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-[#00f3ff] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                            {lang === "sw" ? alert.messageSw : alert.messageEn}
                          </p>
                        </div>
                        <ExternalLink size={12} className="text-gray-500 shrink-0 mt-1" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
