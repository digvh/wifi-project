"use client";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import NotificationBell from "@/components/layout/NotificationBell";
import { useAuth } from "@/context/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00f3ff]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00f3ff]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 lg:overflow-y-auto lg:h-screen">
        <div className="hidden lg:flex items-center justify-end mb-4 print:hidden">
          <NotificationBell />
        </div>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}          