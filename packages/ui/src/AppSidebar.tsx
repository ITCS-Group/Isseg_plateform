"use client";

import type { LucideIcon } from "lucide-react";
import { LogOut, X } from "lucide-react";
import { IssegLogo } from "./IssegLogo";

export interface AppSidebarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export interface AppSidebarProps {
  banner: string;
  items: AppSidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
  /**
   * Contrôle l'affichage du tiroir sous md (768px). Absent = pas de logique
   * mobile (repli permanent hors flux) : à fournir avec onMobileClose dès
   * qu'un écran consomme ce composant, cf. .claude/agent-responsive-design.md.
   */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({
  banner,
  items,
  activeKey,
  onSelect,
  userName,
  userRole,
  onLogout,
  mobileOpen = false,
  onMobileClose,
}: AppSidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-shrink-0 flex-col bg-navy text-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-6">
          <IssegLogo size={36} />
          <div>
            <p className="text-sm font-semibold leading-tight">ISSEG</p>
            <p className="text-xs leading-tight text-white/60">Portail académique</p>
          </div>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Fermer le menu"
              className="ml-auto text-white/60 hover:text-white md:hidden"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="mx-4 mb-4 rounded-lg bg-gold/15 px-3 py-2 text-xs font-medium text-gold">
          {banner}
        </div>

        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onSelect(item.key);
                  onMobileClose?.();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} strokeWidth={1.75} />
                  {item.label}
                </span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-navy">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="mb-3">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-white/60">{userRole}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
