"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import { hasCapability } from "@/lib/support-it-permissions";
import type { CoursSupportITResponseDto } from "@/lib/types/support-it";

/**
 * Étape 2E-3 — liste en lecture seule. GET /cours-support-it n'a aucune
 * restriction de rôle : RESPONSABLE_IT et TECHNICIEN reçoivent la même
 * liste, comme /it/postes. Pas de filtre/tri (aucun disponible côté
 * backend), pas de ligne cliquable, `contenu` volontairement absent du
 * tableau (texte long, pas une colonne de liste).
 * Étape 2G-2 — formulaire de création (POST /cours-support-it), réutilise
 * hasCapability("cours","create") déjà existant, inchangé. Validation
 * frontend minimale (mêmes seuils que le backend), le backend reste la
 * source de vérité.
 * Étape 2H-1 — titre cliquable vers /it/cours/[id] (GET /cours-support-it/:id,
 * ouvert à tout compte authentifié, aucun garde de capacité nécessaire).
 */
export default function ItCoursPage() {
  const { accessToken, user } = useAuthStore();
  const router = useRouter();

  const { data, meta, status, error, setPage, refetch } = usePaginatedFetch<CoursSupportITResponseDto>(
    "/cours-support-it",
    {
      token: accessToken,
      limit: 20,
      enabled: !!accessToken,
    },
  );

  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [niveau, setNiveau] = useState("");
  const [duree, setDuree] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  const dureeNombre = Number(duree);
  const formValide =
    titre.trim().length >= 3 &&
    contenu.trim().length >= 10 &&
    niveau.trim().length >= 2 &&
    Number.isInteger(dureeNombre) &&
    dureeNombre >= 1;

  async function handleCreate() {
    if (!accessToken || !formValide) return;
    setSubmitStatus("loading");
    setSubmitError("");
    try {
      await apiFetch<CoursSupportITResponseDto>("/cours-support-it", {
        method: "POST",
        token: accessToken,
        body: { titre, contenu, niveau, duree: dureeNombre },
      });
      setSubmitStatus("idle");
      setTitre("");
      setContenu("");
      setNiveau("");
      setDuree("");
      refetch();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Erreur réseau");
      setSubmitStatus("error");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Cours</h1>

      {hasCapability(user?.roles ?? [], "cours", "create") && (
        <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
          <p className="text-sm font-medium text-navy">Créer un cours</p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-navy/50">Titre</label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Titre du cours"
                className="mt-1 w-full rounded border border-navy/20 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-navy/50">Niveau</label>
              <input
                type="text"
                value={niveau}
                onChange={(e) => setNiveau(e.target.value)}
                placeholder="Niveau"
                className="mt-1 w-full rounded border border-navy/20 p-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-navy/50">Contenu</label>
              <textarea
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                placeholder="Contenu"
                rows={3}
                className="mt-1 w-full rounded border border-navy/20 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-navy/50">Durée (minutes)</label>
              <input
                type="number"
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder="Durée (minutes)"
                className="mt-1 w-full rounded border border-navy/20 p-2 text-sm"
              />
            </div>
          </div>

          {submitStatus === "error" && (
            <p className="mt-2 text-sm text-status-red">{submitError}</p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={submitStatus === "loading" || !formValide}
            className="mt-3 rounded border border-navy/20 px-3 py-1 text-sm font-medium text-navy disabled:opacity-40"
          >
            {submitStatus === "loading" ? "Création…" : "Créer le cours"}
          </button>
        </div>
      )}

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}
      {status === "ready" && data && data.length === 0 && (
        <p className="mt-4 text-sm text-navy/50">Aucun cours pour le moment.</p>
      )}

      {status === "ready" && data && data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-navy/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 font-medium">Niveau</th>
                  <th className="px-4 py-3 font-medium">Durée</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/it/cours/${c.id}`)}
                        className="text-left text-navy underline-offset-2 hover:underline"
                      >
                        {c.titre}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-navy/60">{c.niveau}</td>
                    <td className="px-4 py-3 text-navy/60">{c.duree} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
              <span>
                Page {meta.page} / {meta.totalPages} · {meta.total} cours
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
