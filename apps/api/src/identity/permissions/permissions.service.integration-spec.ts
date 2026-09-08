import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { AuditService } from '../../common/audit/audit.service';
import { PermissionsService } from './permissions.service';

let prisma: PrismaClient;
let service: PermissionsService;
/**
 * Acteur des mutations. Il doit exister RÉELLEMENT en base : `AuditLog.utilisateurId`
 * porte une clé étrangère vers `Utilisateur`, donc un identifiant fictif ferait
 * échouer l'audit, et avec lui la transaction métier qui le contient.
 */
let acteurId: string;


const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

async function creerRole(nomRole: string) {
  return prisma.role.create({ data: { nomRole } });
}

beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new PermissionsService(prisma as never, new AuditService());
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);

  const acteur = await prisma.utilisateur.create({
    data: {
      nom: 'Admin',
      prenom: 'Acteur',
      email: 'acteur-audit@isseg-test.local',
      motDePasseHash: 'hash-non-significatif',
      estActif: true,
    },
  });
  acteurId = acteur.id;
});

describe('Intégration — PermissionsService (isseg_test)', () => {
  // ── CRUD ────────────────────────────────────────────────────────────────

  it('create + findOne + findAll : cycle de lecture complet', async () => {
    const created = await service.create({
      nomPermission: 'READ_PEDAGOGIE',
      description: 'Lecture des données pédagogiques',
    }, acteurId);
    expect(created.description).toBe('Lecture des données pédagogiques');

    const found = await service.findOne(created.id);
    expect(found.nomPermission).toBe('READ_PEDAGOGIE');

    const all = await service.findAll({ ...PAGE_DEFAUT });
    expect(all.data).toHaveLength(1);
    expect(all.data[0].id).toBe(created.id);
    expect(all.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('create : la description est optionnelle et vaut null par défaut', async () => {
    const created = await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);

    expect(created.description).toBeNull();
  });

  it('findAll : trie les permissions par nom croissant', async () => {
    await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);
    await service.create({ nomPermission: 'MANAGE_PEDAGOGIE' }, acteurId);
    await service.create({ nomPermission: 'MANAGE_DOSSIER_INSCRIPTION' }, acteurId);

    const all = await service.findAll({ ...PAGE_DEFAUT });

    expect(all.data.map((p) => p.nomPermission)).toEqual([
      'MANAGE_DOSSIER_INSCRIPTION',
      'MANAGE_PEDAGOGIE',
      'READ_PEDAGOGIE',
    ]);
  });

  // ── Pagination (BACK-02-B1) ─────────────────────────────────────────────

  it('findAll : page par défaut, meta cohérent avec le nombre réel de permissions', async () => {
    await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);
    await service.create({ nomPermission: 'MANAGE_PEDAGOGIE' }, acteurId);
    await service.create({ nomPermission: 'MANAGE_DOSSIER_INSCRIPTION' }, acteurId);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toHaveLength(3);
    expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : dernière page partielle, totalPages arrondi au supérieur', async () => {
    for (const nomPermission of ['A_PERM', 'B_PERM', 'C_PERM', 'D_PERM', 'E_PERM']) {
      await service.create({ nomPermission }, acteurId);
    }

    const page3 = await service.findAll({ page: 3, limit: 2 });

    expect(page3.data).toHaveLength(1);
    expect(page3.data[0].nomPermission).toBe('E_PERM');
    expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
  });

  it('findAll : collection vide → data vide et totalPages plancher à 1', async () => {
    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : page au-delà du dernier index → data vide, meta.total inchangé', async () => {
    await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);

    const result = await service.findAll({ page: 5, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 1, page: 5, limit: 20, totalPages: 1 });
  });

  it('create : nom de permission déjà existant → ConflictException', async () => {
    await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);

    await expect(service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await prisma.permission.count()).toBe(1);
  });

  it('findOne : identifiant inconnu → NotFoundException', async () => {
    await expect(service.findOne(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update : modifie la description seule', async () => {
    const created = await service.create({
      nomPermission: 'READ_PEDAGOGIE',
      description: 'Ancienne',
    }, acteurId);

    const updated = await service.update(created.id, { description: 'Nouvelle' }, acteurId);

    expect(updated.description).toBe('Nouvelle');
    expect(updated.nomPermission).toBe('READ_PEDAGOGIE');
  });

  it('update : renomme la permission', async () => {
    const created = await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);

    const updated = await service.update(created.id, { nomPermission: 'MANAGE_PEDAGOGIE' }, acteurId);

    expect(updated.nomPermission).toBe('MANAGE_PEDAGOGIE');
    expect(updated.id).toBe(created.id);
  });

  it('update : nom déjà porté par une autre permission → ConflictException', async () => {
    const premiere = await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);
    await service.create({ nomPermission: 'MANAGE_PEDAGOGIE' }, acteurId);

    await expect(
      service.update(premiere.id, { nomPermission: 'MANAGE_PEDAGOGIE' }, acteurId),
    ).rejects.toBeInstanceOf(ConflictException);

    const inchangee = await service.findOne(premiere.id);
    expect(inchangee.nomPermission).toBe('READ_PEDAGOGIE');
  });

  it('update : identifiant inconnu → NotFoundException', async () => {
    await expect(
      service.update(UUID_INEXISTANT, { description: 'x' }, acteurId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : supprime définitivement une permission non rattachée', async () => {
    const created = await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);

    await service.remove(created.id, acteurId);

    expect(await prisma.permission.count()).toBe(0);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : permission encore rattachée à un rôle → ConflictException', async () => {
    const perm = await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);
    const role = await creerRole('ENSEIGNANT');
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });

    await expect(service.remove(perm.id, acteurId)).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.permission.count()).toBe(1);
  });

  it('remove : redevient possible une fois la permission détachée du dernier rôle', async () => {
    const perm = await service.create({ nomPermission: 'READ_PEDAGOGIE' }, acteurId);
    const role = await creerRole('ENSEIGNANT');
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });

    await expect(service.remove(perm.id, acteurId)).rejects.toBeInstanceOf(ConflictException);

    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    });

    await service.remove(perm.id, acteurId);
    expect(await prisma.permission.count()).toBe(0);
  });

  it('remove : identifiant inconnu → NotFoundException', async () => {
    await expect(service.remove(UUID_INEXISTANT, acteurId)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Audit métier (BACK-01, lot 2) — vérifié en base ───────────────────────

  describe('audit métier', () => {
    async function auditsDe(entityId: string) {
      return prisma.auditLog.findMany({
        where: { entity: 'Permission', entityId },
        orderBy: { createdAt: 'asc' },
      });
    }

    it('create : entrée CREATE liant acteur réel et permission créée', async () => {
      const cree = await service.create({ nomPermission: 'AUDIT_PERM_1' }, acteurId);

      const audits = await auditsDe(cree.id);
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('CREATE');
      expect(audits[0].utilisateurId).toBe(acteurId);
    });

    it('remove : entrée DELETE conservant le nom supprimé', async () => {
      const cree = await service.create({ nomPermission: 'AUDIT_PERM_2' }, acteurId);
      await service.remove(cree.id, acteurId);

      const dernier = (await auditsDe(cree.id)).slice(-1)[0];
      expect(dernier.action).toBe('DELETE');
      expect(dernier.details).toMatchObject({ nomPermission: 'AUDIT_PERM_2' });
    });

    it('ATOMICITÉ : un audit impossible annule la mutation métier', async () => {
      const cree = await service.create({ nomPermission: 'AUDIT_PERM_3' }, acteurId);

      await expect(
        service.update(cree.id, { nomPermission: 'NE_DOIT_PAS_PERSISTER' }, UUID_INEXISTANT),
      ).rejects.toBeDefined();

      const apres = await prisma.permission.findUnique({ where: { id: cree.id } });
      expect(apres?.nomPermission).toBe('AUDIT_PERM_3');
    });
  });
});
