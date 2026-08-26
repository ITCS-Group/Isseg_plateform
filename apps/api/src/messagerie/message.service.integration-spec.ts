import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../test/prisma-test-client';
import { MessageService } from './message.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;

async function makeUtilisateur(nom = 'Bah', prenom = 'Mamadou') {
  return prisma.utilisateur.create({
    data: { nom, prenom, email: uid('u') + '@t.local', motDePasseHash: 'x' },
  });
}

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — MessageService (isseg_test)', () => {
  it('create : message à deux destinataires, visible dans leurs boîtes de réception', async () => {
    const service = new MessageService(prisma as never);
    const expediteur = await makeUtilisateur('Bah', 'Mamadou');
    const destA = await makeUtilisateur('Diallo', 'Fatou');
    const destB = await makeUtilisateur('Camara', 'Ibrahim');

    const message = await service.create(
      { destinataireIds: [destA.id, destB.id], contenu: 'Réunion demain 10h' },
      expediteur.id,
    );
    expect(message.destinataires).toHaveLength(2);

    const recusA = await service.findRecus({ page: 1, limit: 20 }, destA.id);
    expect(recusA.data).toHaveLength(1);
    expect(recusA.data[0].contenu).toBe('Réunion demain 10h');

    const envoyes = await service.findEnvoyes({ page: 1, limit: 20 }, expediteur.id);
    expect(envoyes.data).toHaveLength(1);
  });

  it('create : destinataire introuvable → NotFoundException, rien en base', async () => {
    const service = new MessageService(prisma as never);
    const expediteur = await makeUtilisateur();

    await expect(
      service.create({ destinataireIds: ['00000000-0000-0000-0000-000000000000'], contenu: 'x' }, expediteur.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await prisma.messageInterne.count()).toBe(0);
  });

  it('findOne : un tiers ne peut pas lire un message qui ne le concerne pas', async () => {
    const service = new MessageService(prisma as never);
    const expediteur = await makeUtilisateur();
    const destinataire = await makeUtilisateur();
    const tiers = await makeUtilisateur();

    const message = await service.create({ destinataireIds: [destinataire.id], contenu: 'Confidentiel' }, expediteur.id);

    await expect(service.findOne(message.id, tiers.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findOne(message.id, destinataire.id)).resolves.toMatchObject({ id: message.id });
  });
});
