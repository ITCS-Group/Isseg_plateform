import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StatutValidation } from '@prisma/client';
import { NoteEtudiantService } from './note-etudiant.service';

// ── Mock Prisma ───────────────────────────────────────────────────────────────
interface PrismaMock {
  noteEtudiant: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
  epreuve: { findUnique: jest.Mock };
  inscription: { findUnique: jest.Mock };
  enseignant: { findFirst: jest.Mock };
}

const EPREUVE_ID = 'ep-1';
const INSCRIPTION_ID = 'insc-1';
const TEACHER_USER_ID = 'user-teacher-1';
const ADMIN_USER = { id: 'admin-1', roles: ['ADMIN'] };
const TEACHER_USER = { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] };

function makeEpreuveWithChain(
  overrides: { statutValidation?: StatutValidation; enseignantUserId?: string } = {},
) {
  const { statutValidation = StatutValidation.APPROUVE, enseignantUserId = TEACHER_USER_ID } = overrides;
  return {
    id: EPREUVE_ID,
    coursClasseId: 'cc-1',
    type: 'CC',
    createdAt: new Date(),
    updatedAt: new Date(),
    coursClasse: {
      id: 'cc-1',
      coursId: 'cours-1',
      classeId: 'classe-1',
      createdAt: new Date(),
      cours: {
        id: 'cours-1',
        statutValidation,
        enseignant: {
          id: 'ens-1',
          personnelId: 'pers-1',
          personnel: { id: 'pers-1', userId: enseignantUserId },
        },
      },
    },
  };
}

function makeCreatedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    epreuveId: EPREUVE_ID,
    inscriptionId: INSCRIPTION_ID,
    noteBrute: 14.5,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    epreuve: {
      type: 'CC',
      coursClasse: {
        cours: { codeCours: 'SEDU-L3-S1-101', titre: 'Psychologie de l’Éducation' },
        classe: { libelle: 'Licence 3 Section A' },
      },
    },
    inscription: {
      etudiant: {
        matriculeUnique: 'ISSEG-2024-0123',
        utilisateur: { nom: 'DIALLO', prenom: 'Mamadou' },
      },
    },
    ...overrides,
  };
}

function makeDto(overrides: Record<string, unknown> = {}) {
  const base = makeCreatedRow();
  return {
    id: base.id,
    epreuveId: base.epreuveId,
    inscriptionId: base.inscriptionId,
    noteBrute: base.noteBrute,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    epreuveType: base.epreuve.type,
    coursCode: base.epreuve.coursClasse.cours.codeCours,
    coursTitre: base.epreuve.coursClasse.cours.titre,
    classeLibelle: base.epreuve.coursClasse.classe.libelle,
    etudiantNom: base.inscription.etudiant.utilisateur.nom,
    etudiantPrenom: base.inscription.etudiant.utilisateur.prenom,
    etudiantMatricule: base.inscription.etudiant.matriculeUnique,
    ...overrides,
  };
}

