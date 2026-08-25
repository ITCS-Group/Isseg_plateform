"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  Library,
  LifeBuoy,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IssegLogo } from "@isseg/ui";

interface NavEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Absent = rubrique visuelle du Figma sans écran derrière (non navigable, cf. audit). */
  href?: string;
  /** Actif aussi sur les sous-routes (ex. /admin/parametres/utilisateurs). */
  matchPrefix?: boolean;
}

const NAV_ITEMS: NavEntry[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, href: "/admin" },
  { key: "students", label: "Étudiants", icon: Users },
  { key: "courses", label: "Cours & filières", icon: BookOpen },
  { key: "payments", label: "Paiements", icon: CreditCard },
  { key: "library", label: "Bibliothèque", icon: Library },
  { key: "it", label: "Support IT", icon: LifeBuoy },
  { key: "reports", label: "Rapports", icon: BarChart3 },
  { key: "settings", label: "Paramètres", icon: Settings, href: "/admin/parametres", matchPrefix: true },
];

interface AdminSidebarProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
}

export function AdminSidebar({ userName, userRole, onLogout }: AdminSidebarProps) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  return (
    <aside
      className="sidebar-scroll flex h-screen flex-shrink-0 flex-col overflow-y-auto bg-navy text-white transition-all duration-200"
      style={{ width: open ? 220 : 64 }}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <div className="flex-shrink-0">
          <IssegLogo size={28} />
        </div>
        {open && <span className="text-base font-bold tracking-wide">ISSEG</span>}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Réduire le menu" : "Étendre le menu"}
          className="ml-auto flex-shrink-0 text-white/40 transition-colors hover:text-white/80"
        >
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href
            ? item.matchPrefix
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href
            : false;

          const content = (
            <span className="flex items-center gap-3">
              <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" />
              {open && <span className="truncate">{item.label}</span>}
            </span>
          );

          if (item.href) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={item.key}
              aria-disabled="true"
              title="Écran non disponible pour le moment"
              className="flex cursor-not-allowed items-center rounded-lg px-3 py-2.5 text-sm text-white/30"
            >
              {content}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        {open && (
          <div className="mb-3 min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-white/60">{userRole}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0" />
          {open && "Déconnexion"}
        </button>
      </div>
    </aside>
  );
}
