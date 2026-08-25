"use client";

import { Search, MessageSquare, Bell } from "lucide-react";

interface AdminHeaderProps {
  userName: string;
  userRole: string;
}

export function AdminHeader({ userName, userRole }: AdminHeaderProps) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-navy/10 bg-white px-6">
      <div className="flex items-center gap-2 rounded-lg bg-page px-3 py-2 text-sm text-navy/50">
        <Search size={16} strokeWidth={1.75} />
        <span>Rechercher un étudiant, un cours…</span>
      </div>

      <div className="flex items-center gap-2">
        {/*
          Icônes messages/notifications : chrome visuel du Figma conservé (icône +
          pastille), mais SANS compteur chiffré — aucun module Messagerie ou
          Notifications n'existe côté backend, un chiffre serait une donnée
          fabriquée présentée comme réelle. À réintroduire uniquement si un vrai
          endpoint existe un jour.
        */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-navy/50 transition-colors hover:bg-page"
          aria-label="Messages"
        >
          <MessageSquare size={18} strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />
        </button>

        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-navy/50 transition-colors hover:bg-page"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-red" />
        </button>

        <div className="mx-2 h-6 w-px bg-navy/10" />

        <div className="flex min-w-0 items-center gap-2.5 pl-1">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-navy"
            style={{ background: "#F2A910" }}
          >
            {initials}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium leading-none text-navy">{userName}</p>
            <p className="mt-0.5 truncate text-xs text-navy/50">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
