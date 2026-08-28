"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Clock, Monitor, BarChart3 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { usePaginatedFetch } from "@/lib/usePaginatedFetch";
import { hasCapability } from "@/lib/support-it-permissions";
import type {
  DisponibilitePosteDto,
  RequeteResponseDto,
  SyntheseMensuelleResponseDto,
} from "@/lib/types/support-it";
import { StatCard } from "./_components/StatCard";

type FetchStatus = "loading" | "ready" | "error";

/**
 * Étape 2D-1 — compteurs de requêtes uniquement. Le filtrage par rôle
 * (demandeur/TECHNICIEN/RESPONSABLE_IT/ADMIN) est géré côté backend
 * (RequeteController.findAll) ; cette page ne fait aucune distinction de
 * rôle, elle affiche juste meta.total des deux requêtes filtrées.
 */
export default function ItDashboardPage() {
  const { accessToken, user } = useAuthStore();

  const ouvertes = usePaginatedFetch<RequeteResponseDto>("/requetes", {
    token: accessToken,
    limit: 1,
    params: { statut: "OUVERTE" },
    enabled: !!accessToken,
  });

  const enCours = usePaginatedFetch<RequeteResponseDto>("/requetes", {
    token: accessToken,
    limit: 1,
    params: { statut: "EN_COURS" },
    enabled: !!accessToken,
  });

  // Étape 2D-2 — réponse non paginée (tableau brut par salle), pas de
  // restriction de rôle sur cet endpoint : pattern de fetch inline identique
  // à celui d'admin/page.tsx (biblio), pas de nouveau hook générique.
  const [postes, setPostes] = useState<DisponibilitePosteDto[] | null>(null);
  const [postesStatus, setPostesStatus] = useState<FetchStatus>("loading");
  const [postesError, setPostesError] = useState("");

  const fetchPostes = useCallback(async () => {
    if (!accessToken) return;
    setPostesStatus("loading");
    try {
      const data = await apiFetch<DisponibilitePosteDto[]>("/postes/stats/disponibilite", {
        token: accessToken,
      });
      setPostes(data);
      setPostesStatus("ready");
    } catch (e) {
      setPostesError(e instanceof ApiError ? e.message : "Erreur réseau");
      setPostesStatus("error");
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) fetchPostes();
  }, [accessToken, fetchPostes]);

  const postesDisponibles = postes?.reduce((sum, p) => sum + p.disponibles, 0);
  const postesTotal = postes?.reduce((sum, p) => sum + p.total, 0);

  // Étape 2D-3 — endpoint restreint côté backend à RESPONSABLE_IT/ADMIN
  // (StatsController) : on évite l'appel réseau pour un rôle qui recevrait
  // de toute façon un 403, via la même capacité que ItSidebar.
  const peutVoirSynthese = hasCapability(user?.roles ?? [], "synthese", "view");

  const [synthese, setSynthese] = useState<SyntheseMensuelleResponseDto | null>(null);
  const [syntheseStatus, setSyntheseStatus] = useState<FetchStatus>("loading");
  const [syntheseError, setSyntheseError] = useState("");

  const fetchSynthese = useCallback(async () => {
    if (!accessToken || !peutVoirSynthese) return;
    setSyntheseStatus("loading");
    try {
      const data = await apiFetch<SyntheseMensuelleResponseDto>("/support-it/stats/synthese-mensuelle", {
        token: accessToken,
      });
      setSynthese(data);
      setSyntheseStatus("ready");
    } catch (e) {
      setSyntheseError(e instanceof ApiError ? e.message : "Erreur réseau");
      setSyntheseStatus("error");
    }
  }, [accessToken, peutVoirSynthese]);

  useEffect(() => {
    if (accessToken && peutVoirSynthese) fetchSynthese();
  }, [accessToken, peutVoirSynthese, fetchSynthese]);

  const totalRequetesMois = synthese?.parSousService.reduce((sum, s) => sum + s.totalRequetes, 0);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-navy">Tableau de bord Support IT</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Requêtes ouvertes"
          icon={Ticket}
          status={ouvertes.status}
          value={ouvertes.meta ? String(ouvertes.meta.total) : undefined}
          errorMessage={ouvertes.error}
        />
        <StatCard
          label="Requêtes en cours"
          icon={Clock}
          status={enCours.status}
          value={enCours.meta ? String(enCours.meta.total) : undefined}
          errorMessage={enCours.error}
        />
        <StatCard
          label="Postes disponibles"
          icon={Monitor}
          status={postesStatus}
          value={postes ? String(postesDisponibles) : undefined}
          delta={postes ? `sur ${postesTotal}` : undefined}
          errorMessage={postesError}
        />
        {peutVoirSynthese && (
          <StatCard
            label="Requêtes du mois"
            icon={BarChart3}
            status={syntheseStatus}
            value={synthese ? String(totalRequetesMois) : undefined}
            errorMessage={syntheseError}
          />
        )}
      </div>
    </div>
  );
}
