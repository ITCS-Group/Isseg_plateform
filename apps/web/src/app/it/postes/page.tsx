"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import { hasCapability } from "@/lib/support-it-permissions";
import type { PosteResponseDto, StatutPoste } from "@/lib/types/support-it";

const STATUT_LABELS: Record<StatutPoste, string> = {
  DISPONIBLE: "Disponible",
  HORS_SERVICE: "Hors service",
};

const STATUT_STYLES: Record<StatutPoste, string> = {
  DISPONIBLE: "bg-status-green/10 text-status-green",
  HORS_SERVICE: "bg-status-red/10 text-status-red",
};

/**
 * Étape 2E-2 — liste en lecture seule. GET /postes n'a aucune restriction de
 * rôle : RESPONSABLE_IT et TECHNICIEN reçoivent la même liste, contrairement
 * à /it/requetes. Pas de filtre/tri, pas de ligne cliquable.
 * Étape 2G-1 — bouton de changement de statut par ligne (PATCH
 * /postes/:id/statut). hasCapability("postes","updateStatut") existait déjà
 * dans support-it-permissions.ts, non modifié ici. Aucun scope de
 * sous-service sur cet endpoint — RESPONSABLE_IT, ADMIN et TECHNICIEN
 * peuvent tous réussir cette action. Pas de confirmation (action réversible
 * dans les deux sens, contrairement à cloturer une requête).
 * Étape 2H-2 — formulaire de création (POST /postes), réutilise
 * hasCapability("postes","create") déjà existant, inchangé. Un seul champ
 * (`salle`), aucune dépendance métier (pas de FK, `salle` est un texte
 * libre côté backend). Même pattern que la création d'un cours (2G-2).
 */
export default function ItPostesPage() {
  const { accessToken, user } = useAuthStore();

  const { data, meta, status, error, setPage, refetch } = usePaginatedFetch<PosteResponseDto>("/postes", {
    token: accessToken,
    limit: 20,
    enabled: !!accessToken,
  });

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  const [salle, setSalle] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  async function handleCreate() {
    if (!accessToken || salle.trim().length < 1) return;
    setSubmitStatus("loading");
    setSubmitError("");
    try {
      await apiFetch<PosteResponseDto>("/postes", {
        method: "POST",
        token: accessToken,
        body: { salle },
      });
      setSubmitStatus("idle");
      setSalle("");
      refetch();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Erreur réseau");
      setSubmitStatus("error");
    }
  }

  async function handleToggleStatut(poste: PosteResponseDto) {
    if (!accessToken) return;
    const nextStatut: StatutPoste = poste.statut === "DISPONIBLE" ? "HORS_SERVICE" : "DISPONIBLE";
    setUpdatingId(poste.id);
    setUpdateError("");
    try {
      await apiFetch<PosteResponseDto>(`/postes/${poste.id}/statut`, {
        method: "PATCH",
        token: accessToken,
        body: { statut: nextStatut },
      });
      refetch();
    } catch (e) {
      setUpdateError(e instanceof ApiError ? e.message : "Erreur réseau");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Postes</h1>

      {hasCapability(user?.roles ?? [], "postes", "create") && (
        <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
          <p className="text-sm font-medium text-navy">Créer un poste</p>

          <div className="mt-3">
            <label className="text-sm text-navy/50">Salle</label>
            <input
              type="text"
              value={salle}
              onChange={(e) => setSalle(e.target.value)}
              placeholder="Salle"
              className="mt-1 w-full max-w-xs rounded border border-navy/20 p-2 text-sm"
            />
          </div>

          {submitStatus === "error" && (
            <p className="mt-2 text-sm text-status-red">{submitError}</p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={submitStatus === "loading" || salle.trim().length < 1}
            className="mt-3 rounded border border-navy/20 px-3 py-1 text-sm font-medium text-navy disabled:opacity-40"
          >
            {submitStatus === "loading" ? "Création…" : "Créer le poste"}
          </button>
        </div>
      )}

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}
      {status === "ready" && data && data.length === 0 && (
        <p className="mt-4 text-sm text-navy/50">Aucun poste pour le moment.</p>
      )}

      {status === "ready" && data && data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-navy/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Salle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Dernière maintenance</th>
                  {hasCapability(user?.roles ?? [], "postes", "updateStatut") && (
                    <th className="px-4 py-3 font-medium"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3">{p.salle}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLES[p.statut]}`}
                      >
                        {STATUT_LABELS[p.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/60">
                      {p.dateDerniereMaintenance
                        ? new Date(p.dateDerniereMaintenance).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    {hasCapability(user?.roles ?? [], "postes", "updateStatut") && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleStatut(p)}
                          disabled={updatingId === p.id}
                          className="rounded border border-navy/20 px-3 py-1 text-xs font-medium text-navy disabled:opacity-40"
                        >
                          {updatingId === p.id
                            ? "…"
                            : p.statut === "DISPONIBLE"
                              ? "Marquer hors service"
                              : "Marquer disponible"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {updateError && <p className="mt-2 text-sm text-status-red">{updateError}</p>}

          {meta && (
            <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
              <span>
                Page {meta.page} / {meta.totalPages} · {meta.total} poste(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, meta.page - 1))}
                  disabled={meta.page <= 1}
                  className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(meta.totalPages, meta.page + 1))}
                  disabled={meta.page >= meta.totalPages}
                  className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
