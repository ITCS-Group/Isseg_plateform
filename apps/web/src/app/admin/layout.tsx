"use client";

import type { ReactNode } from "react";
import { useProtectedRoute } from "@/lib/useProtectedRoute";
import { AdminSidebar } from "./_components/AdminSidebar";
import { AdminHeader } from "./_components/AdminHeader";

/**
 * Shell partagé par /admin et toutes ses sous-routes (/admin/parametres/*).
 * Garde RBAC exécutée une seule fois ici — les pages filles ne doivent plus
 * appeler useProtectedRoute elles-mêmes.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, status, logout } = useProtectedRoute("/admin");

  if (status !== "ready" || !user) {
    return <div className="flex min-h-screen items-center justify-center text-navy/50">Chargement…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        userName={`${user.prenom} ${user.nom}`}
        userRole={user.roles.join(", ")}
        onLogout={logout}
      />
      <div className="flex flex-1 flex-col">
        <AdminHeader userName={`${user.prenom} ${user.nom}`} userRole={user.roles.join(", ")} />
        <main className="flex-1 overflow-y-auto bg-page">{children}</main>
      </div>
    </div>
  );
}
