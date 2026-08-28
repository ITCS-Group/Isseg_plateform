"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@isseg/ui";
import { useProtectedRoute } from "@/lib/useProtectedRoute";
import { ItSidebar } from "./_components/ItSidebar";

/**
 * Shell partagé par /it et toutes ses sous-routes futures. Garde RBAC
 * exécutée une seule fois ici — les pages filles ne doivent pas appeler
 * useProtectedRoute elles-mêmes (même convention que admin/layout.tsx).
 */
export default function ItLayout({ children }: { children: ReactNode }) {
  const { user, status, logout } = useProtectedRoute("/it");

  if (status !== "ready" || !user) {
    return <div className="flex min-h-screen items-center justify-center text-navy/50">Chargement…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <ItSidebar
        userName={`${user.prenom} ${user.nom}`}
        userRole={user.roles.join(", ")}
        roles={user.roles}
        onLogout={logout}
      />
      <div className="flex flex-1 flex-col">
        <AppHeader userName={`${user.prenom} ${user.nom}`} userRole={user.roles.join(", ")} />
        <main className="flex-1 overflow-y-auto bg-page">{children}</main>
      </div>
    </div>
  );
}
