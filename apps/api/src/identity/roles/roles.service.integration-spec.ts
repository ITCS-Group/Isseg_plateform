import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { AuditService } from '../../common/audit/audit.service';
import { RolesService } from './roles.service';

let prisma: PrismaClient;
let service: RolesService;
/**
 * Acteur des mutations. Il doit exister RÉELLEMENT en base : `AuditLog.utilisateurId`
 * porte une clé étrangère vers `Utilisateur`, donc un identifiant fictif ferait
 * échouer l'audit, et avec lui la transaction métier qui le contient.
 */
let acteurId: string;


const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

/** Pagination par défaut (cf. PaginationDto) — page 1, 20 éléments. */
const PAGE_DEFAUT = { page: 1, limit: 20 };

async function creerPermission(nomPermission: string, description?: string) {
  return prisma.permission.create({ data: { nomPermission, description } });
}

async function creerUtilisateur(email: string) {
  return prisma.utilisateur.create({
    data: {
      nom: 'Test',
      prenom: 'Role',
      email,
      motDePasseHash: await bcrypt.hash('ChangeMe123!', 4),
    },
  });
}

beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new RolesService(prisma as never, new AuditService());
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

describe('Intégration — RolesService (isseg_test)', () => {
  // ── CRUD ────────────────────────────────────────────────────────────────

  it('create + findOne + findAll : cycle de lecture complet', async () => {
    const created = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    expect(created.permissions).toEqual([]);

    const found = await service.findOne(created.id);
    expect(found.nomRole).toBe('SCOLARITE');

    const all = await service.findAll({ ...PAGE_DEFAUT });
    expect(all.data).toHaveLength(1);
    expect(all.data[0].id).toBe(created.id);
    expect(all.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : trie les rôles par nom croissant', async () => {
    await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    await service.create({ nomRole: 'ENSEIGNANT' }, acteurId);
    await service.create({ nomRole: 'DGA_ETUDES' }, acteurId);

    const all = await service.findAll({ ...PAGE_DEFAUT });

    expect(all.data.map((r) => r.nomRole)).toEqual(['DGA_ETUDES', 'ENSEIGNANT', 'SCOLARITE']);
  });

  // ── Pagination (BACK-02-B1) ─────────────────────────────────────────────

  it('findAll : page par défaut, meta cohérent avec le nombre réel de rôles', async () => {
    await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    await service.create({ nomRole: 'ENSEIGNANT' }, acteurId);
    await service.create({ nomRole: 'DGA_ETUDES' }, acteurId);

    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toHaveLength(3);
    expect(result.meta).toEqual({ total: 3, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : dernière page partielle, totalPages arrondi au supérieur', async () => {
    for (const nomRole of ['A_ROLE', 'B_ROLE', 'C_ROLE', 'D_ROLE', 'E_ROLE']) {
      await service.create({ nomRole }, acteurId);
    }

    const page3 = await service.findAll({ page: 3, limit: 2 });

    expect(page3.data).toHaveLength(1);
    expect(page3.data[0].nomRole).toBe('E_ROLE');
    expect(page3.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
  });

  it('findAll : collection vide → data vide et totalPages plancher à 1', async () => {
    const result = await service.findAll({ ...PAGE_DEFAUT });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
  });

  it('findAll : page au-delà du dernier index → data vide, meta.total inchangé', async () => {
    await service.create({ nomRole: 'SCOLARITE' }, acteurId);

    const result = await service.findAll({ page: 5, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 1, page: 5, limit: 20, totalPages: 1 });
  });

  it('create : rattache les permissions passées dans permissionIds', async () => {
    const perm = await creerPermission('READ_PEDAGOGIE', 'Lecture pédagogie');

    const created = await service.create({
      nomRole: 'ENSEIGNANT',
      permissionIds: [perm.id],
    }, acteurId);

    expect(created.permissions).toEqual([
      { id: perm.id, nomPermission: 'READ_PEDAGOGIE', description: 'Lecture pédagogie' },
    ]);
  });

  it('create : nom de rôle déjà existant → ConflictException', async () => {
    await service.create({ nomRole: 'SCOLARITE' }, acteurId);

    await expect(service.create({ nomRole: 'SCOLARITE' }, acteurId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await prisma.role.count()).toBe(1);
  });

  it('findOne : identifiant inconnu → NotFoundException', async () => {
    await expect(service.findOne(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update : renomme le rôle', async () => {
    const created = await service.create({ nomRole: 'SCOLARITE' }, acteurId);

    const updated = await service.update(created.id, { nomRole: 'SCOLARITE_SENIOR' }, acteurId);

    expect(updated.nomRole).toBe('SCOLARITE_SENIOR');
    expect(updated.id).toBe(created.id);
  });

  it('update : nom déjà porté par un autre rôle → ConflictException', async () => {
    const premier = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    await service.create({ nomRole: 'ENSEIGNANT' }, acteurId);

    await expect(
      service.update(premier.id, { nomRole: 'ENSEIGNANT' }, acteurId),
    ).rejects.toBeInstanceOf(ConflictException);

    const inchange = await service.findOne(premier.id);
    expect(inchange.nomRole).toBe('SCOLARITE');
  });

  it('update : identifiant inconnu → NotFoundException', async () => {
    await expect(
      service.update(UUID_INEXISTANT, { nomRole: 'AUTRE' }, acteurId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : supprime définitivement un rôle non attribué', async () => {
    const created = await service.create({ nomRole: 'SCOLARITE' }, acteurId);

    await service.remove(created.id, acteurId);

    expect(await prisma.role.count()).toBe(0);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : rôle encore attribué à un utilisateur → ConflictException', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    const user = await creerUtilisateur('role-lie@isseg-test.local');
    await prisma.utilisateurRole.create({
      data: { utilisateurId: user.id, roleId: role.id },
    });

    await expect(service.remove(role.id, acteurId)).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.role.count()).toBe(1);
  });

  it('remove : redevient possible une fois le rôle retiré du dernier utilisateur', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    const user = await creerUtilisateur('role-lie@isseg-test.local');
    await prisma.utilisateurRole.create({
      data: { utilisateurId: user.id, roleId: role.id },
    });

    await expect(service.remove(role.id, acteurId)).rejects.toBeInstanceOf(ConflictException);

    await prisma.utilisateurRole.delete({
      where: { utilisateurId_roleId: { utilisateurId: user.id, roleId: role.id } },
    });

    await service.remove(role.id, acteurId);
    expect(await prisma.role.count()).toBe(0);
  });

  it('remove : identifiant inconnu → NotFoundException', async () => {
    await expect(service.remove(UUID_INEXISTANT, acteurId)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Permissions ─────────────────────────────────────────────────────────

  it('assignPermission puis removePermission : cycle complet', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    const avec = await service.assignPermission(role.id, perm.id, acteurId);
    expect(avec.permissions.map((p) => p.nomPermission)).toEqual([
      'MANAGE_DOSSIER_INSCRIPTION',
    ]);

    const sans = await service.removePermission(role.id, perm.id, acteurId);
    expect(sans.permissions).toEqual([]);
    expect(await prisma.rolePermission.count()).toBe(0);
  });

  it('assignPermission : deux fois la même permission reste idempotent', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    await service.assignPermission(role.id, perm.id, acteurId);
    const deuxieme = await service.assignPermission(role.id, perm.id, acteurId);

    expect(deuxieme.permissions).toHaveLength(1);
    expect(await prisma.rolePermission.count()).toBe(1);
  });

  it('assignPermission : permission inexistante → NotFoundException', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' }, acteurId);

    await expect(
      service.assignPermission(role.id, UUID_INEXISTANT, acteurId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assignPermission : rôle inexistant → NotFoundException', async () => {
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    await expect(
      service.assignPermission(UUID_INEXISTANT, perm.id, acteurId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removePermission : permission non attribuée au rôle → NotFoundException', async () => {
    const role = await service.create({ nomRole: 'SCOLARITE' }, acteurId);
    const perm = await creerPermission('MANAGE_DOSSIER_INSCRIPTION');

    await expect(service.removePermission(role.id, perm.id, acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── Audit métier (BACK-01, lot 2) — vérifié en base ───────────────────────

  describe('audit métier', () => {
    async function auditsDe(entityId: string) {
      return prisma.auditLog.findMany({
        where: { entity: 'Role', entityId },
        orderBy: { createdAt: 'asc' },
      });
    }

    it('create : entrée CREATE liant acteur réel et rôle créé', async () => {
      const cree = await service.create({ nomRole: 'AUDIT_ROLE_1' }, acteurId);

      const audits = await auditsDe(cree.id);
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('CREATE');
      expect(audits[0].utilisateurId).toBe(acteurId);
      expect(audits[0].details).toMatchObject({ nomRole: 'AUDIT_ROLE_1' });
    });

    it('remove : entrée DELETE conservant le nom du rôle supprimé', async () => {
      const cree = await service.create({ nomRole: 'AUDIT_ROLE_2' }, acteurId);
      await service.remove(cree.id, acteurId);

      const audits = await auditsDe(cree.id);
      const dernier = audits[audits.length - 1];
      expect(dernier.action).toBe('DELETE');
      // Le nom survit à la suppression de la ligne qu'il décrit.
      expect(dernier.details).toMatchObject({ nomRole: 'AUDIT_ROLE_2' });
      expect(await prisma.role.findUnique({ where: { id: cree.id } })).toBeNull();
    });

    it('ATOMICITÉ : un audit impossible annule la mutation métier', async () => {
      const cree = await service.create({ nomRole: 'AUDIT_ROLE_3' }, acteurId);

      // Acteur inexistant : la clé étrangère de AuditLog échoue, donc toute la
      // transaction doit être annulée, renommage compris.
      await expect(
        service.update(cree.id, { nomRole: 'NE_DOIT_PAS_PERSISTER' }, UUID_INEXISTANT),
      ).rejects.toBeDefined();

      const apres = await prisma.role.findUnique({ where: { id: cree.id } });
      expect(apres?.nomRole).toBe('AUDIT_ROLE_3');
      expect((await auditsDe(cree.id)).map((a) => a.action)).toEqual(['CREATE']);
    });
  });
});
