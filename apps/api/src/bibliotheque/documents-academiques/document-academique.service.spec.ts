import { NotFoundException } from '@nestjs/common';
import { TypeDocumentAcademique } from '@prisma/client';
import { DocumentAcademiqueService } from './document-academique.service';

interface PrismaMock {
  etudiant: { findUnique: jest.Mock };
  enseignant: { findUnique: jest.Mock };
  documentAcademique: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
}

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

const DOC_ROW = {
  id: 'doc-1',
  type: TypeDocumentAcademique.MEMOIRE_MASTER,
  titre: 'Titre',
  anneeUniversitaire: '2025-2026',
  filiere: 'SEDU',
  niveau: 'M2',
  urlPdf: 'https://x/doc.pdf',
  motsCles: ['education'],
  resume: 'Résumé',
  diffusionAutorisee: true,
  embargoJusqua: null,
  nombreTelechargements: 0,
  nombreVues: 0,
  auteurId: 'etu-1',
  directeurMemoireId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  auteur: { utilisateur: { nom: 'N', prenom: 'P' } },
};

describe('DocumentAcademiqueService', () => {
  let service: DocumentAcademiqueService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-1' }) },
      enseignant: { findUnique: jest.fn().mockResolvedValue({ id: 'ens-1' }) },
      documentAcademique: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(DOC_ROW),
        create: jest.fn().mockResolvedValue(DOC_ROW),
        update: jest.fn().mockResolvedValue(DOC_ROW),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new DocumentAcademiqueService(prisma as never);
  });

  describe('create', () => {
    it('auteur (Etudiant) introuvable → NotFoundException', async () => {
      prisma.etudiant.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          type: TypeDocumentAcademique.THESE,
          titre: 'T',
          anneeUniversitaire: '2025-2026',
          filiere: 'SEDU',
          niveau: 'M2',
          urlPdf: 'x',
          motsCles: ['x'],
          resume: 'r',
          auteurId: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('directeurMemoire (Enseignant) introuvable → NotFoundException', async () => {
      prisma.enseignant.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          type: TypeDocumentAcademique.THESE,
          titre: 'T',
          anneeUniversitaire: '2025-2026',
          filiere: 'SEDU',
          niveau: 'M2',
          urlPdf: 'x',
          motsCles: ['x'],
          resume: 'r',
          auteurId: 'etu-1',
          directeurMemoireId: 'ens-x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll — visibilité', () => {
    it('rôle privilégié (RESPONSABLE_NUMERISATION) : pas de filtre de visibilité, `q` toujours appliqué', async () => {
      await service.findAll({ ...PAGE_DEFAUT, q: 'education' }, { roles: ['RESPONSABLE_NUMERISATION'] });

      const where = prisma.documentAcademique.findMany.mock.calls[0][0].where;
      // 1 seul filtre AND : le `q`, pas de filtre diffusionAutorisee
      expect(where.AND).toHaveLength(1);
      expect(JSON.stringify(where.AND[0])).toContain('education');
    });

    it('rôle non privilégié (ETUDIANT) + `q` : les deux filtres OR coexistent (pas d’écrasement)', async () => {
      await service.findAll({ ...PAGE_DEFAUT, q: 'education' }, { roles: ['ETUDIANT'] });

      const where = prisma.documentAcademique.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
      const serialized = JSON.stringify(where.AND);
      expect(serialized).toContain('education');
      expect(serialized).toContain('diffusionAutorisee');
    });
  });

  // ── findAll — pagination (BACK-02-A) ────────────────────────────────────────
  describe('findAll — pagination', () => {
    const ADMIN = { roles: ['ADMIN'] };

    it('page par défaut : renvoie {data, meta} avec skip=0/take=20', async () => {
      prisma.documentAcademique.findMany.mockResolvedValue([DOC_ROW]);
      prisma.documentAcademique.count.mockResolvedValue(1);

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(prisma.documentAcademique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('count reçoit exactement le même `where` que findMany (total cohérent avec les filtres)', async () => {
      prisma.documentAcademique.findMany.mockResolvedValue([DOC_ROW]);
      prisma.documentAcademique.count.mockResolvedValue(12);

      const result = await service.findAll(
        { ...PAGE_DEFAUT, type: TypeDocumentAcademique.THESE },
        { roles: ['ETUDIANT'] },
      );

      const whereFindMany = prisma.documentAcademique.findMany.mock.calls[0][0].where;
      const whereCount = prisma.documentAcademique.count.mock.calls[0][0].where;
      expect(whereCount).toEqual(whereFindMany);
      expect(result.meta.total).toBe(12);
    });

    it('dernière page partielle : skip/take corrects, totalPages arrondi au supérieur', async () => {
      prisma.documentAcademique.findMany.mockResolvedValue([DOC_ROW]);
      prisma.documentAcademique.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 20 }, ADMIN);

      expect(prisma.documentAcademique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.meta).toEqual({ total: 25, page: 2, limit: 20, totalPages: 2 });
    });

    it('collection vide : totalPages plancher à 1', async () => {
      prisma.documentAcademique.findMany.mockResolvedValue([]);
      prisma.documentAcademique.count.mockResolvedValue(0);

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagination + filtre `q`, filtre de visibilité toujours appliqué pour un non privilégié', async () => {
      prisma.documentAcademique.findMany.mockResolvedValue([DOC_ROW]);
      prisma.documentAcademique.count.mockResolvedValue(3);

      const result = await service.findAll(
        { page: 2, limit: 2, q: 'education' },
        { roles: ['ETUDIANT'] },
      );

      const call = prisma.documentAcademique.findMany.mock.calls[0][0];
      expect(call.skip).toBe(2);
      expect(call.take).toBe(2);
      expect(call.where.AND).toHaveLength(2); // `q` + visibilité
      expect(result.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
    });
  });

  describe('findOne — visibilité', () => {
    it('non privilégié + document non diffusé → NotFoundException (masqué)', async () => {
      prisma.documentAcademique.findUnique.mockResolvedValue({ ...DOC_ROW, diffusionAutorisee: false });
      await expect(service.findOne('doc-1', { roles: ['ETUDIANT'] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('non privilégié + sous embargo futur → NotFoundException (masqué)', async () => {
      const futur = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.documentAcademique.findUnique.mockResolvedValue({ ...DOC_ROW, embargoJusqua: futur });
      await expect(service.findOne('doc-1', { roles: ['ETUDIANT'] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('non privilégié + diffusé + embargo passé → visible', async () => {
      const passe = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.documentAcademique.findUnique.mockResolvedValue({ ...DOC_ROW, embargoJusqua: passe });
      const result = await service.findOne('doc-1', { roles: ['ETUDIANT'] });
      expect(result.id).toBe('doc-1');
    });

    it('privilégié (ADMIN) voit un document non diffusé', async () => {
      prisma.documentAcademique.findUnique.mockResolvedValue({ ...DOC_ROW, diffusionAutorisee: false });
      const result = await service.findOne('doc-1', { roles: ['ADMIN'] });
      expect(result.id).toBe('doc-1');
    });
  });
});