describe('NoteEtudiantService — create', () => {
  let service: NoteEtudiantService;
  let prisma: PrismaMock;

  const dto = { epreuveId: EPREUVE_ID, inscriptionId: INSCRIPTION_ID, noteBrute: 14.5 };

  beforeEach(() => {
    prisma = {
      noteEtudiant: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      epreuve: { findUnique: jest.fn() },
      inscription: { findUnique: jest.fn() },
      enseignant: { findFirst: jest.fn() },
    };
    service = new NoteEtudiantService(prisma as never);
  });

  it('1 — création réussie par l’enseignant propriétaire', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(makeEpreuveWithChain());
    prisma.inscription.findUnique.mockResolvedValue({ id: INSCRIPTION_ID });
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);
    prisma.noteEtudiant.create.mockResolvedValue(makeCreatedRow());

    const result = await service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] });

    expect(prisma.noteEtudiant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { epreuveId: EPREUVE_ID, inscriptionId: INSCRIPTION_ID, noteBrute: 14.5 },
      }),
    );
    expect(result.id).toBe('note-1');
    expect(result.noteBrute).toBe(14.5);
  });

  it('2 — Epreuve inexistante → NotFoundException', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(null);

    await expect(
      service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
  });

  it('3 — Inscription inexistante → NotFoundException', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(makeEpreuveWithChain());
    prisma.inscription.findUnique.mockResolvedValue(null);

    await expect(
      service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
  });

  it('4 — note déjà existante → ConflictException', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(makeEpreuveWithChain());
    prisma.inscription.findUnique.mockResolvedValue({ id: INSCRIPTION_ID });
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow());

    await expect(
      service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
  });

  it('5 — cours scénarisé non APPROUVE → ConflictException, aucune écriture', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(
      makeEpreuveWithChain({ statutValidation: StatutValidation.EN_ATTENTE }),
    );
    prisma.inscription.findUnique.mockResolvedValue({ id: INSCRIPTION_ID });
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);

    await expect(
      service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
  });

  it('6 — utilisateur ENSEIGNANT non propriétaire → ForbiddenException, aucune écriture', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(
      makeEpreuveWithChain({ enseignantUserId: 'user-other-teacher' }),
    );
    prisma.inscription.findUnique.mockResolvedValue({ id: INSCRIPTION_ID });
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);

    await expect(
      service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
  });

  it('7 — la chaîne Epreuve → CoursClasse → CoursScenarise → Enseignant → Personnel est bien résolue en une requête', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(makeEpreuveWithChain());
    prisma.inscription.findUnique.mockResolvedValue({ id: INSCRIPTION_ID });
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);
    prisma.noteEtudiant.create.mockResolvedValue(makeCreatedRow());

    await service.create(dto, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] });

    expect(prisma.epreuve.findUnique).toHaveBeenCalledWith({
      where: { id: EPREUVE_ID },
      include: {
        coursClasse: {
          include: {
            cours: {
              include: {
                enseignant: { include: { personnel: true } },
              },
            },
          },
        },
      },
    });
  });

  it('ADMIN contourne la vérification de propriété même sans être le titulaire', async () => {
    prisma.epreuve.findUnique.mockResolvedValue(
      makeEpreuveWithChain({ enseignantUserId: 'user-other-teacher' }),
    );
    prisma.inscription.findUnique.mockResolvedValue({ id: INSCRIPTION_ID });
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);
    prisma.noteEtudiant.create.mockResolvedValue(makeCreatedRow());

    const result = await service.create(dto, { id: 'admin-1', roles: ['ADMIN'] });

    expect(result.id).toBe('note-1');
    expect(prisma.noteEtudiant.create).toHaveBeenCalled();
  });
});

