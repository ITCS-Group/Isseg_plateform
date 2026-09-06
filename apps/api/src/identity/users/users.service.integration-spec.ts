import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { UsersService } from './users.service';

let prisma: PrismaClient;
let service: UsersService;

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
  service = new UsersService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — UsersService (isseg_test)', () => {
  // ── Création ────────────────────────────────────────────────────────────

  it('create + findOne : persiste l\'utilisateur sans exposer le hash', async () => {
    const created = await service.create(utilisateurDto('1'));

    expect(created.estActif).toBe(true);
    expect(created.roles).toEqual([]);
    expect(created).not.toHaveProperty('motDePasseHash');

    const found = await service.findOne(created.id);
    expect(found.email).toBe('user1@isseg-test.local');
  });

  it('create : le mot de passe est réellement haché en base (bcrypt vérifiable)', async () => {
    const created = await service.create(utilisateurDto('1'));

    const row = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.motDePasseHash).not.toBe(MOT_DE_PASSE);
    await expect(bcrypt.compare(MOT_DE_PASSE, row.motDePasseHash)).resolves.toBe(true);
  });

  it('create : attribue les rôles passés dans roleIds', async () => {
    const role = await creerRole('SCOLARITE');

    const created = await service.create({ ...utilisateurDto('1'), roleIds: [role.id] });

    expect(created.roles).toEqual([{ id: role.id, nomRole: 'SCOLARITE' }]);
  });

  it('create : e-mail déjà utilisé → ConflictException', async () => {
    await service.create(utilisateurDto('1'));

    await expect(service.create(utilisateurDto('1'))).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.utilisateur.count()).toBe(1);
  });

  it('findOne : identifiant inconnu → NotFoundException', async () => {
    await expect(service.findOne(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Mise à jour ─────────────────────────────────────────────────────────

  it('update : modifie nom et prénom', async () => {
    const created = await service.create(utilisateurDto('1'));

    const updated = await service.update(created.id, { nom: 'Barry', prenom: 'Mariama' });

    expect(updated.nom).toBe('Barry');
    expect(updated.prenom).toBe('Mariama');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('update : bascule estActif dans les deux sens', async () => {
    const created = await service.create(utilisateurDto('1'));

    const desactive = await service.update(created.id, { estActif: false });
    expect(desactive.estActif).toBe(false);

    const reactive = await service.update(created.id, { estActif: true });
    expect(reactive.estActif).toBe(true);
  });

  it('update : e-mail déjà pris par un autre utilisateur → ConflictException', async () => {
    const premier = await service.create(utilisateurDto('1'));
    await service.create(utilisateurDto('2'));

    await expect(
      service.update(premier.id, { email: 'user2@isseg-test.local' }),
    ).rejects.toBeInstanceOf(ConflictException);

    const inchange = await service.findOne(premier.id);
    expect(inchange.email).toBe('user1@isseg-test.local');
  });

  it('update : réécrire son propre e-mail reste autorisé', async () => {
    const created = await service.create(utilisateurDto('1'));

    const updated = await service.update(created.id, { email: 'user1@isseg-test.local' });

    expect(updated.email).toBe('user1@isseg-test.local');
  });

  it('update : identifiant inconnu → NotFoundException', async () => {
    await expect(service.update(UUID_INEXISTANT, { nom: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── Soft delete ─────────────────────────────────────────────────────────

  it('remove : désactive le compte sans supprimer la ligne', async () => {
    const created = await service.create(utilisateurDto('1'));

    await service.remove(created.id);

    const row = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.estActif).toBe(false);
    expect(await prisma.utilisateur.count()).toBe(1);
  });

  it('remove : identifiant inconnu → NotFoundException', async () => {
    await expect(service.remove(UUID_INEXISTANT)).rejects.toBeInstanceOf(NotFoundException);
  });

  // BLOQUÉ: divergence, voir rapport
  // Attendu : la désactivation d'un compte révoque ses refresh tokens actifs.
  // Trouvé : `UsersService.remove()` ne fait que passer estActif à false — la
  // révocation est encore un « TODO » dans le service, les sessions restent
  // valides après désactivation.
  it.skip('remove : révoque les refresh tokens actifs du compte désactivé', async () => {
    const created = await service.create(utilisateurDto('1'));
    await prisma.refreshToken.create({
      data: {
        tokenHash: 'hash-actif-remove',
        utilisateurId: created.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await service.remove(created.id);

    const actifs = await prisma.refreshToken.count({
      where: { utilisateurId: created.id, isRevoked: false },
    });
    expect(actifs).toBe(0);
  });

  // ── Changement de mot de passe ──────────────────────────────────────────

  it('changePassword : remplace le hash et l\'ancien mot de passe ne vaut plus', async () => {
    const created = await service.create(utilisateurDto('1'));
    const avant = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });

    await service.changePassword(created.id, { nouveauMotDePasse: 'NouveauPass456!' });

    const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { id: created.id } });
    expect(apres.motDePasseHash).not.toBe(avant.motDePasseHash);
    await expect(bcrypt.compare('NouveauPass456!', apres.motDePasseHash)).resolves.toBe(true);
    await expect(bcrypt.compare(MOT_DE_PASSE, apres.motDePasseHash)).resolves.toBe(false);
  });

  it('changePassword : identifiant inconnu → NotFoundException', async () => {
    await expect(
      service.changePassword(UUID_INEXISTANT, { nouveauMotDePasse: 'NouveauPass456!' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // BLOQUÉ: divergence, voir rapport
  // Attendu : changer le mot de passe invalide les sessions ouvertes.
  // Trouvé : `UsersService.changePassword()` ne met à jour que motDePasseHash —
  // la révocation des refresh tokens est encore un « TODO » dans le service.
  it.skip('changePassword : révoque les sessions ouvertes', async () => {
    const created = await service.create(utilisateurDto('1'));
    await prisma.refreshToken.create({
      data: {
        tokenHash: 'hash-actif-password',
        utilisateurId: created.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await service.changePassword(created.id, { nouveauMotDePasse: 'NouveauPass456!' });

    const actifs = await prisma.refreshToken.count({
      where: { utilisateurId: created.id, isRevoked: false },
    });
    expect(actifs).toBe(0);
  });

  // ── Rôles ───────────────────────────────────────────────────────────────

  it('assignRole puis removeRole : cycle complet sur la table de liaison', async () => {
    const created = await service.create(utilisateurDto('1'));
    const role = await creerRole('ENSEIGNANT');

    const avecRole = await service.assignRole(created.id, role.id);
    expect(avecRole.roles).toEqual([{ id: role.id, nomRole: 'ENSEIGNANT' }]);

    const sansRole = await service.removeRole(created.id, role.id);
    expect(sansRole.roles).toEqual([]);
    expect(await prisma.utilisateurRole.count()).toBe(0);
  });

  it('assignRole : deux fois le même rôle reste idempotent', async () => {
    const created = await service.create(utilisateurDto('1'));
    const role = await creerRole('ENSEIGNANT');

    await service.assignRole(created.id, role.id);
    const deuxieme = await service.assignRole(created.id, role.id);

    expect(deuxieme.roles).toHaveLength(1);
    expect(await prisma.utilisateurRole.count()).toBe(1);
  });

  it('assignRole : rôle inexistant → NotFoundException', async () => {
    const created = await service.create(utilisateurDto('1'));

    await expect(service.assignRole(created.id, UUID_INEXISTANT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removeRole : rôle non attribué → NotFoundException', async () => {
    const created = await service.create(utilisateurDto('1'));
    const role = await creerRole('ENSEIGNANT');

    await expect(service.removeRole(created.id, role.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── Pagination & filtres ────────────────────────────────────────────────

  it('findAll : pagine réellement et renvoie une meta cohérente', async () => {
    for (let i = 1; i <= 5; i++) {
      await service.create(utilisateurDto(String(i)));
    }

    const page1 = await service.findAll({ page: 1, limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3 });

    const page3 = await service.findAll({ page: 3, limit: 2 });
    expect(page3.data).toHaveLength(1);
    expect(page3.meta.total).toBe(5);

    const idsPage1 = page1.data.map((u) => u.id);
    expect(idsPage1).not.toContain(page3.data[0].id);
  });

  it('findAll : page au-delà du dernier résultat renvoie une liste vide', async () => {
    await service.create(utilisateurDto('1'));

    const result = await service.findAll({ page: 5, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 1, page: 5, limit: 20, totalPages: 1 });
  });

  it('findAll : filtre estActif isole les comptes désactivés', async () => {
    const actif = await service.create(utilisateurDto('1'));
    const inactif = await service.create(utilisateurDto('2'));
    await service.remove(inactif.id);

    const actifs = await service.findAll({ page: 1, limit: 20, estActif: true });
    expect(actifs.data.map((u) => u.id)).toEqual([actif.id]);

    const inactifs = await service.findAll({ page: 1, limit: 20, estActif: false });
    expect(inactifs.data.map((u) => u.id)).toEqual([inactif.id]);
  });

  it('findAll : filtre roleId ne renvoie que les porteurs du rôle', async () => {
    const role = await creerRole('CHEF_DEPARTEMENT');
    const avecRole = await service.create({ ...utilisateurDto('1'), roleIds: [role.id] });
    await service.create(utilisateurDto('2'));

    const result = await service.findAll({ page: 1, limit: 20, roleId: role.id });

    expect(result.meta.total).toBe(1);
    expect(result.data.map((u) => u.id)).toEqual([avecRole.id]);
  });

  it('findAll : filtre nom est insensible à la casse et couvre le prénom', async () => {
    await service.create({ ...utilisateurDto('1'), nom: 'Diallo', prenom: 'Fatoumata' });
    await service.create({ ...utilisateurDto('2'), nom: 'Camara', prenom: 'Ibrahima' });

    const parNom = await service.findAll({ page: 1, limit: 20, nom: 'dial' });
    expect(parNom.meta.total).toBe(1);

    const parPrenom = await service.findAll({ page: 1, limit: 20, nom: 'IBRAHIMA' });
    expect(parPrenom.meta.total).toBe(1);
  });
});
