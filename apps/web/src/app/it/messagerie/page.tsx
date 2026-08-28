"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import type { MessageResponseDto } from "@/lib/types/messagerie";

type Tab = "recus" | "envoyes";

/**
 * Étape 2E-6 — dernière sous-étape de 2E. Module transverse (hors périmètre
 * Support IT), GET /messages/{recus,envoyes} sans @Roles : le scope est par
 * identité (user.id côté backend), pas par rôle — RESPONSABLE_IT et
 * TECHNICIEN exécutent le même code, leurs listes diffèrent seulement parce
 * que ce sont des comptes différents. Un seul des deux hooks est enabled à
 * la fois (celui de l'onglet actif) pour éviter un appel réseau inutile.
 * Pas de composition/envoi, pas de détail, pas de recherche.
 */
export default function ItMessagerlePage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<Tab>("recus");

  const recus = usePaginatedFetch<MessageResponseDto>("/messages/recus", {
    token: accessToken,
    limit: 20,
    enabled: !!accessToken && tab === "recus",
  });

  const envoyes = usePaginatedFetch<MessageResponseDto>("/messages/envoyes", {
    token: accessToken,
    limit: 20,
    enabled: !!accessToken && tab === "envoyes",
  });

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "recus", label: "Reçus", badge: recus.meta?.total },
    { key: "envoyes", label: "Envoyés", badge: envoyes.meta?.total },
  ];

  const active = tab === "recus" ? recus : envoyes;
  const emptyLabel =
    tab === "recus" ? "Aucun message reçu pour le moment." : "Aucun message envoyé pour le moment.";

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Messagerie</h1>

      <div className="mt-4 mb-4 flex gap-1 border-b border-navy/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? "border-gold text-navy" : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {active.status === "loading" && <p className="text-sm text-navy/50">Chargement…</p>}
      {active.status === "error" && <p className="text-sm text-status-red">{active.error}</p>}
      {active.status === "ready" && active.data && active.data.length === 0 && (
        <p className="text-sm text-navy/50">{emptyLabel}</p>
      )}

      {active.status === "ready" && active.data && active.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-navy/50">
                <tr>
                  <th className="px-4 py-3 font-medium">{tab === "recus" ? "Expéditeur" : "Destinataire(s)"}</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {active.data.map((m) => (
                  <tr key={m.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3">
                      {tab === "recus"
                        ? `${m.expediteurPrenom} ${m.expediteurNom}`
                        : m.destinataires.map((d) => `${d.prenom} ${d.nom}`).join(", ")}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-navy/60">{m.contenu}</td>
                    <td className="px-4 py-3 text-navy/60">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {active.meta && (
            <div className="mt-4 flex items-center justify-between text-sm text-navy/50">
              <span>
                Page {active.meta.page} / {active.meta.totalPages} · {active.meta.total} message(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => active.setPage(Math.max(1, active.meta!.page - 1))}
                  disabled={active.meta.page <= 1}
                  className="rounded border border-navy/20 px-3 py-1 disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => active.setPage(Math.min(active.meta!.totalPages, active.meta!.page + 1))}
                  disabled={active.meta.page >= active.meta.totalPages}
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
