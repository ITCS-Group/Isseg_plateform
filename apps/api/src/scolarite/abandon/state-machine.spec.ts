import { StatutAbandon } from '@prisma/client';
import { ALLOWED, isTransitionAllowed } from './state-machine';

const ALL_STATES: StatutAbandon[] = [
  StatutAbandon.CONSTATE,
  StatutAbandon.REPRISE_DEMANDEE,
  StatutAbandon.REPRISE_ACCORDEE,
  StatutAbandon.REPRISE_REFUSEE,
];

// Ensemble des 4 seules transitions autorisées, encodées "FROM->TO".
const ALLOWED_SET = new Set<string>([
  `${StatutAbandon.CONSTATE}->${StatutAbandon.REPRISE_DEMANDEE}`,
  `${StatutAbandon.REPRISE_DEMANDEE}->${StatutAbandon.REPRISE_ACCORDEE}`,
  `${StatutAbandon.REPRISE_DEMANDEE}->${StatutAbandon.REPRISE_REFUSEE}`,
  `${StatutAbandon.REPRISE_REFUSEE}->${StatutAbandon.REPRISE_DEMANDEE}`,
]);

describe('state-machine (Abandon)', () => {
  describe('transitions autorisées', () => {
    it.each([
      [StatutAbandon.CONSTATE, StatutAbandon.REPRISE_DEMANDEE],
      [StatutAbandon.REPRISE_DEMANDEE, StatutAbandon.REPRISE_ACCORDEE],
      [StatutAbandon.REPRISE_DEMANDEE, StatutAbandon.REPRISE_REFUSEE],
      [StatutAbandon.REPRISE_REFUSEE, StatutAbandon.REPRISE_DEMANDEE],
    ])('%s → %s est autorisée', (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(true);
    });
  });

  describe('matrice exhaustive (4x4)', () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const expected = ALLOWED_SET.has(`${from}->${to}`);
        it(`${from} → ${to} => ${expected ? 'autorisée' : 'interdite'}`, () => {
          expect(isTransitionAllowed(from, to)).toBe(expected);
        });
      }
    }
  });

  describe('transitions explicitement interdites', () => {
    it.each([
      // sauts d'état
      [StatutAbandon.CONSTATE, StatutAbandon.REPRISE_ACCORDEE],
      [StatutAbandon.CONSTATE, StatutAbandon.REPRISE_REFUSEE],
      // sortie de l'état terminal REPRISE_ACCORDEE
      [StatutAbandon.REPRISE_ACCORDEE, StatutAbandon.CONSTATE],
      [StatutAbandon.REPRISE_ACCORDEE, StatutAbandon.REPRISE_DEMANDEE],
      [StatutAbandon.REPRISE_ACCORDEE, StatutAbandon.REPRISE_REFUSEE],
      // REPRISE_REFUSEE ne va que vers REPRISE_DEMANDEE, pas ailleurs
      [StatutAbandon.REPRISE_REFUSEE, StatutAbandon.CONSTATE],
      [StatutAbandon.REPRISE_REFUSEE, StatutAbandon.REPRISE_ACCORDEE],
    ])('%s → %s est interdite', (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(false);
    });

    it.each(ALL_STATES)('X → X interdite (%s → %s)', (state) => {
      expect(isTransitionAllowed(state, state)).toBe(false);
    });
  });

  describe('états terminaux', () => {
    it('seul REPRISE_ACCORDEE est terminal (aucune sortie)', () => {
      expect(ALLOWED[StatutAbandon.REPRISE_ACCORDEE]).toHaveLength(0);
    });

    it('REPRISE_REFUSEE n\'est PAS terminal — un recours reste possible', () => {
      expect(ALLOWED[StatutAbandon.REPRISE_REFUSEE]).toEqual([StatutAbandon.REPRISE_DEMANDEE]);
    });
  });
});
