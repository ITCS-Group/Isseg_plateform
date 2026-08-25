"use client";

import { Clock } from "lucide-react";

interface ComingSoonStateProps {
  /** Explique concrètement ce qui manque côté backend (pas une excuse vague). */
  message: string;
}

/**
 * Placeholder honnête pour un widget du Figma dont la donnée réelle n'est pas
 * encore disponible côté backend (cf. backlog dans STATUT_MODULES.md). Le ton
 * reste positif ("Bientôt disponible") mais aucune valeur n'est inventée.
 */
export function ComingSoonState({ message }: ComingSoonStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-page px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
        <Clock size={18} strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium text-navy">Bientôt disponible</p>
      <p className="max-w-sm text-xs text-navy/50">{message}</p>
    </div>
  );
}