describe('NoteEtudiantService — findAll', () => {
  let service: NoteEtudiantService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      noteEtudiant: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      epreuve: { findUnique: jest.fn() },
      inscription: { findUnique: jest.fn() },
      enseignant: { findFirst: jest.fn() },
    };
    service = new NoteEtudiantService(prisma as never);
  });

  it('1 — ADMIN, liste sans filtre : findMany appelé, résultats enrichis mappés via toDto', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([makeCreatedRow()]);

    const result = await service.findAll({}, ADMIN_USER);

    expect(prisma.noteEtudiant.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(makeDto());
  });

  it('2 — filtre epreuveId : présent tel quel dans le where (ADMIN)', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    await service.findAll({ epreuveId: EPREUVE_ID }, ADMIN_USER);

    expect(prisma.noteEtudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { epreuveId: EPREUVE_ID, inscriptionId: undefined } }),
    );
  });

  it('3 — filtre inscriptionId : présent tel quel dans le where (ADMIN)', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    await service.findAll({ inscriptionId: INSCRIPTION_ID }, ADMIN_USER);

    expect(prisma.noteEtudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { epreuveId: undefined, inscriptionId: INSCRIPTION_ID } }),
    );
  });

  it('4 — filtres combinés : les deux présents simultanément dans le where (ADMIN)', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    await service.findAll({ epreuveId: EPREUVE_ID, inscriptionId: INSCRIPTION_ID }, ADMIN_USER);

    expect(prisma.noteEtudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { epreuveId: EPREUVE_ID, inscriptionId: INSCRIPTION_ID } }),
    );
  });

  it('5 — aucun résultat : liste vide retournée, aucune exception levée', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    const result = await service.findAll({}, ADMIN_USER);

    expect(result).toEqual([]);
  });

  it('6 — Decimal converti en number dans le DTO retourné', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([makeCreatedRow({ noteBrute: 17 })]);

    const result = await service.findAll({}, ADMIN_USER);

    expect(result[0].noteBrute).toBe(17);
    expect(typeof result[0].noteBrute).toBe('number');
  });

  it('7 — requête Prisma structurellement conforme (modèle, select enrichi, orderBy, pas de pagination)', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    await service.findAll({}, ADMIN_USER);

    expect(prisma.noteEtudiant.findMany).toHaveBeenCalledWith({
      where: { epreuveId: undefined, inscriptionId: undefined },
      select: {
        id: true,
        epreuveId: true,
        inscriptionId: true,
        noteBrute: true,
        createdAt: true,
        updatedAt: true,
        epreuve: {
          select: {
            type: true,
            coursClasse: {
              select: {
                cours: { select: { codeCours: true, titre: true } },
                classe: { select: { libelle: true } },
              },
            },
          },
        },
        inscription: {
          select: {
            etudiant: {
              select: {
                matriculeUnique: true,
                utilisateur: { select: { nom: true, prenom: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('8 — ADMIN avec enseignantId fourni : le filtre est transmis tel quel', async () => {
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    await service.findAll({ enseignantId: 'ens-42' }, ADMIN_USER);

    expect(prisma.noteEtudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          epreuve: { coursClasse: { cours: { enseignantId: 'ens-42' } } },
        }),
      }),
    );
  });

  it('9 — ENSEIGNANT : forcé sur son propre id, un enseignantId fourni est ignoré', async () => {
    prisma.enseignant.findFirst.mockResolvedValue({ id: 'ens-self' });
    prisma.noteEtudiant.findMany.mockResolvedValue([]);

    await service.findAll({ enseignantId: 'ens-autre' }, TEACHER_USER);

    expect(prisma.enseignant.findFirst).toHaveBeenCalledWith({
      where: { personnel: { userId: TEACHER_USER.id } },
      select: { id: true },
    });
    expect(prisma.noteEtudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          epreuve: { coursClasse: { cours: { enseignantId: 'ens-self' } } },
        }),
      }),
    );
  });

  it('10 — ENSEIGNANT sans fiche Enseignant liée : liste vide, aucun appel findMany', async () => {
    prisma.enseignant.findFirst.mockResolvedValue(null);

    const result = await service.findAll({}, TEACHER_USER);

    expect(result).toEqual([]);
    expect(prisma.noteEtudiant.findMany).not.toHaveBeenCalled();
  });
});

