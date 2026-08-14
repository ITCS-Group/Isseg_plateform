import { StatutDossier } from '@prisma/client';
import {
  ALLOWED,
  isTransitionAllowed,
  TERMINAL_STATES,
  TRANSITION_EVENT_TYPE,
} from './state-machine';

const ALL_STATES: StatutDossier[] = [
  StatutDossier.BROUILLON,
  StatutDossier.SOUMIS,
  StatutDossier.EN_TRAITEMENT,
  StatutDossier.INSCRIT,
  StatutDossier.REJETE,
];

// Ensemble des 4 seules transitions autorisées, encodées "FROM->TO".
const ALLOWED_SET = new Set<string>([
  `${StatutDossier.BROUILLON}->${StatutDossier.SOUMIS}`,
  `${StatutDossier.SOUMIS}->${StatutDossier.EN_TRAITEMENT}`,
  `${StatutDossier.EN_TRAITEMENT}->${StatutDossier.INSCRIT}`,
  `${StatutDossier.EN_TRAITEMENT}->${StatutDossier.REJETE}`,
]);

describe('state-machine', () => {
  describe('transitions autorisées', () => {
    it.each([
      [StatutDossier.BROUILLON, StatutDossier.SOUMIS],
      [StatutDossier.SOUMIS, StatutDossier.EN_TRAITEMENT],
      [StatutDossier.EN_TRAITEMENT, StatutDossier.INSCRIT],
      [StatutDossier.EN_TRAITEMENT, StatutDossier.REJETE],
    ])('%s → %s est autorisée', (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(true);
    });
  });

  describe('matrice exhaustive (5x5)', () => {
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
      [StatutDossier.BROUILLON, StatutDossier.EN_TRAITEMENT],
      [StatutDossier.BROUILLON, StatutDossier.INSCRIT],
      [StatutDossier.BROUILLON, StatutDossier.REJETE],
      [StatutDossier.SOUMIS, StatutDossier.INSCRIT],
      [StatutDossier.SOUMIS, StatutDossier.REJETE],
      // retours arrière
      [StatutDossier.SOUMIS, StatutDossier.BROUILLON],
      [StatutDossier.EN_TRAITEMENT, StatutDossier.BROUILLON],
      [StatutDossier.EN_TRAITEMENT, StatutDossier.SOUMIS],
      // sorties d'états terminaux
      [StatutDossier.INSCRIT, StatutDossier.BROUILLON],
      [StatutDossier.INSCRIT, StatutDossier.SOUMIS],
      [StatutDossier.INSCRIT, StatutDossier.EN_TRAITEMENT],
      [StatutDossier.INSCRIT, StatutDossier.REJETE],
      [StatutDossier.REJETE, StatutDossier.BROUILLON],
      [StatutDossier.REJETE, StatutDossier.SOUMIS],
      [StatutDossier.REJETE, StatutDossier.EN_TRAITEMENT],
      [StatutDossier.REJETE, StatutDossier.INSCRIT],
    ])('%s → %s est interdite', (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(false);
    });

    it.each(ALL_STATES)('X → X interdite (%s → %s)', (state) => {
      expect(isTransitionAllowed(state, state)).toBe(false);
    });
  });

  describe('états terminaux', () => {
    it('INSCRIT et REJETE sont terminaux (aucune sortie)', () => {
      expect(TERMINAL_STATES).toEqual(
        expect.arrayContaining([StatutDossier.INSCRIT, StatutDossier.REJETE]),
      );
      expect(ALLOWED[StatutDossier.INSCRIT]).toHaveLength(0);
      expect(ALLOWED[StatutDossier.REJETE]).toHaveLength(0);
    });
  });

  describe('mapping eventType', () => {
    it('associe chaque cible au bon type d’événement', () => {
      expect(TRANSITION_EVENT_TYPE[StatutDossier.SOUMIS]).toBe('DossierInscriptionSubmitted');
      expect(TRANSITION_EVENT_TYPE[StatutDossier.EN_TRAITEMENT]).toBe(
        'DossierInscriptionProcessing',
      );
      expect(TRANSITION_EVENT_TYPE[StatutDossier.INSCRIT]).toBe('DossierInscriptionRegistered');
      expect(TRANSITION_EVENT_TYPE[StatutDossier.REJETE]).toBe('DossierInscriptionRejected');
    });

    it('BROUILLON n’est jamais une cible (pas d’eventType)', () => {
      expect(TRANSITION_EVENT_TYPE[StatutDossier.BROUILLON]).toBeUndefined();
    });
  });
});
