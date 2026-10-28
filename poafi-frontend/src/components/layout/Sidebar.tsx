"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Router, 
  Ticket, 
  LogOut, 
  CreditCard, 
  Package, 
  ClipboardCheck,
  Globe
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  // Define links based on user role
  const adminLinks = [
    { name: "Global Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Operator Applications", href: "/applications", icon: ClipboardCheck },
    { name: "Operators (Tenants)", href: "/tenants", icon: Users },
    { name: "Routers & Gateways", href: "/routers", icon: Router },
    { name: "System Billing", href: "/billing", icon: CreditCard },
  ];

  const operatorLinks = [
    { name: "My Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Routers", href: "/routers", icon: Router },
    { name: "My Packages", href: "/packages", icon: Package },
    { name: "My Vouchers", href: "/vouchers", icon: Ticket },
    { name: "Revenue & Payments", href: "/billing", icon: CreditCard },
  ];

  const links = user?.role === "PLATFORM_ADMIN" ? adminLinks : operatorLinks;

  return (
    <aside className="w-64 glass-panel m-4 rounded-2xl flex flex-col h-[calc(100vh-2rem)] shrink-0">
      <div className="p-6">
        <Link href="/dashboard" className="text-2xl font-bold block">
          Poa<span className="text-[#00f3ff]">Fi</span>{" "}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30">
            {user?.role === "PLATFORM_ADMIN" ? "Admin" : "Operator"}
          </span>
        </Link>
        <p className="text-xs text-gray-400 mt-1 truncate">{user?.email}</p>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? "bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={19} />
              <span className="text-sm">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-4 py-2.5 w-full text-xs text-gray-400 hover:text-[#00f3ff] hover:bg-white/5 rounded-xl transition-all"
        >
          <Globe size={16} />
          <span>View Public Site</span>
        </Link>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        >
          <LogOut size={18} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
