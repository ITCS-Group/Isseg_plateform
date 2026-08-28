"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import { hasCapability } from "@/lib/support-it-permissions";
import type {
  EvaluationSupportITResponseDto,
  InscriptionCoursSupportITResponseDto,
  StatutInscriptionCoursSupportIT,
} from "@/lib/types/support-it";

const STATUT_LABELS: Record<StatutInscriptionCoursSupportIT, string> = {
  EN_COURS: "En cours",
  TERMINE: "Terminée",
  ABANDONNE: "Abandonnée",
};

const STATUT_STYLES: Record<StatutInscriptionCoursSupportIT, string> = {
  EN_COURS: "bg-status-neutral/10 text-status-neutral",
  TERMINE: "bg-status-green/10 text-status-green",
  ABANDONNE: "bg-status-red/10 text-status-red",
};

/**
 * Étape 2E-4 — liste en lecture seule. GET /inscriptions-support-it n'a pas
 * de @Roles, mais le scope diffère par rôle côté service
 * (InscriptionCoursSupportITService.findAll) : RESPONSABLE_IT/ADMIN voient
 * tout, tout autre rôle (dont TECHNICIEN) ne voit que ses propres
 * inscriptions (participantId = son user.id). Pas de garde hasCapability
 * ici — la restriction est déjà appliquée par le backend. Pas de colonne
 * participant : InscriptionCoursSupportITResponseDto n'expose pas de
 * nom/prénom, seulement coursTitre/statut/progression.
 * Étape 2G-3 — formulaire d'évaluation par ligne (POST .../evaluation),
 * réutilise hasCapability("evaluations","create") déjà existant, inchangé.
 * Le backend ne vérifie pas le statut de l'inscription pour cette action —
 * le bouton n'est affiché ici que sur EN_COURS (choix UI, pas une
 * contrainte backend). L'attestation renvoyée par le POST n'est jamais
 * persistée côté backend (stub) : affichée une seule fois, immédiatement
 * après un succès avec statutReussite = true.
 */
export default function ItInscriptionsPage() {
  const { accessToken, user } = useAuthStore();

  const { data, meta, status, error, setPage, refetch } = usePaginatedFetch<InscriptionCoursSupportITResponseDto>(
    "/inscriptions-support-it",
    {
      token: accessToken,
      limit: 20,
      enabled: !!accessToken,
    },
  );

  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [statutReussite, setStatutReussite] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [attestation, setAttestation] = useState<EvaluationSupportITResponseDto["attestation"]>(undefined);

  function openEvaluer(id: string) {
    setEvaluatingId(id);
    setNote("");
    setStatutReussite(false);
    setSubmitStatus("idle");
    setSubmitError("");
  }

  async function handleEvaluer(inscriptionId: string) {
    if (!accessToken) return;
    const noteNombre = Number(note);
    if (!Number.isFinite(noteNombre) || noteNombre < 0 || noteNombre > 20) return;
    setSubmitStatus("loading");
    setSubmitError("");
    try {
      const data = await apiFetch<EvaluationSupportITResponseDto>(
        `/inscriptions-support-it/${inscriptionId}/evaluation`,
        {
          method: "POST",
          token: accessToken,
          body: { note: noteNombre, statutReussite },
        },
      );
      setSubmitStatus("idle");
      setEvaluatingId(null);
      setAttestation(data.attestation);
      refetch();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Erreur réseau");
      setSubmitStatus("error");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Inscriptions</h1>

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}
      {status === "ready" && data && data.length === 0 && (
        <p className="mt-4 text-sm text-navy/50">Aucune inscription pour le moment.</p>
      )}

      {status === "ready" && data && data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-navy/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Cours</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Progression</th>
                  <th className="px-4 py-3 font-medium">Date d&rsquo;inscription</th>
                  {hasCapability(user?.roles ?? [], "evaluations", "create") && (
                    <th className="px-4 py-3 font-medium"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3">{i.coursTitre}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLES[i.statut]}`}
                      >
                        {STATUT_LABELS[i.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/60">{i.progression} %</td>
                    <td className="px-4 py-3 text-navy/60">
                      {new Date(i.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    {hasCapability(user?.roles ?? [], "evaluations", "create") && (
                      <td className="px-4 py-3">
                        {i.statut === "EN_COURS" &&
                          (evaluatingId === i.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Note /20"
                                className="w-20 rounded border border-navy/20 p-1 text-xs"
                              />
                              <label className="flex items-center gap-1 text-xs text-navy">
                                <input
                                  type="checkbox"
                                  checked={statutReussite}
                                  onChange={(e) => setStatutReussite(e.target.checked)}
                                />
                                Réussite
                              </label>
                              <button
                                type="button"
                                onClick={() => handleEvaluer(i.id)}
                                disabled={submitStatus === "loading"}
                                className="rounded border border-navy/20 px-2 py-1 text-xs font-medium text-navy disabled:opacity-40"
                              >
                                {submitStatus === "loading" ? "Envoi…" : "Valider l'évaluation"}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEvaluer(i.id)}
                              className="rounded border border-navy/20 px-2 py-1 text-xs font-medium text-navy"
                            >
                              Évaluer
                            </button>
                          ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {submitStatus === "error" && (
            <p className="mt-2 text-sm text-status-red">{submitError}</p>
          )}

          {attestation && (
            <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
              <p className="text-sm font-medium text-navy">Attestation générée</p>
              <p className="mt-2 whitespace-pre-line text-sm text-navy/70">{attestation.contenu}</p>
            </div>
          )}

          {meta && (
            <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
              <span>
                Page {meta.page} / {meta.totalPages} · {meta.total} inscription(s)
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
