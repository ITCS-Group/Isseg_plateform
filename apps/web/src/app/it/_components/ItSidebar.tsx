"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Ticket,
  Monitor,
  GraduationCap,
  ClipboardList,
  BarChart3,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IssegLogo } from "@isseg/ui";
import { hasCapability } from "@/lib/support-it-permissions";

interface NavEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const NAV_ITEMS: NavEntry[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, href: "/it" },
  { key: "requetes", label: "Requêtes", icon: Ticket, href: "/it/requetes" },
  { key: "postes", label: "Postes", icon: Monitor, href: "/it/postes" },
  { key: "cours", label: "Cours", icon: GraduationCap, href: "/it/cours" },
  { key: "inscriptions", label: "Inscriptions", icon: ClipboardList, href: "/it/inscriptions" },
  { key: "synthese", label: "Synthèse mensuelle", icon: BarChart3, href: "/it/synthese" },
  { key: "messagerie", label: "Messagerie", icon: MessageSquare, href: "/it/messagerie" },
];

interface ItSidebarProps {
  userName: string;
  userRole: string;
  /** Rôles bruts de l'utilisateur — sert uniquement à filtrer "Synthèse" (@Roles backend réel, pas une page manquante). */
  roles: string[];
  onLogout: () => void;
}

export function ItSidebar({ userName, userRole, roles, onLogout }: ItSidebarProps) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  const items = NAV_ITEMS.filter(
    (item) => item.key !== "synthese" || hasCapability(roles, "synthese", "view"),
  );

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
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          const content = (
            <span className="flex items-center gap-3">
              <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" />
              {open && <span className="truncate">{item.label}</span>}
            </span>
          );

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
