import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
