"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, CreditCard, Library, LifeBuoy, TrendingUp } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { StatCard } from "./_components/StatCard";
import { ComingSoonState } from "./_components/ComingSoonState";

interface BibliothequeStats {
  totalOuvrages: number;
  totalExemplaires: number;
  exemplairesDisponibles: number;
  empruntsEnCours: number;
  empruntsEnRetard: number;
  reservationsEnAttente: number;
  totalAbonnes: number;
  totalDocumentsAcademiques: number;
}

type FetchStatus = "loading" | "ready" | "error";

export default function AdminDashboardPage() {
  const { accessToken } = useAuthStore();

  const [biblio, setBiblio] = useState<BibliothequeStats | null>(null);
  const [biblioStatus, setBiblioStatus] = useState<FetchStatus>("loading");
  const [biblioError, setBiblioError] = useState("");

  const fetchBiblio = useCallback(async () => {
    if (!accessToken) return;
    setBiblioStatus("loading");
    try {
      const data = await apiFetch<BibliothequeStats>("/bibliotheque/stats/dashboard", {
        token: accessToken,
      });
      setBiblio(data);
      setBiblioStatus("ready");
    } catch (e) {
      setBiblioError(e instanceof ApiError ? e.message : "Erreur réseau");
      setBiblioStatus("error");
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) fetchBiblio();
  }, [accessToken, fetchBiblio]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Tableau de bord</h1>
        <p className="mt-0.5 text-sm text-navy/50">Vue d&rsquo;ensemble de l&rsquo;établissement</p>
      </div>

      {/* StatCards — cf. STATUT_MODULES.md pour le détail des endpoints manquants */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Effectif total" icon={Users} status="coming-soon" />
        <StatCard label="Taux de paiement" icon={CreditCard} status="coming-soon" />
        <StatCard
          label="Prêts bibliothèque"
          icon={Library}
          status={biblioStatus}
          errorMessage={biblioError}
          value={biblio ? String(biblio.empruntsEnCours) : undefined}
          delta={biblio ? `${biblio.empruntsEnRetard} en retard` : undefined}
          deltaTone={biblio && biblio.empruntsEnRetard > 0 ? "negative" : "positive"}
        />
        <StatCard label="Tickets IT ouverts" icon={LifeBuoy} status="coming-soon" />
      </div>

      {/* Graphique */}
      <div className="rounded-2xl border border-navy/10 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={16} strokeWidth={1.75} className="text-navy/40" />
          <h2 className="text-sm font-semibold text-navy">Évolution des inscriptions</h2>
        </div>
        <ComingSoonState message="Nécessite un endpoint d'agrégat mensuel côté Scolarité (inscriptions/abandons) — pas encore livré. Voir STATUT_MODULES.md." />
      </div>

      {/* Tableaux */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-navy/10 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-navy">Inscriptions récentes</h2>
          <ComingSoonState message="L'API Scolarité n'expose aujourd'hui que les actions du workflow d'inscription (soumission, traitement, inscription, rejet) — aucun endpoint de consultation en liste n'existe encore." />
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-navy">Tickets IT récents</h2>
          <ComingSoonState message="Le module Support IT n'a pas encore été construit côté backend." />
        </div>
      </div>
    </div>
  );
}
