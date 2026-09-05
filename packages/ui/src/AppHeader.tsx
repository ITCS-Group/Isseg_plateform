"use client";

import { Menu, Search } from "lucide-react";

export interface AppHeaderProps {
  userName: string;
  userRole: string;
  /** Affiche le bouton hamburger (masqué à md+) — fournir avec AppSidebar mobileOpen/onMobileClose. */
  onMenuClick?: () => void;
}

export function AppHeader({ userName, userRole, onMenuClick }: AppHeaderProps) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-navy/10 bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-navy hover:bg-page md:hidden"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
        )}
        <div className="hidden items-center gap-2 rounded-lg bg-page px-3 py-2 text-sm text-navy/50 md:flex">
          <Search size={16} strokeWidth={1.75} />
          <span>Rechercher…</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
          {initials}
        </div>
        <div className="hidden min-w-0 text-right md:block">
          <p className="truncate text-sm font-medium leading-tight text-navy">{userName}</p>
          <p className="truncate text-xs leading-tight text-navy/50">{userRole}</p>
        </div>
      </div>
    </header>
  );
}