describe('NoteEtudiantService — findOne', () => {
  let service: NoteEtudiantService;
  let prisma: PrismaMock;

  const NOTE_ID = 'note-1';

  beforeEach(() => {
    prisma = {
      noteEtudiant: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      epreuve: { findUnique: jest.fn() },
      inscription: { findUnique: jest.fn() },
      enseignant: { findFirst: jest.fn() },
    };
    service = new NoteEtudiantService(prisma as never);
  });

  it('1 — récupération réussie : DTO complet enrichi retourné', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    const result = await service.findOne(NOTE_ID);

    expect(result).toEqual(makeDto({ id: NOTE_ID }));
  });

  it('2 — note inexistante → NotFoundException, aucune autre action', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);

    await expect(service.findOne('absent')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
    expect(prisma.noteEtudiant.delete).not.toHaveBeenCalled();
  });

  it('3 — l’UUID reçu est transmis tel quel à Prisma', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.findOne(NOTE_ID);

    expect(prisma.noteEtudiant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NOTE_ID } }),
    );
  });

  it('4 — requête Prisma structurellement conforme (where + select enrichi)', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.findOne(NOTE_ID);

    expect(prisma.noteEtudiant.findUnique).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      select: {
        id: true,
        epreuveId: true,
        inscriptionId: true,
        noteBrute: true,
        createdAt: true,
        updatedAt: true,
        epreuve: {
          select: {
            type: true,
            coursClasse: {
              select: {
                cours: { select: { codeCours: true, titre: true } },
                classe: { select: { libelle: true } },
              },
            },
          },
        },
        inscription: {
          select: {
            etudiant: {
              select: {
                matriculeUnique: true,
                utilisateur: { select: { nom: true, prenom: true } },
              },
            },
          },
        },
      },
    });
  });

  it('5 — Decimal converti en number dans le DTO retourné', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID, noteBrute: 8 }));

    const result = await service.findOne(NOTE_ID);

    expect(result.noteBrute).toBe(8);
    expect(typeof result.noteBrute).toBe('number');
  });

  it('6 — aucune opération d’écriture déclenchée', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.findOne(NOTE_ID);

    expect(prisma.noteEtudiant.create).not.toHaveBeenCalled();
    expect(prisma.noteEtudiant.delete).not.toHaveBeenCalled();
  });
});

// ── update ─────────────────────────────────────────────────────────────────
interface TxMock {
  noteEtudiant: { update: jest.Mock };
  noteEtudiantHistory: { create: jest.Mock };
}
interface PrismaMockTx {
  noteEtudiant: { findUnique: jest.Mock };
  $transaction: jest.Mock;
}

function makeNoteWithChain(
  overrides: { noteBrute?: number; enseignantUserId?: string; id?: string } = {},
) {
  const { noteBrute = 14.5, enseignantUserId = TEACHER_USER_ID, id = 'note-1' } = overrides;
  return {
    id,
    epreuveId: EPREUVE_ID,
    inscriptionId: INSCRIPTION_ID,
    noteBrute,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    epreuve: {
      type: 'CC',
      coursClasse: {
        cours: {
          codeCours: 'SEDU-L3-S1-101',
          titre: 'Psychologie de l’Éducation',
          enseignant: {
            personnel: { userId: enseignantUserId },
          },
        },
        classe: { libelle: 'Licence 3 Section A' },
      },
    },
    inscription: {
      etudiant: {
        matriculeUnique: 'ISSEG-2024-0123',
        utilisateur: { nom: 'DIALLO', prenom: 'Mamadou' },
      },
    },
  };
}

