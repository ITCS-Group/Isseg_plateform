"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, ensureSession, logout as logoutUser } from "./auth";

/**
 * Garde de page protégée par authentification seule, sans contrainte de rôle
 * — pour les routes transverses ouvertes à tout compte authentifié. Complète
 * useProtectedRoute(route), qui exige lui un rôle mappé à une route précise
 * et ne convient donc pas à ce cas. Ne contient aucune logique de rôle, de
 * permission ou de domaine métier — uniquement la validité de session, comme
 * useProtectedRoute.
 */
export function useAuthGuard() {
  const router = useRouter();
  const { user, accessToken, status } = useAuthStore();

  useEffect(() => {
    if (status === "idle") {
      ensureSession().then((restoredUser) => {
        if (!restoredUser) {
          router.push("/login");
        }
      });
    } else if (status === "ready" && !user) {
      router.push("/login");
    }
  }, [status, user, router]);

  async function logout() {
    await logoutUser();
    router.push("/login");
  }

  return { user, accessToken, status, logout };
}
