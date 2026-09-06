import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutValidation, TypeEpreuve } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { NoteEtudiantService } from './note-etudiant.service';

// ── Utilitaires ──────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: NoteEtudiantService;

/** Cours + classe + affectation + épreuve, avec l'enseignant réellement titulaire. */
async function makeScenario(statutValidation: StatutValidation = StatutValidation.APPROUVE) {
  const teacherUser = await prisma.utilisateur.create({
    data: { nom: 'Ens', prenom: 'Seignant', email: uid('ens') + '@t.local', motDePasseHash: 'x' },
  });
  const personnel = await prisma.personnel.create({
    data: {
      userId: teacherUser.id,
      matricule: uid('MAT'),
      poste: 'Enseignant',
      dateEmbauche: new Date(Date.UTC(2020, 0, 1)),
      salaire: 0,
    },
  });
  const enseignant = await prisma.enseignant.create({
    data: { personnelId: personnel.id, specialite: 'Test', grade: 'A' },
  });
  const cours = await prisma.coursScenarise.create({
    data: {
      enseignantId: enseignant.id,
      titre: 'Cours test',
      codeCours: uid('CRS'),
      description: 'desc',
      objectifsPedagogiques: 'obj',
      statutValidation,
    },
  });
  const filiere = await prisma.filiere.create({ data: { code: uid('F'), nom: 'Filiere test' } });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'Classe test', niveau: 'L1', filiereId: filiere.id },
  });
  const coursClasse = await prisma.coursClasse.create({
    data: { coursId: cours.id, classeId: classe.id },
  });
  const epreuve = await prisma.epreuve.create({
    data: { coursClasseId: coursClasse.id, type: TypeEpreuve.CC },
  });
  return { teacherUserId: teacherUser.id, cours, coursClasse, epreuve };
}

/** Etudiant + Inscription indépendante, pour rattacher une NoteEtudiant. */
async function makeInscription() {
  const studentUser = await prisma.utilisateur.create({
    data: { nom: 'Etu', prenom: 'Diant', email: uid('etu') + '@t.local', motDePasseHash: 'x' },
  });
  const etudiant = await prisma.etudiant.create({
    data: { userId: studentUser.id, dateNaissance: new Date(Date.UTC(2000, 0, 1)) },
  });
  const filiere = await prisma.filiere.create({ data: { code: uid('FI'), nom: 'Filiere insc' } });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('CI'), libelle: 'Classe insc', niveau: 'L1', filiereId: filiere.id },
  });
  const annee = await prisma.anneeUniversitaire.create({
    data: {
      libelle: uid('AU'),
      dateDebut: new Date(Date.UTC(2026, 8, 1)),
      dateFin: new Date(Date.UTC(2027, 5, 1)),
    },
  });
  return prisma.inscription.create({
    data: { etudiantId: etudiant.id, classeId: classe.id, anneeId: annee.id },
  });
}

const ADMIN = { id: 'admin-int', roles: ['ADMIN'] };

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

/**
 * ADMIN réel (ligne Utilisateur existante), requis pour les appels update()
 * car NoteEtudiantHistory.modifieParId porte une FK vers Utilisateur.
 * Le simple objet ADMIN ci-dessus suffit pour create/findAll/findOne (aucune
 * FK vers Utilisateur sur ces chemins).
 */
async function makeAdminUtilisateur() {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Admin', prenom: 'Test', email: uid('admin') + '@t.local', motDePasseHash: 'x' },
  });
  return { id: user.id, roles: ['ADMIN'] };
}

// ── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new NoteEtudiantService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

