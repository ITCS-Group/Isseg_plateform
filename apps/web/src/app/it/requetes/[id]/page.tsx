"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import { hasCapability } from "@/lib/support-it-permissions";
import type {
  InterventionResponseDto,
  NatureRequete,
  RequeteResponseDto,
  SousServiceIT,
  StatutRequete,
} from "@/lib/types/support-it";

type FetchStatus = "loading" | "ready" | "error";

const NATURE_LABELS: Record<NatureRequete, string> = {
  PANNE_MATERIEL: "Panne matérielle",
  ACCES_COMPTE: "Accès compte",
  INSTALLATION_LOGICIEL: "Installation logiciel",
  INCIDENT_SECURITE: "Incident sécurité",
  RESEAU: "Réseau",
  AUTRE: "Autre",
};

const SOUS_SERVICE_LABELS: Record<SousServiceIT, string> = {
  CENTRE_INFORMATIQUE: "Centre informatique",
  CYBER: "Cyber",
  MAINTENANCE: "Maintenance",
};

const STATUT_LABELS: Record<StatutRequete, string> = {
  OUVERTE: "Ouverte",
  EN_COURS: "En cours",
  CLOTUREE: "Clôturée",
};

const STATUT_STYLES: Record<StatutRequete, string> = {
  OUVERTE: "bg-status-orange/10 text-status-orange",
  EN_COURS: "bg-status-neutral/10 text-status-neutral",
  CLOTUREE: "bg-status-green/10 text-status-green",
};

/**
 * Étape 2F-1 — détail en lecture seule. GET /requetes/:id applique
 * assertCanViewRequete côté backend (403 si hors périmètre du rôle/profil
 * de l'appelant) — aucun garde de rôle ajouté ici, le 403 s'affiche comme
 * une erreur standard.
 * Étape 2F-2 — bouton "Clôturer" (PATCH /requetes/:id/cloturer). Le garde
 * hasCapability("requetes","cloturer") ne vérifie que l'appartenance au
 * rôle, pas la correspondance de sous-service pour TECHNICIEN (impossible
 * à vérifier côté client) — le backend (assertCanHandleRequete) reste seul
 * juge. Confirmation via un composant inline (pas window.confirm — bloque
 * le thread JS, incompatible avec l'automatisation navigateur et hors
 * design système).
 * Étape 2F-3 — formulaire d'ajout d'intervention (POST
 * /requetes/:requeteId/interventions), réservé TECHNICIEN
 * (hasCapability("interventions","create"), déjà existant, inchangé) et
 * masqué si la requête est clôturée. Un ajout peut faire passer la requête
 * OUVERTE → EN_COURS côté backend — fetchRequete() est donc re-déclenché en
 * plus du refetch des interventions.
 */
