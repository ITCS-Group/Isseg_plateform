"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, ensureSession, logout as logoutUser } from "./auth";
import { isRoleAllowedForRoute } from "./routes";

/**
 * Garde de page protégée par rôle — factorise le pattern déjà utilisé par
 * /enseignant (restauration de session au montage via ensureSession(),
 * vérification du rôle via isRoleAllowedForRoute(), redirection vers /login
 * si non autorisé, déconnexion) pour éviter de le dupliquer dans chaque
 * nouveau dashboard (chantier Phase 8).
 *
 * Pure logique — aucun JSX ici. Chaque page garde son propre rendu (écran
 * de chargement, layout) ; ce hook ne fournit que l'état de session et la
 * fonction de déconnexion.
 */
export function useProtectedRoute(route: string) {
  const router = useRouter();
  const { user, accessToken, status } = useAuthStore();

  useEffect(() => {
    if (status === "idle") {
      ensureSession().then((restoredUser) => {
        if (!restoredUser || !isRoleAllowedForRoute(restoredUser.roles, route)) {
          router.push("/login");
        }
      });
    } else if (status === "ready" && !user) {
      router.push("/login");
    }
  }, [status, user, router, route]);

  async function logout() {
    await logoutUser();
    router.push("/login");
  }

  return { user, accessToken, status, logout };
}
