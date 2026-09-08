import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../auth/auth.service';
import { AuditService } from '../../common/audit/audit.service';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { UsersService } from './users.service';

let prisma: PrismaClient;
let service: UsersService;
let authService: AuthService;

/**
 * Acteur des mutations. Ce doit être un utilisateur RÉELLEMENT présent en base :
 * `AuditLog.utilisateurId` porte une clé étrangère vers `Utilisateur`, donc un
 * identifiant fictif ferait échouer l'écriture d'audit, et avec elle la
 * transaction métier qui la contient.
 */
let acteurId: string;

/**
 * Configuration JWT minimale pour les tests de bout en bout : seules les quatre
 * clés lues par AuthService sont nécessaires. Les secrets sont propres au test
 * et n'ont aucune valeur hors de ce fichier.
 */
const CONFIG_JWT_TEST: Record<string, string> = {
  'jwt.secret': 'secret-access-integration-test',
  'jwt.expiresIn': '15m',
  'jwt.refreshSecret': 'secret-refresh-integration-test',
  'jwt.refreshExpiresIn': '7d',
};

const MOT_DE_PASSE = 'MotDePasse123!';
const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

function utilisateurDto(suffixe: string) {
  return {
    nom: 'Diallo',
    prenom: `Test${suffixe}`,
    email: `user${suffixe}@isseg-test.local`,
    motDePasse: MOT_DE_PASSE,
  };
}

async function creerRole(nomRole: string) {
  return prisma.role.create({ data: { nomRole } });
}

beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  service = new UsersService(prisma as never, new AuditService());

  // AuthService n'est utilisé qu'en LECTURE par ce test : il sert de témoin
  // réel du point de vue de l'attaquant (un refresh token révoqué ne doit
  // plus rendre d'access token).
  const config = {
    get: (key: string) => CONFIG_JWT_TEST[key],
  } as unknown as ConfigService;
  authService = new AuthService(prisma as never, new JwtService({}), config);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);

  // Acteur recréé après chaque purge : il doit exister avant toute mutation.
  const acteur = await prisma.utilisateur.create({
    data: {
      nom: 'Admin',
      prenom: 'Acteur',
      email: 'acteur@isseg-test.local',
      motDePasseHash: 'hash-non-significatif',
      estActif: true,
    },
  });
  acteurId = acteur.id;
});

/** Entrées d'audit métier de la cible, hors journaux d'authentification. */
async function auditsDe(entityId: string) {
  return prisma.auditLog.findMany({
    where: { entity: 'Utilisateur', entityId },
    orderBy: { createdAt: 'asc' },
  });
}

