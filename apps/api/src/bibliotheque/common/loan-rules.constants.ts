import { TypeAbonne } from '@prisma/client';

/**
 * Règles d'emprunt par catégorie d'abonné — source de vérité :
 * CLAUDE.md § Library Loans (lui-même repris d'agent-bibliotheque.md §3.1,
 * confirmé faisant foi le 18/08 — décision utilisateur du chantier Bibliothèque).
 */
export interface LoanRule {
  dureePretJours: number;
  limiteEmprunts: number;
  renouvellementsMax: number;
}

export const TYPE_ABONNE_RULES: Record<TypeAbonne, LoanRule> = {
  [TypeAbonne.ETUDIANT_L1_L2]: { dureePretJours: 14, limiteEmprunts: 3, renouvellementsMax: 1 },
  [TypeAbonne.ETUDIANT_L3_M2]: { dureePretJours: 21, limiteEmprunts: 5, renouvellementsMax: 1 },
  [TypeAbonne.ENSEIGNANT]: { dureePretJours: 30, limiteEmprunts: 10, renouvellementsMax: 2 },
  [TypeAbonne.PERSONNEL_ADMIN]: { dureePretJours: 14, limiteEmprunts: 3, renouvellementsMax: 1 },
};

/** Niveaux L1/L2 → ETUDIANT_L1_L2, tout le reste (L3, M1, M2, …) → ETUDIANT_L3_M2. */
export function typeAbonneFromNiveau(niveau: string): TypeAbonne {
  const normalise = niveau.trim().toUpperCase();
  return normalise === 'L1' || normalise === 'L2'
    ? TypeAbonne.ETUDIANT_L1_L2
    : TypeAbonne.ETUDIANT_L3_M2;
}
