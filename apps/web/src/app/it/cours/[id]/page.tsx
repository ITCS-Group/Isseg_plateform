"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { CoursSupportITResponseDto } from "@/lib/types/support-it";

type FetchStatus = "loading" | "ready" | "error";

/**
 * Étape 2H-1 — détail en lecture seule. GET /cours-support-it/:id n'a aucune
 * restriction de rôle (comme la liste) — aucun garde hasCapability ici.
 * Aucune mutation, aucun composant partagé nouveau.
 */
export default function ItCoursDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = useAuthStore();
  const { id } = params;

  const [cours, setCours] = useState<CoursSupportITResponseDto | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [error, setError] = useState("");

  const fetchCours = useCallback(async () => {
    if (!accessToken) return;
    setStatus("loading");
    try {
      const data = await apiFetch<CoursSupportITResponseDto>(`/cours-support-it/${id}`, {
        token: accessToken,
      });
      setCours(data);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur réseau");
      setStatus("error");
    }
  }, [accessToken, id]);

  useEffect(() => {
    if (accessToken) fetchCours();
  }, [accessToken, fetchCours]);

  return (
    <div className="p-6">
      <Link href="/it/cours" className="text-sm text-navy/60 hover:text-navy">
        ← Retour aux cours
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-navy">Détail du cours</h1>

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}

      {status === "ready" && cours && (
        <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
          <p className="text-lg font-semibold text-navy">{cours.titre}</p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-navy/50">Niveau</p>
              <p className="text-navy">{cours.niveau}</p>
            </div>
            <div>
              <p className="text-sm text-navy/50">Durée</p>
              <p className="text-navy">{cours.duree} minutes</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-navy/50">Contenu</p>
            <p className="mt-1 whitespace-pre-line text-navy">{cours.contenu}</p>
          </div>
        </div>
      )}
    </div>
  );
}