describe('Intégration — UsersService (isseg_test)', () => {
  // ── Création ────────────────────────────────────────────────────────────

  it('create + findOne : persiste l\'utilisateur sans exposer le hash', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    expect(created.estActif).toBe(true);
    expect(created.roles).toEqual([]);
    expect(created).not.toHaveProperty('motDePasseHash');

    const found = await service.findOne(created.id);
    expect(found.email).toBe('user1@isseg-test.local');
  });

  it('create : le mot de passe est réellement haché en base (bcrypt vérifiable)', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    const row = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.motDePasseHash).not.toBe(MOT_DE_PASSE);
    await expect(bcrypt.compare(MOT_DE_PASSE, row.motDePasseHash)).resolves.toBe(true);
  });

  it('create : attribue les rôles passés dans roleIds', async () => {
    const role = await creerRole('SCOLARITE');

    const created = await service.create({ ...utilisateurDto('1'), roleIds: [role.id] }, acteurId);

    expect(created.roles).toEqual([{ id: role.id, nomRole: 'SCOLARITE' }]);
  });

  it('create : e-mail déjà utilisé → ConflictException', async () => {
    await service.create(utilisateurDto('1'), acteurId);

    await expect(service.create(utilisateurDto('1'), acteurId)).rejects.toBeInstanceOf(ConflictException);
    // 2 = l'acteur de la fixture + l'utilisateur créé ; le doublon n'a pas été inséré.
    expect(await prisma.utilisateur.count()).toBe(2);
  });

  it('findOne : identifiant inconnu → NotFoundException', async () => {
    await expect(service.findOne(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Mise à jour ─────────────────────────────────────────────────────────

  it('update : modifie nom et prénom', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    const updated = await service.update(created.id, { nom: 'Barry', prenom: 'Mariama' }, acteurId);

    expect(updated.nom).toBe('Barry');
    expect(updated.prenom).toBe('Mariama');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('update : bascule estActif dans les deux sens', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    const desactive = await service.update(created.id, { estActif: false }, acteurId);
    expect(desactive.estActif).toBe(false);

    const reactive = await service.update(created.id, { estActif: true }, acteurId);
    expect(reactive.estActif).toBe(true);
  });

  it('update : e-mail déjà pris par un autre utilisateur → ConflictException', async () => {
    const premier = await service.create(utilisateurDto('1'), acteurId);
    await service.create(utilisateurDto('2'), acteurId);

    await expect(
      service.update(premier.id, { email: 'user2@isseg-test.local' }, acteurId),
    ).rejects.toBeInstanceOf(ConflictException);

    const inchange = await service.findOne(premier.id);
    expect(inchange.email).toBe('user1@isseg-test.local');
  });

  it('update : réécrire son propre e-mail reste autorisé', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    const updated = await service.update(created.id, { email: 'user1@isseg-test.local' }, acteurId);

    expect(updated.email).toBe('user1@isseg-test.local');
  });

  it('update : identifiant inconnu → NotFoundException', async () => {
    await expect(service.update(UUID_INEXISTANT, { nom: 'X' }, acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── Soft delete ─────────────────────────────────────────────────────────

  it('remove : désactive le compte sans supprimer la ligne', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    await service.remove(created.id, acteurId);

    const row = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.estActif).toBe(false);
    // 2 = l'acteur de la fixture + le compte désactivé ; aucune ligne supprimée.
    expect(await prisma.utilisateur.count()).toBe(2);
  });

  it('remove : identifiant inconnu → NotFoundException', async () => {
    await expect(service.remove(UUID_INEXISTANT, acteurId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove : révoque les refresh tokens actifs du compte désactivé', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    await prisma.refreshToken.create({
      data: {
        tokenHash: 'hash-actif-remove',
        utilisateurId: created.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await service.remove(created.id, acteurId);

    const actifs = await prisma.refreshToken.count({
      where: { utilisateurId: created.id, isRevoked: false },
    });
    expect(actifs).toBe(0);
  });

  // ── Changement de mot de passe ──────────────────────────────────────────

  it('changePassword : remplace le hash et l\'ancien mot de passe ne vaut plus', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    const avant = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });

    await service.changePassword(created.id, { nouveauMotDePasse: 'NouveauPass456!' }, acteurId);

    const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(apres.motDePasseHash).not.toBe(avant.motDePasseHash);
    await expect(bcrypt.compare('NouveauPass456!', apres.motDePasseHash)).resolves.toBe(true);
    await expect(bcrypt.compare(MOT_DE_PASSE, apres.motDePasseHash)).resolves.toBe(false);
  });

  it('changePassword : identifiant inconnu → NotFoundException', async () => {
    await expect(
      service.changePassword(UUID_INEXISTANT, { nouveauMotDePasse: 'NouveauPass456!' }, acteurId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changePassword : révoque les sessions ouvertes', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    await prisma.refreshToken.create({
      data: {
        tokenHash: 'hash-actif-password',
        utilisateurId: created.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await service.changePassword(created.id, { nouveauMotDePasse: 'NouveauPass456!' }, acteurId);

    const actifs = await prisma.refreshToken.count({
      where: { utilisateurId: created.id, isRevoked: false },
    });
    expect(actifs).toBe(0);
  });

  // ── Bout en bout : révocation vue par AuthService.refresh() ─────────────
  //
  // Les deux tests ci-dessus constatent la révocation dans la table. Ceux-ci
  // la constatent du point de vue de l'attaquant : un refresh token émis
  // AVANT l'opération ne doit plus rendre d'access token.

  // Le témoin d'exploitabilité est pris en base (token présent, non révoqué,
  // non expiré) plutôt qu'en appelant `refresh()` avant l'opération : une
  // rotation déclenchée dans la même seconde que le login régénère un JWT
  // identique (payload `{sub, type}` + `iat`/`exp` à la seconde) et bute sur la
  // contrainte d'unicité de `tokenHash`. Comportement propre à AuthService,
  // hors périmètre BACK-07.

  it('remove : un refresh token émis avant la désactivation ne rend plus d\'access token', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    const { refreshToken } = await authService.login({
      email: 'user1@isseg-test.local',
      motDePasse: MOT_DE_PASSE,
    });

    // Témoin : le token est bien exploitable avant l'opération.
    const avant = await prisma.refreshToken.findFirstOrThrow({
      where: { utilisateurId: created.id },
    });
    expect(avant.isRevoked).toBe(false);
    expect(avant.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await service.remove(created.id, acteurId);

    await expect(authService.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const actifs = await prisma.refreshToken.count({
      where: { utilisateurId: created.id, isRevoked: false },
    });
    expect(actifs).toBe(0);
  });

  it('changePassword : un refresh token émis avant le changement ne rend plus d\'access token', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    const { refreshToken } = await authService.login({
      email: 'user1@isseg-test.local',
      motDePasse: MOT_DE_PASSE,
    });

    const avant = await prisma.refreshToken.findFirstOrThrow({
      where: { utilisateurId: created.id },
    });
    expect(avant.isRevoked).toBe(false);
    expect(avant.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await service.changePassword(created.id, { nouveauMotDePasse: 'NouveauPass456!' }, acteurId);

    // Le compte reste actif : seule la révocation peut expliquer le rejet,
    // et non la validation « compte désactivé » de AuthService.refresh().
    const row = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.estActif).toBe(true);

    await expect(authService.refresh({ refreshToken })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // ── Rôles ───────────────────────────────────────────────────────────────

  it('assignRole puis removeRole : cycle complet sur la table de liaison', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    const role = await creerRole('ENSEIGNANT');

    const avecRole = await service.assignRole(created.id, role.id, acteurId);
    expect(avecRole.roles).toEqual([{ id: role.id, nomRole: 'ENSEIGNANT' }]);

    const sansRole = await service.removeRole(created.id, role.id, acteurId);
    expect(sansRole.roles).toEqual([]);
    expect(await prisma.utilisateurRole.count()).toBe(0);
  });

  it('assignRole : deux fois le même rôle reste idempotent', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    const role = await creerRole('ENSEIGNANT');

    await service.assignRole(created.id, role.id, acteurId);
    const deuxieme = await service.assignRole(created.id, role.id, acteurId);

    expect(deuxieme.roles).toHaveLength(1);
    expect(await prisma.utilisateurRole.count()).toBe(1);
  });

  it('assignRole : rôle inexistant → NotFoundException', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);

    await expect(service.assignRole(created.id, UUID_INEXISTANT, acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removeRole : rôle non attribué → NotFoundException', async () => {
    const created = await service.create(utilisateurDto('1'), acteurId);
    const role = await creerRole('ENSEIGNANT');

    await expect(service.removeRole(created.id, role.id, acteurId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── Pagination & filtres ────────────────────────────────────────────────

  it('findAll : pagine réellement et renvoie une meta cohérente', async () => {
    for (let i = 1; i <= 5; i++) {
      await service.create(utilisateurDto(String(i)), acteurId);
    }

    // Filtre sur « Diallo » : l'acteur de la fixture se nomme « Admin », il est
    // donc exclu, et le test reste indépendant des données d'amorçage.
    const page1 = await service.findAll({ page: 1, limit: 2, nom: 'Diallo' });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3 });

    const page3 = await service.findAll({ page: 3, limit: 2, nom: 'Diallo' });
    expect(page3.data).toHaveLength(1);
    expect(page3.meta.total).toBe(5);

    const idsPage1 = page1.data.map((u) => u.id);
    expect(idsPage1).not.toContain(page3.data[0].id);
  });

  it('findAll : page au-delà du dernier résultat renvoie une liste vide', async () => {
    await service.create(utilisateurDto('1'), acteurId);

    const result = await service.findAll({ page: 5, limit: 20, nom: 'Diallo' });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 1, page: 5, limit: 20, totalPages: 1 });
  });

  it('findAll : filtre estActif isole les comptes désactivés', async () => {
    const actif = await service.create(utilisateurDto('1'), acteurId);
    const inactif = await service.create(utilisateurDto('2'), acteurId);
    await service.remove(inactif.id, acteurId);

    const actifs = await service.findAll({ page: 1, limit: 20, estActif: true, nom: 'Diallo' });
    expect(actifs.data.map((u) => u.id)).toEqual([actif.id]);

    const inactifs = await service.findAll({ page: 1, limit: 20, estActif: false, nom: 'Diallo' });
    expect(inactifs.data.map((u) => u.id)).toEqual([inactif.id]);
  });

  it('findAll : filtre roleId ne renvoie que les porteurs du rôle', async () => {
    const role = await creerRole('CHEF_DEPARTEMENT');
    const avecRole = await service.create({ ...utilisateurDto('1'), roleIds: [role.id] }, acteurId);
    await service.create(utilisateurDto('2'), acteurId);

    const result = await service.findAll({ page: 1, limit: 20, roleId: role.id });

    expect(result.meta.total).toBe(1);
    expect(result.data.map((u) => u.id)).toEqual([avecRole.id]);
  });

  it('findAll : filtre nom est insensible à la casse et couvre le prénom', async () => {
    await service.create({ ...utilisateurDto('1'), nom: 'Diallo', prenom: 'Fatoumata' }, acteurId);
    await service.create({ ...utilisateurDto('2'), nom: 'Camara', prenom: 'Ibrahima' }, acteurId);

    const parNom = await service.findAll({ page: 1, limit: 20, nom: 'dial' });
    expect(parNom.meta.total).toBe(1);

    const parPrenom = await service.findAll({ page: 1, limit: 20, nom: 'IBRAHIMA' });
    expect(parPrenom.meta.total).toBe(1);
  });

  // ── Audit métier (BACK-01) — vérifié en base ──────────────────────────────

  describe('audit métier', () => {
    it('create : écrit une entrée CREATE liant acteur et cible réels', async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);

      const audits = await auditsDe(cree.id);
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('CREATE');
      expect(audits[0].entity).toBe('Utilisateur');
      expect(audits[0].entityId).toBe(cree.id);
      // L'acteur est bien l'administrateur, pas le compte créé.
      expect(audits[0].utilisateurId).toBe(acteurId);
      expect(audits[0].utilisateurId).not.toBe(cree.id);
    });

    it("create : le mot de passe n'apparaît nulle part dans l'audit", async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);

      const audits = await auditsDe(cree.id);
      const serialise = JSON.stringify(audits[0].details);
      expect(serialise).not.toContain(MOT_DE_PASSE);
      expect(serialise).not.toContain('$2b$');
    });

    it('changePassword : journalise le fait sans la valeur, et révoque', async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);
      await service.changePassword(cree.id, { nouveauMotDePasse: 'NouveauPass456!' }, acteurId);

      const audits = await auditsDe(cree.id);
      const dernier = audits[audits.length - 1];
      expect(dernier.action).toBe('UPDATE');
      expect(dernier.utilisateurId).toBe(acteurId);
      expect(JSON.stringify(dernier.details)).not.toContain('NouveauPass456!');
    });

    it('remove : écrit une entrée DELETE sur le compte désactivé', async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);
      await service.remove(cree.id, acteurId);

      const audits = await auditsDe(cree.id);
      const dernier = audits[audits.length - 1];
      expect(dernier.action).toBe('DELETE');
      expect(dernier.entityId).toBe(cree.id);
    });

    it('assignRole puis removeRole : deux entrées, CREATE puis DELETE', async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);
      const role = await creerRole('ROLE_AUDIT_TEST');

      await service.assignRole(cree.id, role.id, acteurId);
      await service.removeRole(cree.id, role.id, acteurId);

      const audits = await auditsDe(cree.id);
      const actions = audits.map((a) => a.action);
      expect(actions).toEqual(['CREATE', 'CREATE', 'DELETE']);
      // Le nom du rôle a bien été capturé avant la suppression du lien.
      expect(audits[2].details).toMatchObject({ roleNom: 'ROLE_AUDIT_TEST' });
    });

    it("ATOMICITÉ : un audit impossible annule la mutation métier", async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);

      // Acteur inexistant : la clé étrangère AuditLog.utilisateurId échoue, ce
      // qui doit faire échouer TOUTE la transaction, mutation comprise.
      await expect(
        service.update(cree.id, { nom: 'NeDoitPasPersister' }, UUID_INEXISTANT),
      ).rejects.toBeDefined();

      const apres = await prisma.utilisateur.findUnique({ where: { id: cree.id } });
      expect(apres?.nom).toBe('Diallo');
      const audits = await auditsDe(cree.id);
      expect(audits.map((a) => a.action)).toEqual(['CREATE']);
    });

    it("les journaux d'authentification restent sans entity ni entityId", async () => {
      const cree = await service.create(utilisateurDto('1'), acteurId);
      await authService.login({ email: cree.email, motDePasse: MOT_DE_PASSE });

      const authLogs = await prisma.auditLog.findMany({
        where: { action: 'LOGIN_SUCCESS' },
      });
      expect(authLogs.length).toBeGreaterThan(0);
      for (const log of authLogs) {
        expect(log.entity).toBeNull();
        expect(log.entityId).toBeNull();
      }
    });
  });
});
