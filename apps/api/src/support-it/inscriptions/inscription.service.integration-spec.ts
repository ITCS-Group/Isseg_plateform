import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutInscriptionCoursSupportIT } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { AttestationService } from '../attestations/attestation.service';
import { CoursSupportITService } from '../cours/cours.service';
import { InscriptionCoursSupportITService } from './inscription.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;

async function makeUtilisateur() {
  return prisma.utilisateur.create({
    data: { nom: 'Camara', prenom: 'Aissatou', email: uid('u') + '@t.local', motDePasseHash: 'x' },
  });
}

function toAuthUser(userId: string, roles: string[]): AuthenticatedUser {
  return {
    id: userId,
    email: 'x@t.local',
    nom: 'Test',
    prenom: 'Test',
    estActif: true,
    roles,
    permissions: [],
  };
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

describe('Intégration — InscriptionCoursSupportITService (isseg_test)', () => {
  it('enroll : réussi, puis un second enroll sur le même cours → ConflictException', async () => {
    const coursService = new CoursSupportITService(prisma as never);
    const service = new InscriptionCoursSupportITService(prisma as never, new AttestationService());
    const user = await makeUtilisateur();
    const cours = await coursService.create({
      titre: 'Bureautique niveau 1',
      contenu: 'Word, Excel, PowerPoint',
      niveau: 'Débutant',
      duree: 120,
    });

    const inscription = await service.enroll(cours.id, user.id);
    expect(inscription.coursTitre).toBe('Bureautique niveau 1');

    await expect(service.enroll(cours.id, user.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('enroll : cours introuvable → NotFoundException', async () => {
    const service = new InscriptionCoursSupportITService(prisma as never, new AttestationService());
    const user = await makeUtilisateur();
    await expect(service.enroll('00000000-0000-0000-0000-000000000000', user.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findAll : un participant ne voit que ses propres inscriptions, RESPONSABLE_IT voit tout', async () => {
    const coursService = new CoursSupportITService(prisma as never);
    const service = new InscriptionCoursSupportITService(prisma as never, new AttestationService());
    const userA = await makeUtilisateur();
    const userB = await makeUtilisateur();
    const cours = await coursService.create({
      titre: 'Cybersécurité de base',
      contenu: 'Bonnes pratiques',
      niveau: 'Débutant',
      duree: 60,
    });

    await service.enroll(cours.id, userA.id);
    await service.enroll(cours.id, userB.id);

    const vuParA = await service.findAll(toAuthUser(userA.id, ['ENSEIGNANT']));
    expect(vuParA).toHaveLength(1);

    const vuParResponsable = await service.findAll(toAuthUser(userA.id, ['RESPONSABLE_IT']));
    expect(vuParResponsable).toHaveLength(2);
  });

  it('findOne : un tiers ne peut pas consulter l’inscription d’un autre', async () => {
    const coursService = new CoursSupportITService(prisma as never);
    const service = new InscriptionCoursSupportITService(prisma as never, new AttestationService());
    const userA = await makeUtilisateur();
    const userB = await makeUtilisateur();
    const cours = await coursService.create({
      titre: 'Cybersécurité de base',
      contenu: 'Bonnes pratiques',
      niveau: 'Débutant',
      duree: 60,
    });
    const inscription = await service.enroll(cours.id, userA.id);

    await expect(
      service.findOne(inscription.id, toAuthUser(userB.id, ['ENSEIGNANT'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('evaluer : réussite → note persistée, inscription TERMINE, attestation générée ; double évaluation refusée', async () => {
    const coursService = new CoursSupportITService(prisma as never);
    const service = new InscriptionCoursSupportITService(prisma as never, new AttestationService());
    const user = await makeUtilisateur();
    const cours = await coursService.create({
      titre: 'Bureautique niveau 1',
      contenu: 'Word, Excel, PowerPoint',
      niveau: 'Débutant',
      duree: 120,
    });
    const inscription = await service.enroll(cours.id, user.id);

    const result = await service.evaluer(inscription.id, { note: 17, statutReussite: true });
    expect(result.attestation).toBeDefined();
    expect(result.attestation?.participantNom).toBe('Camara');

    const inscriptionApres = await prisma.inscriptionCoursSupportIT.findUniqueOrThrow({
      where: { id: inscription.id },
    });
    expect(inscriptionApres.statut).toBe(StatutInscriptionCoursSupportIT.TERMINE);

    await expect(service.evaluer(inscription.id, { note: 10, statutReussite: false })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
