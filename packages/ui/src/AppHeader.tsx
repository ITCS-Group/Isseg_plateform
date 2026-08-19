"use client";

import { Search } from "lucide-react";

export interface AppHeaderProps {
  userName: string;
  userRole: string;
}

export function AppHeader({ userName, userRole }: AppHeaderProps) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-navy/10 bg-white px-6">
      <div className="flex items-center gap-2 rounded-lg bg-page px-3 py-2 text-sm text-navy/50">
        <Search size={16} strokeWidth={1.75} />
        <span>Rechercher…</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium leading-tight text-navy">{userName}</p>
            <p className="text-xs leading-tight text-navy/50">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