// ════════════════════════════════════════════════════════════════════════════
describe('Intégration — NoteEtudiantService (isseg_test)', () => {
  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('création nominale : persistée en base avec les bons champs', async () => {
      const { teacherUserId, epreuve } = await makeScenario();
      const inscription = await makeInscription();

      const result = await service.create(
        { epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 14.5 },
        { id: teacherUserId, roles: ['ENSEIGNANT'] },
      );

      expect(result.noteBrute).toBe(14.5);
      const persisted = await prisma.noteEtudiant.findUnique({ where: { id: result.id } });
      expect(persisted).not.toBeNull();
      expect(Number(persisted!.noteBrute)).toBe(14.5);
    });

    it('Epreuve inexistante : 404, aucune écriture', async () => {
      const inscription = await makeInscription();

      await expect(
        service.create(
          { epreuveId: '00000000-0000-4000-8000-000000000000', inscriptionId: inscription.id, noteBrute: 10 },
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await prisma.noteEtudiant.count()).toBe(0);
    });

    it('Inscription inexistante : 404, aucune écriture', async () => {
      const { epreuve } = await makeScenario();

      await expect(
        service.create(
          { epreuveId: epreuve.id, inscriptionId: '00000000-0000-4000-8000-000000000000', noteBrute: 10 },
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(await prisma.noteEtudiant.count()).toBe(0);
    });

    it('cours non APPROUVE : 409, aucune écriture', async () => {
      const { epreuve } = await makeScenario(StatutValidation.EN_ATTENTE);
      const inscription = await makeInscription();

      await expect(
        service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await prisma.noteEtudiant.count()).toBe(0);
    });

    it('doublon (epreuveId + inscriptionId) : 409', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      await service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN);

      await expect(
        service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 11 }, ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('enseignant non titulaire : 403, aucune écriture', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();

      await expect(
        service.create(
          { epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 },
          { id: 'un-autre-enseignant', roles: ['ENSEIGNANT'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await prisma.noteEtudiant.count()).toBe(0);
    });

    it('enseignant titulaire : autorisé', async () => {
      const { teacherUserId, epreuve } = await makeScenario();
      const inscription = await makeInscription();

      const result = await service.create(
        { epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 12 },
        { id: teacherUserId, roles: ['ENSEIGNANT'] },
      );

      expect(result.noteBrute).toBe(12);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('sans filtre, avec filtre epreuveId, avec filtre inscriptionId, combinaison', async () => {
      const s1 = await makeScenario();
      const s2 = await makeScenario();
      const insc1 = await makeInscription();
      const insc2 = await makeInscription();

      const n1 = await service.create({ epreuveId: s1.epreuve.id, inscriptionId: insc1.id, noteBrute: 10 }, ADMIN);
      await service.create({ epreuveId: s1.epreuve.id, inscriptionId: insc2.id, noteBrute: 11 }, ADMIN);
      await service.create({ epreuveId: s2.epreuve.id, inscriptionId: insc1.id, noteBrute: 12 }, ADMIN);

      expect((await service.findAll({ ...PAGE_DEFAUT }, ADMIN)).data).toHaveLength(3);
      expect(
        (await service.findAll({ ...PAGE_DEFAUT, epreuveId: s1.epreuve.id }, ADMIN)).data,
      ).toHaveLength(2);
      expect(
        (await service.findAll({ ...PAGE_DEFAUT, inscriptionId: insc1.id }, ADMIN)).data,
      ).toHaveLength(2);
      const combined = await service.findAll(
        { ...PAGE_DEFAUT, epreuveId: s1.epreuve.id, inscriptionId: insc1.id },
        ADMIN,
      );
      expect(combined.data).toHaveLength(1);
      expect(combined.data[0].id).toBe(n1.id);
      expect(combined.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    // ── Pagination (BACK-02-B1) ─────────────────────────────────────────────

    it('page par défaut : meta cohérent avec le nombre réel d’enregistrements', async () => {
      const s1 = await makeScenario();
      for (let i = 0; i < 3; i++) {
        const insc = await makeInscription();
        await service.create({ epreuveId: s1.epreuve.id, inscriptionId: insc.id, noteBrute: 10 }, ADMIN);
      }

      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
    });

    it('dernière page partielle : totalPages arrondi au supérieur, data tronquée', async () => {
      const s1 = await makeScenario();
      for (let i = 0; i < 5; i++) {
        const insc = await makeInscription();
        await service.create({ epreuveId: s1.epreuve.id, inscriptionId: insc.id, noteBrute: 10 }, ADMIN);
      }

      const page3 = await service.findAll({ page: 3, limit: 2 }, ADMIN);

      expect(page3.data).toHaveLength(1);
      expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
    });

    it('collection vide : data vide et totalPages plancher à 1', async () => {
      const result = await service.findAll({ ...PAGE_DEFAUT }, ADMIN);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagination + filtre : meta.total ne compte que les lignes filtrées', async () => {
      const s1 = await makeScenario();
      const s2 = await makeScenario();
      const insc1 = await makeInscription();
      const insc2 = await makeInscription();
      await service.create({ epreuveId: s1.epreuve.id, inscriptionId: insc1.id, noteBrute: 10 }, ADMIN);
      await service.create({ epreuveId: s1.epreuve.id, inscriptionId: insc2.id, noteBrute: 11 }, ADMIN);
      await service.create({ epreuveId: s2.epreuve.id, inscriptionId: insc1.id, noteBrute: 12 }, ADMIN);

      const result = await service.findAll({ page: 1, limit: 1, epreuveId: s1.epreuve.id }, ADMIN);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 1, totalPages: 2 });
    });

    it('ENSEIGNANT : meta.total est borné par le scoping RBAC, pas par la table entière', async () => {
      const mien = await makeScenario();
      const autre = await makeScenario();
      const insc1 = await makeInscription();
      const insc2 = await makeInscription();
      await service.create({ epreuveId: mien.epreuve.id, inscriptionId: insc1.id, noteBrute: 10 }, ADMIN);
      await service.create({ epreuveId: mien.epreuve.id, inscriptionId: insc2.id, noteBrute: 11 }, ADMIN);
      await service.create({ epreuveId: autre.epreuve.id, inscriptionId: insc1.id, noteBrute: 12 }, ADMIN);

      const result = await service.findAll(
        { page: 1, limit: 1 },
        { id: mien.teacherUserId, roles: ['ENSEIGNANT'] },
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 1, totalPages: 2 });
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('note existante : données conformes', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create(
        { epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 13 },
        ADMIN,
      );

      const result = await service.findOne(created.id);

      expect(result).toMatchObject({ id: created.id, epreuveId: epreuve.id, inscriptionId: inscription.id });
    });

    it('note inexistante : 404', async () => {
      await expect(service.findOne('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('modification réussie par l’enseignant propriétaire : note + historique réellement persistés', async () => {
      const { teacherUserId, epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create(
        { epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 },
        { id: teacherUserId, roles: ['ENSEIGNANT'] },
      );

      const result = await service.update(
        created.id,
        { noteBrute: 16, motif: 'Correction erreur de saisie' },
        { id: teacherUserId, roles: ['ENSEIGNANT'] },
      );

      expect(result.noteBrute).toBe(16);
      const persisted = await prisma.noteEtudiant.findUnique({ where: { id: created.id } });
      expect(Number(persisted!.noteBrute)).toBe(16);

      const history = await prisma.noteEtudiantHistory.findMany({ where: { noteEtudiantId: created.id } });
      expect(history).toHaveLength(1);
      expect(Number(history[0].ancienneValeur)).toBe(10);
      expect(Number(history[0].nouvelleValeur)).toBe(16);
      expect(history[0].modifieParId).toBe(teacherUserId);
      expect(history[0].motif).toBe('Correction erreur de saisie');
    });

    it('note inexistante : 404', async () => {
      await expect(
        service.update('00000000-0000-4000-8000-000000000000', { noteBrute: 10 }, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('enseignant non propriétaire : 403, aucune modification ni historique', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN);

      await expect(
        service.update(created.id, { noteBrute: 18 }, { id: 'un-autre', roles: ['ENSEIGNANT'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const persisted = await prisma.noteEtudiant.findUnique({ where: { id: created.id } });
      expect(Number(persisted!.noteBrute)).toBe(10);
      expect(await prisma.noteEtudiantHistory.count({ where: { noteEtudiantId: created.id } })).toBe(0);
    });

    it('note inchangée : aucun historique créé', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN);

      const result = await service.update(created.id, { noteBrute: 10 }, ADMIN);

      expect(result.noteBrute).toBe(10);
      expect(await prisma.noteEtudiantHistory.count({ where: { noteEtudiantId: created.id } })).toBe(0);
    });

    it('motif absent : historique persisté avec motif null', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN);
      const admin = await makeAdminUtilisateur();

      await service.update(created.id, { noteBrute: 12 }, admin);

      const history = await prisma.noteEtudiantHistory.findMany({ where: { noteEtudiantId: created.id } });
      expect(history[0].motif).toBeNull();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('note inexistante : 404', async () => {
      await expect(service.remove('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('note avec historique : 409, note et historique conservés', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN);
      const admin = await makeAdminUtilisateur();
      await service.update(created.id, { noteBrute: 15 }, admin);

      await expect(service.remove(created.id)).rejects.toBeInstanceOf(ConflictException);

      expect(await prisma.noteEtudiant.findUnique({ where: { id: created.id } })).not.toBeNull();
      expect(await prisma.noteEtudiantHistory.count({ where: { noteEtudiantId: created.id } })).toBe(1);
    });

    it('suppression nominale : note absente en base ensuite', async () => {
      const { epreuve } = await makeScenario();
      const inscription = await makeInscription();
      const created = await service.create({ epreuveId: epreuve.id, inscriptionId: inscription.id, noteBrute: 10 }, ADMIN);

      await service.remove(created.id);

      expect(await prisma.noteEtudiant.findUnique({ where: { id: created.id } })).toBeNull();
    });
  });
});
