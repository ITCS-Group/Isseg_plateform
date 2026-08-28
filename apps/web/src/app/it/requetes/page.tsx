"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import type {
  NatureRequete,
  RequeteResponseDto,
  SousServiceIT,
  StatutRequete,
} from "@/lib/types/support-it";

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
 * Étape 2E-1 — liste en lecture seule. Le filtrage par rôle (demandeur/
 * TECHNICIEN/RESPONSABLE_IT/ADMIN) est géré côté backend
 * (RequeteController.findAll), tout comme le tri (dateOuverture desc) —
 * aucune logique de filtre/tri ici.
 * Étape 2F-1 — lignes cliquables vers /it/requetes/[id] (seule modification
 * apportée à ce fichier depuis 2E-1).
 */
export default function ItRequetesPage() {
  const { accessToken } = useAuthStore();
  const router = useRouter();

  const { data, meta, status, error, setPage } = usePaginatedFetch<RequeteResponseDto>("/requetes", {
    token: accessToken,
    limit: 20,
    enabled: !!accessToken,
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Requêtes</h1>

      {status === "loading" && <p className="mt-4 text-sm text-navy/50">Chargement…</p>}
      {status === "error" && <p className="mt-4 text-sm text-status-red">{error}</p>}
      {status === "ready" && data && data.length === 0 && (
        <p className="mt-4 text-sm text-navy/50">Aucune requête pour le moment.</p>
      )}

      {status === "ready" && data && data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-navy/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Demandeur</th>
                  <th className="px-4 py-3 font-medium">Nature</th>
                  <th className="px-4 py-3 font-medium">Sous-service</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Date d&rsquo;ouverture</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/it/requetes/${r.id}`)}
                    className="cursor-pointer border-b border-navy/5 last:border-0"
                  >
                    <td className="px-4 py-3">
                      {r.demandeurPrenom} {r.demandeurNom}
                    </td>
                    <td className="px-4 py-3 text-navy/60">{NATURE_LABELS[r.nature]}</td>
                    <td className="px-4 py-3 text-navy/60">{SOUS_SERVICE_LABELS[r.sousServiceCible]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLES[r.statut]}`}
                      >
                        {STATUT_LABELS[r.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/60">
                      {new Date(r.dateOuverture).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
              <span>
                Page {meta.page} / {meta.totalPages} · {meta.total} requête(s)
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