export default function ItRequeteDetailPage({ params }: { params: { id: string } }) {
  const { accessToken, user } = useAuthStore();
  const { id } = params;

  const [requete, setRequete] = useState<RequeteResponseDto | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [error, setError] = useState("");

  const fetchRequete = useCallback(async () => {
    if (!accessToken) return;
    setStatus("loading");
    try {
      const data = await apiFetch<RequeteResponseDto>(`/requetes/${id}`, { token: accessToken });
      setRequete(data);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur réseau");
      setStatus("error");
    }
  }, [accessToken, id]);

  useEffect(() => {
    if (accessToken) fetchRequete();
  }, [accessToken, fetchRequete]);

  const [clotureStatus, setClotureStatus] = useState<"idle" | "loading" | "error">("idle");
  const [clotureError, setClotureError] = useState("");
  const [showConfirmCloture, setShowConfirmCloture] = useState(false);

  const confirmCloturer = useCallback(async () => {
    if (!accessToken) return;
    setShowConfirmCloture(false);
    setClotureStatus("loading");
    setClotureError("");
    try {
      await apiFetch<RequeteResponseDto>(`/requetes/${id}/cloturer`, {
        method: "PATCH",
        token: accessToken,
      });
      setClotureStatus("idle");
      await fetchRequete();
    } catch (e) {
      setClotureError(e instanceof ApiError ? e.message : "Erreur réseau");
      setClotureStatus("error");
    }
  }, [accessToken, id, fetchRequete]);

  const interventions = usePaginatedFetch<InterventionResponseDto>(`/requetes/${id}/interventions`, {
    token: accessToken,
    limit: 20,
    enabled: !!accessToken && status === "ready",
  });

  const [compteRendu, setCompteRendu] = useState("");
  const [interventionStatus, setInterventionStatus] = useState<"idle" | "loading" | "error">("idle");
  const [interventionError, setInterventionError] = useState("");

  const handleAddIntervention = useCallback(async () => {
    if (!accessToken || compteRendu.trim().length < 5) return;
    setInterventionStatus("loading");
    setInterventionError("");
    try {
      await apiFetch<InterventionResponseDto>(`/requetes/${id}/interventions`, {
        method: "POST",
        token: accessToken,
        body: { compteRendu },
      });
      setInterventionStatus("idle");
      setCompteRendu("");
      await fetchRequete();
      interventions.refetch();
    } catch (e) {
      setInterventionError(e instanceof ApiError ? e.message : "Erreur réseau");
      setInterventionStatus("error");
    }
  }, [accessToken, id, compteRendu, fetchRequete, interventions]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Détail de la requête</h1>

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}

      {status === "ready" && requete && (
        <>
          <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-navy/50">Demandeur</p>
                <p className="text-navy">
                  {requete.demandeurPrenom} {requete.demandeurNom}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLES[requete.statut]}`}
                >
                  {STATUT_LABELS[requete.statut]}
                </span>
                {requete.statut !== "CLOTUREE" &&
                  hasCapability(user?.roles ?? [], "requetes", "cloturer") && (
                    <button
                      type="button"
                      onClick={() => setShowConfirmCloture(true)}
                      disabled={clotureStatus === "loading"}
                      className="rounded border border-navy/20 px-3 py-1 text-xs font-medium text-navy disabled:opacity-40"
                    >
                      {clotureStatus === "loading" ? "Clôture…" : "Clôturer"}
                    </button>
                  )}
              </div>
            </div>

            {clotureStatus === "error" && (
              <p className="mt-2 text-sm text-status-red">{clotureError}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-navy/50">Nature</p>
                <p className="text-navy">{NATURE_LABELS[requete.nature]}</p>
              </div>
              <div>
                <p className="text-sm text-navy/50">Sous-service</p>
                <p className="text-navy">{SOUS_SERVICE_LABELS[requete.sousServiceCible]}</p>
              </div>
              <div>
                <p className="text-sm text-navy/50">Date d&rsquo;ouverture</p>
                <p className="text-navy">{new Date(requete.dateOuverture).toLocaleDateString("fr-FR")}</p>
              </div>
              <div>
                <p className="text-sm text-navy/50">Date de clôture</p>
                <p className="text-navy">
                  {requete.dateCloture ? new Date(requete.dateCloture).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-navy/50">Description</p>
              <p className="mt-1 text-navy">{requete.description}</p>
            </div>
          </div>

          <h2 className="mt-6 text-lg font-semibold text-navy">Interventions</h2>

          {interventions.status === "loading" && (
            <p className="mt-2 text-sm text-navy/50">Chargement…</p>
          )}
          {interventions.status === "error" && (
            <p className="mt-2 text-sm text-status-red">{interventions.error}</p>
          )}
          {interventions.status === "ready" &&
            interventions.data &&
            interventions.data.length === 0 && (
              <p className="mt-2 text-sm text-navy/50">Aucune intervention pour le moment.</p>
            )}

          {interventions.status === "ready" && interventions.data && interventions.data.length > 0 && (
            <>
              <div className="mt-2 overflow-x-auto rounded-xl bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-navy/10 text-navy/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Technicien</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Compte-rendu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interventions.data.map((i) => (
                      <tr key={i.id} className="border-b border-navy/5 last:border-0">
                        <td className="px-4 py-3">
                          {i.technicienPrenom} {i.technicienNom}
                        </td>
                        <td className="px-4 py-3 text-navy/60">{new Date(i.date).toLocaleDateString("fr-FR")}</td>
                        <td className="max-w-md truncate px-4 py-3 text-navy/60">{i.compteRendu}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {interventions.meta && (
                <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
                  <span>
                    Page {interventions.meta.page} / {interventions.meta.totalPages} ·{" "}
                    {interventions.meta.total} intervention(s)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => interventions.setPage(Math.max(1, interventions.meta!.page - 1))}
                      disabled={interventions.meta.page <= 1}
                      className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        interventions.setPage(
                          Math.min(interventions.meta!.totalPages, interventions.meta!.page + 1),
                        )
                      }
                      disabled={interventions.meta.page >= interventions.meta.totalPages}
                      className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {requete.statut !== "CLOTUREE" &&
            hasCapability(user?.roles ?? [], "interventions", "create") && (
              <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
                <p className="text-sm font-medium text-navy">Ajouter une intervention</p>
                <textarea
                  value={compteRendu}
                  onChange={(e) => setCompteRendu(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded border border-navy/20 p-2 text-sm"
                  placeholder="Compte-rendu (5 caractères minimum)"
                />
                {interventionStatus === "error" && (
                  <p className="mt-2 text-sm text-status-red">{interventionError}</p>
                )}
                <button
                  type="button"
                  onClick={handleAddIntervention}
                  disabled={interventionStatus === "loading" || compteRendu.trim().length < 5}
                  className="mt-2 rounded border border-navy/20 px-3 py-1 text-sm font-medium text-navy disabled:opacity-40"
                >
                  {interventionStatus === "loading" ? "Envoi…" : "Ajouter une intervention"}
                </button>
              </div>
            )}
        </>
      )}

      {showConfirmCloture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <p className="text-sm text-navy">
              Voulez-vous vraiment clôturer cette requête ? Cette action est irréversible.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmCloture(false)}
                className="rounded border border-navy/20 px-3 py-1 text-sm text-navy"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmCloturer}
                className="rounded-lg bg-gold px-3 py-1 text-sm font-semibold text-navy transition-opacity hover:opacity-90"
              >
                Clôturer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
