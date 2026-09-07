import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { createTestPrisma, truncateAll } from '../../test/prisma-test-client';
import { AuthService } from './auth.service';

/**
 * Vérifie, pour chacun des 11 rôles "auth-only" (documentés dans CLAUDE.md,
 * sans module métier implémenté), qu'un login réel produit un JWT contenant
 * le bon rôle et que getProfile() (utilisé par GET /auth/me) confirme ce
 * même rôle — le côté "authentification opérationnelle" du chantier,
 * indépendamment de toute route métier.
 */
const AUTH_ONLY_ROLES = [
  'SUPER_ADMIN',
  'COMPTABLE',
  'RH',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_INNOVATION',
  'RESPONSABLE_PUBLICATIONS',
  'RESPONSABLE_IT',
  'ETUDIANT',
  'PARENT',
  'BIBLIOTHECAIRE',
  'RESPONSABLE_NUMERISATION',
];

const TEST_PASSWORD = 'ChangeMe123!';
const JWT_TEST_CONFIG = {
  jwt: {
    secret: 'integration-test-access-secret',
    expiresIn: '15m',
    refreshSecret: 'integration-test-refresh-secret',
    refreshExpiresIn: '7d',
  },
};

let prisma: PrismaClient;
let authService: AuthService;
let jwtService: JwtService;

function emailFor(role: string): string {
  return `${role.toLowerCase()}@isseg-test.local`;
}

async function makeUserWithRole(role: string) {
  const roleRow = await prisma.role.upsert({
    where: { nomRole: role },
    update: {},
    create: { nomRole: role },
  });
  const motDePasseHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const user = await prisma.utilisateur.create({
    data: {
      nom: 'Test',
      prenom: role,
      email: emailFor(role),
      motDePasseHash,
      estActif: true,
    },
  });
  await prisma.utilisateurRole.create({
    data: { utilisateurId: user.id, roleId: roleRow.id },
  });
  return user;
}

beforeAll(() => {
  prisma = createTestPrisma(); // garde-fou : refuse si != isseg_test
  jwtService = new JwtService({});
  const configService = new ConfigService(JWT_TEST_CONFIG);
  authService = new AuthService(prisma as never, jwtService, configService);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('AuthService — login() + getProfile() pour les 11 rôles auth-only', () => {
  describe.each(AUTH_ONLY_ROLES)('rôle %s', (role) => {
    it('login réel produit un access token dont le payload JWT contient le bon rôle', async () => {
      await makeUserWithRole(role);

      const tokens = await authService.login({
        email: emailFor(role),
        motDePasse: TEST_PASSWORD,
      });

      expect(typeof tokens.accessToken).toBe('string');

      const decoded = await jwtService.verifyAsync<{ sub: string; roles: string[] }>(
        tokens.accessToken,
        { secret: JWT_TEST_CONFIG.jwt.secret },
      );

      expect(decoded.roles).toEqual([role]);
    });

    it('getProfile() (utilisé par GET /auth/me) retourne le bon rôle', async () => {
      const user = await makeUserWithRole(role);

      const profile = await authService.getProfile(user.id);

      expect(profile.roles).toEqual([role]);
      expect(profile.email).toBe(emailFor(role));
    });
  });
});

/**
 * Non-régression : deux émissions de refresh token pour le même utilisateur
 * dans la même seconde doivent produire deux jetons distincts.
 *
 * Sans `jti`, le payload se réduisait à { sub, type } et seuls `iat`/`exp`
 * variaient, à la seconde près. Deux émissions dans la même seconde donnaient
 * un JWT identique au bit près, donc le même SHA-256, qui violait la contrainte
 * d'unicité sur RefreshToken.tokenHash — l'utilisateur recevait une erreur 500.
 *
 * Ces tests s'exécutent nécessairement en moins d'une seconde : la fenêtre de
 * collision est donc bien celle qu'ils reproduisent, sans temporisation
 * artificielle. Ils s'appuient sur la signature JWT réelle, seul endroit où la
 * collision peut se manifester : un test unitaire à `JwtService` mocké ne
 * prouverait rien.
 */
describe('AuthService — unicité des refresh tokens émis dans la même seconde', () => {
  const ROLE = 'ETUDIANT';

  it('deux login() successifs produisent deux refresh tokens distincts et tous deux exploitables', async () => {
    await makeUserWithRole(ROLE);
    const credentials = { email: emailFor(ROLE), motDePasse: TEST_PASSWORD };

    const premier = await authService.login(credentials);
    const second = await authService.login(credentials);

    // Même seconde : c'est la condition même de l'ancienne collision.
    const iatPremier = (await jwtService.verifyAsync<{ iat: number; jti?: string }>(
      premier.refreshToken,
      { secret: JWT_TEST_CONFIG.jwt.refreshSecret },
    ));
    const iatSecond = await jwtService.verifyAsync<{ iat: number; jti?: string }>(
      second.refreshToken,
      { secret: JWT_TEST_CONFIG.jwt.refreshSecret },
    );
    expect(iatSecond.iat).toBe(iatPremier.iat);

    // Les jetons diffèrent, et c'est bien le jti qui les distingue.
    expect(second.refreshToken).not.toBe(premier.refreshToken);
    expect(iatPremier.jti).toEqual(expect.any(String));
    expect(iatSecond.jti).not.toBe(iatPremier.jti);

    // Deux lignes distinctes en base, aucune violation d'unicité.
    const stockes = await prisma.refreshToken.findMany({ where: { isRevoked: false } });
    expect(stockes).toHaveLength(2);

    // Chacun reste utilisable indépendamment de l'autre.
    await expect(authService.refresh({ refreshToken: premier.refreshToken })).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String) }),
    );
    await expect(authService.refresh({ refreshToken: second.refreshToken })).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String) }),
    );
  });

  it('refresh() immédiatement après login() ne viole plus la contrainte d\'unicité', async () => {
    await makeUserWithRole(ROLE);

    const tokens = await authService.login({
      email: emailFor(ROLE),
      motDePasse: TEST_PASSWORD,
    });

    // C'était le scénario qui produisait une erreur 500 en production.
    const rafraichis = await authService.refresh({ refreshToken: tokens.refreshToken });

    expect(rafraichis.refreshToken).not.toBe(tokens.refreshToken);

    // La rotation reste inchangée : l'ancien jeton est révoqué, le nouveau actif.
    const actifs = await prisma.refreshToken.findMany({ where: { isRevoked: false } });
    expect(actifs).toHaveLength(1);
    const revoques = await prisma.refreshToken.findMany({ where: { isRevoked: true } });
    expect(revoques).toHaveLength(1);

    // Et l'ancien jeton n'est plus rejouable.
    await expect(authService.refresh({ refreshToken: tokens.refreshToken })).rejects.toThrow();
  });

  it('un refresh token sans jti (émis avant le correctif) reste accepté', async () => {
    const user = await makeUserWithRole(ROLE);

    // Jeton à l'ancien format : { sub, type } sans jti.
    const ancienToken = await jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: JWT_TEST_CONFIG.jwt.refreshSecret,
        expiresIn: JWT_TEST_CONFIG.jwt.refreshExpiresIn,
      },
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(ancienToken).digest('hex'),
        utilisateurId: user.id,
        expiresAt,
        isRevoked: false,
      },
    });

    // Les sessions ouvertes avant le déploiement ne doivent pas tomber.
    await expect(authService.refresh({ refreshToken: ancienToken })).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String) }),
    );
  });
});
