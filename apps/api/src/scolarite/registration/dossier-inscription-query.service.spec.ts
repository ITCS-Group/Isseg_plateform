import { StatutDossier } from '@prisma/client';
import { DossierInscriptionQueryService } from './dossier-inscription-query.service';

interface PrismaMock {
  anneeUniversitaire: { findFirst: jest.Mock };
  dossierInscription: { findMany: jest.Mock; count: jest.Mock };
}

const ACTIVE_ANNEE_ID = 'annee-active-1';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dossier-1',
    statutDossier: StatutDossier.INSCRIT,
    dateSoumission: new Date('2026-09-01T00:00:00.000Z'),
    etudiant: {
      matriculeUnique: 'ISSEG-2026-0042',
      utilisateur: { nom: 'Diallo', prenom: 'Fatoumata' },
    },
    classe: {
      libelle: 'L1-A',
      filiere: { nom: "Sciences de l'Éducation" },
    },
    ...overrides,
  };
}

describe('DossierInscriptionQueryService', () => {
  let service: DossierInscriptionQueryService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      anneeUniversitaire: { findFirst: jest.fn() },
      dossierInscription: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new DossierInscriptionQueryService(prisma as never);
  });

  describe('stats', () => {
    it("aucune année active → effectifInscrit=0, aucune requête count", async () => {
      prisma.anneeUniversitaire.findFirst.mockResolvedValue(null);

      const result = await service.stats();

      expect(result).toEqual({ effectifInscrit: 0 });
      expect(prisma.dossierInscription.count).not.toHaveBeenCalled();
    });

    it("année active trouvée → compte les dossiers INSCRIT scopés à cette année", async () => {
      prisma.anneeUniversitaire.findFirst.mockResolvedValue({ id: ACTIVE_ANNEE_ID });
      prisma.dossierInscription.count.mockResolvedValue(2847);

      const result = await service.stats();

      expect(result).toEqual({ effectifInscrit: 2847 });
      expect(prisma.dossierInscription.count).toHaveBeenCalledWith({
        where: { anneeId: ACTIVE_ANNEE_ID, statutDossier: StatutDossier.INSCRIT },
      });
      expect(prisma.anneeUniversitaire.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estActive: true } }),
      );
    });
  });

  describe('findAll', () => {
    it("aucune année active → page vide, aucune requête findMany/count", async () => {
      prisma.anneeUniversitaire.findFirst.mockResolvedValue(null);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
      expect(prisma.dossierInscription.findMany).not.toHaveBeenCalled();
      expect(prisma.dossierInscription.count).not.toHaveBeenCalled();
    });

    it("scope la requête à l'année active, trie par createdAt desc, calcule skip/take", async () => {
      prisma.anneeUniversitaire.findFirst.mockResolvedValue({ id: ACTIVE_ANNEE_ID });
      prisma.dossierInscription.findMany.mockResolvedValue([makeRow()]);
      prisma.dossierInscription.count.mockResolvedValue(41);

      const result = await service.findAll({ page: 3, limit: 20 });

      expect(prisma.dossierInscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { anneeId: ACTIVE_ANNEE_ID },
          skip: 40,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(prisma.dossierInscription.count).toHaveBeenCalledWith({ where: { anneeId: ACTIVE_ANNEE_ID } });
      expect(result.meta).toEqual({ total: 41, page: 3, limit: 20, totalPages: 3 });
    });

    it("mappe correctement une ligne vers DossierInscriptionListItemDto", async () => {
      prisma.anneeUniversitaire.findFirst.mockResolvedValue({ id: ACTIVE_ANNEE_ID });
      prisma.dossierInscription.findMany.mockResolvedValue([makeRow()]);
      prisma.dossierInscription.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data[0]).toEqual({
        id: 'dossier-1',
        matricule: 'ISSEG-2026-0042',
        etudiantNom: 'Diallo',
        etudiantPrenom: 'Fatoumata',
        filiere: "Sciences de l'Éducation",
        classeLibelle: 'L1-A',
        statutDossier: StatutDossier.INSCRIT,
        dateSoumission: new Date('2026-09-01T00:00:00.000Z'),
      });
    });

    it("matricule null (étudiant sans matricule à vie) → propagé tel quel, pas de crash", async () => {
      prisma.anneeUniversitaire.findFirst.mockResolvedValue({ id: ACTIVE_ANNEE_ID });
      prisma.dossierInscription.findMany.mockResolvedValue([
        makeRow({ statutDossier: StatutDossier.BROUILLON, dateSoumission: null, etudiant: { matriculeUnique: null, utilisateur: { nom: 'Bah', prenom: 'Mamadou' } } }),
      ]);
      prisma.dossierInscription.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data[0].matricule).toBeNull();
      expect(result.data[0].dateSoumission).toBeNull();
    });
  });
});
