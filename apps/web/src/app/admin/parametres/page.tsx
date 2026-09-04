"use client";

import { useState } from "react";
import { IdentityManagement } from "../_components/IdentityManagement";
import { ComingSoonState } from "../_components/ComingSoonState";

type ParametresTab = "annee" | "utilisateurs" | "integrations";

const TABS: { key: ParametresTab; label: string }[] = [
  { key: "annee", label: "Année académique" },
  { key: "utilisateurs", label: "Utilisateurs & rôles" },
  { key: "integrations", label: "Intégrations" },
];

export default function AdminParametresPage() {
  const [tab, setTab] = useState<ParametresTab>("utilisateurs");

  return (
    <div className="p-6 pb-0">
      <div className="mb-2 flex w-fit gap-1 rounded-xl border border-navy/10 bg-page p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key ? "bg-white text-navy shadow-sm" : "text-navy/50 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "annee" && (
        <div className="p-6 pt-4">
          <ComingSoonState message="Le modèle AnneeUniversitaire existe côté base de données, mais aucun endpoint ne l'expose encore, et le calendrier des étapes clés (inscriptions, examens, délibérations) n'est pas modélisé. Nécessite un chantier backend dédié." />
        </div>
      )}

      {tab === "utilisateurs" && <IdentityManagement />}

      {tab === "integrations" && (
        <div className="p-6 pt-4">
          <ComingSoonState message="Aucune intégration (Moodle, SMTP, SMS, stockage) n'est aujourd'hui pilotable depuis l'administration — la synchronisation Moodle existe comme service technique séparé (services/moodle-service), pas comme réglage on/off pour un admin." />
        </div>
      )}
    </div>
  );
}
