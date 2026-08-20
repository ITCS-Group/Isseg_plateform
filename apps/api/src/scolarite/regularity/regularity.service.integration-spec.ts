import { NotFoundException } from '@nestjs/common';
import { PrismaClient, StatutPaiement, StatutTransaction } from '@prisma/client';
import { createTestPrisma, truncateAll } from '../../../test/prisma-test-client';
import { RegularityService } from './regularity.service';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

let prisma: PrismaClient;
let service: RegularityService;

interface FraisOpts {
  montantTotal?: number;
  montantPaye?: number;
  statutPaiement?: StatutPaiement;
}

async function makeEtudiantAvecInscription(fraisOpts?: FraisOpts | null) {
  const matricule = uid('ISSEG-2026');
  const user = await prisma.utilisateur.create({
    data: { nom: 'Etu', prenom: 'Diant', email: uid('etu') + '@t.local', motDePasseHash: 'x' },
  });
  const etudiant = await prisma.etudiant.create({
    data: { userId: user.id, dateNaissance: new Date(Date.UTC(2000, 0, 1)), matriculeUnique: matricule },
  });
  const filiere = await prisma.filiere.create({ data: { code: uid('F'), nom: 'Filiere test' } });
  const classe = await prisma.classe.create({
    data: { codeClasse: uid('C'), libelle: 'Classe test', niveau: 'L1', filiereId: filiere.id },
  });
  const annee = await prisma.anneeUniversitaire.create({
    data: {
      libelle: uid('AU'),
      dateDebut: new Date(Date.UTC(2026, 8, 1)),
      dateFin: new Date(Date.UTC(2027, 5, 1)),
    },
  });
  const inscription = await prisma.inscription.create({
    data: { etudiantId: etudiant.id, classeId: classe.id, anneeId: annee.id, estActive: true },
  });

  if (fraisOpts === null) {
    return { matricule, etudiant, inscription };
  }

  const {
    montantTotal = 1_000_000,
    montantPaye = 1_000_000,
    statutPaiement = StatutPaiement.PAYE,
  } = fraisOpts ?? {};

  const agentUser = await prisma.utilisateur.create({
    data: { nom: 'Agent', prenom: 'Compta', email: uid('agent') + '@t.local', motDePasseHash: 'x' },
  });
  const agent = await prisma.personnel.create({
    data: {
      userId: agentUser.id,
      matricule: uid('PERS'),
      poste: 'Comptable',
      dateEmbauche: new Date(Date.UTC(2020, 0, 1)),
      salaire: 0,
    },
  });
  const frais = await prisma.fraisScolarite.create({
    data: {
      inscriptionId: inscription.id,
      enregistreParId: agent.id,
      anneeId: annee.id,
      montantTotal,
      montantPaye,
      statutPaiement,
    },
  });

  return { matricule, etudiant, inscription, frais };
}

beforeAll(() => {
  prisma = createTestPrisma();
  service = new RegularityService(prisma as never);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

describe('Intégration — RegularityService (isseg_test)', () => {
  it('étudiant introuvable → NotFoundException', async () => {
    await expect(service.checkRegularity('MATRICULE-INEXISTANT')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('étudiant régulier (frais PAYE + transaction COMPLETEE) → isRegular true + lastPaymentDate', async () => {
    const { matricule, frais } = await makeEtudiantAvecInscription({ statutPaiement: StatutPaiement.PAYE });
    const dateTransaction = new Date(Date.UTC(2026, 8, 15));
    await prisma.transaction.create({
      data: {
        fraisId: frais!.id,
        referenceUnique: uid('TX'),
        montant: 1_000_000,
        dateTransaction,
        modePaiement: 'MOBILE_MONEY',
        statut: StatutTransaction.COMPLETEE,
      },
    });
    // Transaction ECHOUEE plus récente : ne doit pas être retenue comme dernier paiement.
    await prisma.transaction.create({
      data: {
        fraisId: frais!.id,
        referenceUnique: uid('TX'),
        montant: 1_000_000,
        dateTransaction: new Date(Date.UTC(2026, 8, 20)),
        modePaiement: 'MOBILE_MONEY',
        statut: StatutTransaction.ECHOUEE,
      },
    });

    const result = await service.checkRegularity(matricule);

    expect(result.isRegular).toBe(true);
    expect(result.lastPaymentDate).toEqual(dateTransaction);
  });

  it('étudiant non régulier (frais PARTIEL) → isRegular false, motif avec montant restant', async () => {
    const { matricule } = await makeEtudiantAvecInscription({
      montantTotal: 1_000_000,
      montantPaye: 300_000,
      statutPaiement: StatutPaiement.PARTIEL,
    });

    const result = await service.checkRegularity(matricule);

    expect(result.isRegular).toBe(false);
    expect(result.reason).toContain('700000');
    expect(result.reason).toContain('PARTIEL');
  });

  it('étudiant sans dossier FraisScolarite → isRegular false', async () => {
    const { matricule } = await makeEtudiantAvecInscription(null);

    const result = await service.checkRegularity(matricule);

    expect(result.isRegular).toBe(false);
    expect(result.reason).toContain('Aucun dossier de frais');
  });

  it('inscription non active ignorée → isRegular false (aucune inscription active)', async () => {
    const { matricule, inscription } = await makeEtudiantAvecInscription({ statutPaiement: StatutPaiement.PAYE });
    await prisma.inscription.update({ where: { id: inscription.id }, data: { estActive: false } });

    const result = await service.checkRegularity(matricule);

    expect(result.isRegular).toBe(false);
    expect(result.reason).toBe('Aucune inscription active trouvée pour cet étudiant.');
  });
});