describe('NoteEtudiantService — update', () => {
  let service: NoteEtudiantService;
  let prisma: PrismaMockTx;
  let tx: TxMock;

  beforeEach(() => {
    tx = {
      noteEtudiant: { update: jest.fn() },
      noteEtudiantHistory: { create: jest.fn() },
    };
    prisma = {
      noteEtudiant: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)),
    };
    service = new NoteEtudiantService(prisma as never);
  });

  it('1 — modification réussie par l’enseignant propriétaire', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(
      makeNoteWithChain({ noteBrute: 12 }),
    );
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 15 }));
    tx.noteEtudiantHistory.create.mockResolvedValue({});

    const result = await service.update(
      'note-1',
      { noteBrute: 15, motif: 'Correction' },
      { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] },
    );

    expect(tx.noteEtudiant.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: { noteBrute: 15 },
      select: expect.any(Object),
    });
    expect(tx.noteEtudiantHistory.create).toHaveBeenCalledWith({
      data: {
        noteEtudiantId: 'note-1',
        ancienneValeur: 12,
        nouvelleValeur: 15,
        modifieParId: TEACHER_USER_ID,
        motif: 'Correction',
      },
    });
    expect(result.noteBrute).toBe(15);
  });

  it('2 — note inexistante → NotFoundException, aucune transaction', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);

    await expect(
      service.update('absent', { noteBrute: 10 }, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('3 — enseignant non propriétaire → ForbiddenException, aucune transaction', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(
      makeNoteWithChain({ enseignantUserId: 'user-other-teacher' }),
    );

    await expect(
      service.update('note-1', { noteBrute: 10 }, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('4 — ADMIN contourne la vérification de propriété', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(
      makeNoteWithChain({ noteBrute: 12, enseignantUserId: 'user-other-teacher' }),
    );
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 18 }));
    tx.noteEtudiantHistory.create.mockResolvedValue({});

    const result = await service.update(
      'note-1',
      { noteBrute: 18 },
      { id: 'admin-1', roles: ['ADMIN'] },
    );

    expect(result.noteBrute).toBe(18);
    expect(tx.noteEtudiant.update).toHaveBeenCalled();
  });

  it('5 — DGA_ETUDES contourne la vérification de propriété', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(
      makeNoteWithChain({ noteBrute: 12, enseignantUserId: 'user-other-teacher' }),
    );
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 18 }));
    tx.noteEtudiantHistory.create.mockResolvedValue({});

    const result = await service.update(
      'note-1',
      { noteBrute: 18 },
      { id: 'resp-1', roles: ['DGA_ETUDES'] },
    );

    expect(result.noteBrute).toBe(18);
  });

  it('6 — note inchangée : aucune transaction, retour de la note existante', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeNoteWithChain({ noteBrute: 14.5 }));

    const result = await service.update(
      'note-1',
      { noteBrute: 14.5 },
      { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] },
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.noteBrute).toBe(14.5);
    expect(result.id).toBe('note-1');
  });

  it('7 — motif absent : historique créé avec motif null', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeNoteWithChain({ noteBrute: 12 }));
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 16 }));
    tx.noteEtudiantHistory.create.mockResolvedValue({});

    await service.update('note-1', { noteBrute: 16 }, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] });

    expect(tx.noteEtudiantHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ motif: null }) }),
    );
  });

  it('8 — atomicité : échec de la création d’historique fait échouer toute l’opération, dans la même transaction', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeNoteWithChain({ noteBrute: 12 }));
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 16 }));
    tx.noteEtudiantHistory.create.mockRejectedValue(new Error('échec historique'));

    await expect(
      service.update('note-1', { noteBrute: 16 }, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] }),
    ).rejects.toThrow('échec historique');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.noteEtudiant.update).toHaveBeenCalled();
    expect(tx.noteEtudiantHistory.create).toHaveBeenCalled();
    // Limite du mock : $transaction ici exécute simplement le callback et
    // propage son rejet — il ne simule pas un véritable ROLLBACK PostgreSQL.
    // Ce test vérifie la propagation de l'erreur et que les deux écritures
    // passent par le même appel $transaction (donc le même contexte
    // transactionnel réel en production), pas un rollback effectif en base.
  });

  it('9 — la chaîne de résolution (note + propriété) est chargée en une seule requête', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeNoteWithChain({ noteBrute: 12 }));
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 16 }));
    tx.noteEtudiantHistory.create.mockResolvedValue({});

    await service.update('note-1', { noteBrute: 16 }, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] });

    expect(prisma.noteEtudiant.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.noteEtudiant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'note-1' } }),
    );
  });

  it('10 — epreuveId et inscriptionId ne sont jamais modifiés', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeNoteWithChain({ noteBrute: 12 }));
    tx.noteEtudiant.update.mockResolvedValue(makeCreatedRow({ noteBrute: 16 }));
    tx.noteEtudiantHistory.create.mockResolvedValue({});

    await service.update('note-1', { noteBrute: 16 }, { id: TEACHER_USER_ID, roles: ['ENSEIGNANT'] });

    const dataArg = tx.noteEtudiant.update.mock.calls[0][0].data;
    expect(dataArg).toEqual({ noteBrute: 16 });
    expect(dataArg.epreuveId).toBeUndefined();
    expect(dataArg.inscriptionId).toBeUndefined();
  });
});

