import { StatutAbandon } from '@prisma/client';

/**
 * Machine à états officielle du workflow Abandon.statut.
 *
 * Source UNIQUE de vérité des transitions autorisées.
 *
 *   CONSTATE → REPRISE_DEMANDEE ─┬→ REPRISE_ACCORDEE  (terminal)
 *                                └→ REPRISE_REFUSEE ───┐
 *                                        ↑              │
 *                                        └──────────────┘
 *                                (nouvelle demande après refus)
 *
 * Un refus n'est pas définitif : REPRISE_REFUSEE → REPRISE_DEMANDEE reste
 * ouvert pour permettre un nouveau recours. Seul REPRISE_ACCORDEE est
 * terminal. Toute transition absente de cette table est interdite (sauts
 * d'état, X → X, sortie de REPRISE_ACCORDEE).
 */
export const ALLOWED: Record<StatutAbandon, StatutAbandon[]> = {
  [StatutAbandon.CONSTATE]: [StatutAbandon.REPRISE_DEMANDEE],
  [StatutAbandon.REPRISE_DEMANDEE]: [StatutAbandon.REPRISE_ACCORDEE, StatutAbandon.REPRISE_REFUSEE],
  [StatutAbandon.REPRISE_ACCORDEE]: [],
  [StatutAbandon.REPRISE_REFUSEE]: [StatutAbandon.REPRISE_DEMANDEE],
};

/**
 * Indique si la transition `from → to` fait partie des transitions autorisées.
 */
export function isTransitionAllowed(from: StatutAbandon, to: StatutAbandon): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
