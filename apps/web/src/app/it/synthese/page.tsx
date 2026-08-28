"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { hasCapability } from "@/lib/support-it-permissions";
import type { SyntheseMensuelleResponseDto } from "@/lib/types/support-it";

type FetchStatus = "loading" | "ready" | "error";

const NATURE_LABELS: Record<string, string> = {
  PANNE_MATERIEL: "Panne matérielle",
  ACCES_COMPTE: "Accès compte",
  INSTALLATION_LOGICIEL: "Installation logiciel",
  INCIDENT_SECURITE: "Incident sécurité",
  RESEAU: "Réseau",
  AUTRE: "Autre",
};

const SOUS_SERVICE_LABELS: Record<string, string> = {
  CENTRE_INFORMATIQUE: "Centre informatique",
  CYBER: "Cyber",
  MAINTENANCE: "Maintenance",
};

const STATUT_LABELS: Record<string, string> = {
  OUVERTE: "Ouverte",
  EN_COURS: "En cours",
  CLOTUREE: "Clôturée",
};

/**
 * Étape 2E-5 — GET /support-it/stats/synthese-mensuelle est restreint côté
 * backend à RESPONSABLE_IT/ADMIN (@Roles au niveau du StatsController). Le
 * lien "Synthèse mensuelle" est déjà masqué pour TECHNICIEN dans
 * ItSidebar, mais rien n'empêche une navigation directe vers cette URL —
 * donc la page entière (pas juste une carte, contrairement au dashboard
 * 2D-3) est gardée par hasCapability : aucun appel réseau n'est déclenché
 * si l'utilisateur n'a pas la capacité, un message d'accès non autorisé
 * s'affiche à la place. Pure confort UX — le backend reste la seule
 * autorité de sécurité.
 */
export default function ItSynthesePage() {
  const { accessToken, user } = useAuthStore();
  const peutVoir = hasCapability(user?.roles ?? [], "synthese", "view");

  const [synthese, setSynthese] = useState<SyntheseMensuelleResponseDto | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [error, setError] = useState("");

  const fetchSynthese = useCallback(async () => {
    if (!accessToken || !peutVoir) return;
    setStatus("loading");
    try {
      const data = await apiFetch<SyntheseMensuelleResponseDto>("/support-it/stats/synthese-mensuelle", {
        token: accessToken,
      });
      setSynthese(data);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur réseau");
      setStatus("error");
    }
  }, [accessToken, peutVoir]);

  useEffect(() => {
    if (accessToken && peutVoir) fetchSynthese();
  }, [accessToken, peutVoir, fetchSynthese]);

  if (!peutVoir) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-navy">Synthèse mensuelle</h1>
        <p className="mt-4 text-sm text-status-red">
          Accès non autorisé — réservé à RESPONSABLE_IT/ADMIN.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">
        Synthèse mensuelle{synthese ? ` — ${synthese.mois}` : ""}
      </h1>

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}

      {status === "ready" && synthese && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {synthese.parSousService.map((s) => (
            <div key={s.sousService} className="rounded-2xl border border-navy/10 bg-white p-5">
              <p className="text-sm text-navy/50">{SOUS_SERVICE_LABELS[s.sousService] ?? s.sousService}</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{s.totalRequetes}</p>

              <div className="mt-4">
                <p className="text-xs font-medium text-navy/50">Par nature</p>
                {s.parNature.length === 0 ? (
                  <p className="mt-1 text-xs text-navy/40">Aucune</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs text-navy/60">
                    {s.parNature.map((n) => (
                      <li key={n.nature}>
                        {NATURE_LABELS[n.nature] ?? n.nature} : {n.total}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-navy/50">Par statut</p>
                {s.parStatut.length === 0 ? (
                  <p className="mt-1 text-xs text-navy/40">Aucune</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs text-navy/60">
                    {s.parStatut.map((st) => (
                      <li key={st.statut}>
                        {STATUT_LABELS[st.statut] ?? st.statut} : {st.total}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