// ── remove ─────────────────────────────────────────────────────────────────
interface PrismaMockRemove {
  noteEtudiant: { findUnique: jest.Mock; delete: jest.Mock };
  noteEtudiantHistory: { count: jest.Mock; delete: jest.Mock; deleteMany: jest.Mock };
  $transaction: jest.Mock;
}

describe('NoteEtudiantService — remove', () => {
  let service: NoteEtudiantService;
  let prisma: PrismaMockRemove;

  const NOTE_ID = 'note-1';

  beforeEach(() => {
    prisma = {
      noteEtudiant: { findUnique: jest.fn(), delete: jest.fn() },
      noteEtudiantHistory: { count: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new NoteEtudiantService(prisma as never);
  });

  it('1 — suppression réussie : note existante, aucun historique', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.remove(NOTE_ID);

    expect(prisma.noteEtudiant.delete).toHaveBeenCalledWith({ where: { id: NOTE_ID } });
  });

  it('2 — note inexistante → NotFoundException, aucun count, aucun delete', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(null);

    await expect(service.remove('absent')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.noteEtudiantHistory.count).not.toHaveBeenCalled();
    expect(prisma.noteEtudiant.delete).not.toHaveBeenCalled();
  });

  it('3 — historique existant (1) → ConflictException, aucune suppression', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(1);

    await expect(service.remove(NOTE_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.noteEtudiant.delete).not.toHaveBeenCalled();
  });

  it('4 — plusieurs historiques (3) → ConflictException, aucune suppression', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(3);

    await expect(service.remove(NOTE_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.noteEtudiant.delete).not.toHaveBeenCalled();
  });

  it('5 — aucun historique : suppression exécutée exactement une fois', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.remove(NOTE_ID);

    expect(prisma.noteEtudiant.delete).toHaveBeenCalledTimes(1);
  });

  it('6 — filtre historique exact : { where: { noteEtudiantId: id } }', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.remove(NOTE_ID);

    expect(prisma.noteEtudiantHistory.count).toHaveBeenCalledWith({
      where: { noteEtudiantId: NOTE_ID },
    });
  });

  it('7 — aucune transaction utilisée', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.remove(NOTE_ID);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('8 — UUID transmis sans modification (findUnique puis delete)', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.remove(NOTE_ID);

    expect(prisma.noteEtudiant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NOTE_ID } }),
    );
    expect(prisma.noteEtudiant.delete).toHaveBeenCalledWith({ where: { id: NOTE_ID } });
  });

  it('9 — conflit : delete() jamais appelé (renfort explicite du test 3)', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(1);

    await expect(service.remove(NOTE_ID)).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.noteEtudiant.delete).not.toHaveBeenCalled();
  });

  it('10 — ordre logique find → count → delete', async () => {
    const order: string[] = [];
    prisma.noteEtudiant.findUnique.mockImplementation(async () => {
      order.push('find');
      return makeCreatedRow({ id: NOTE_ID });
    });
    prisma.noteEtudiantHistory.count.mockImplementation(async () => {
      order.push('count');
      return 0;
    });
    prisma.noteEtudiant.delete.mockImplementation(async () => {
      order.push('delete');
      return makeCreatedRow({ id: NOTE_ID });
    });

    await service.remove(NOTE_ID);

    expect(order).toEqual(['find', 'count', 'delete']);
  });

  it('11 — aucune suppression de NoteEtudiantHistory (delete/deleteMany jamais appelés)', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    await service.remove(NOTE_ID);

    expect(prisma.noteEtudiantHistory.delete).not.toHaveBeenCalled();
    expect(prisma.noteEtudiantHistory.deleteMany).not.toHaveBeenCalled();
  });

  it('12 — retour void (aucune valeur métier)', async () => {
    prisma.noteEtudiant.findUnique.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));
    prisma.noteEtudiantHistory.count.mockResolvedValue(0);
    prisma.noteEtudiant.delete.mockResolvedValue(makeCreatedRow({ id: NOTE_ID }));

    const result = await service.remove(NOTE_ID);

    expect(result).toBeUndefined();
  });
});
