import { NotFoundException } from '@nestjs/common';
import { StatutPaiement } from '@prisma/client';
import { RegularityService } from './regularity.service';

interface PrismaMock {
  etudiant: { findUnique: jest.Mock };
}

const MATRICULE = 'ISSEG-2024-0123';

function makeEtudiant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'etu-1',
    matriculeUnique: MATRICULE,
    inscriptions: [
      {
        id: 'insc-1',
        estActive: true,
        frais: {
          montantTotal: 1_000_000,
          montantPaye: 1_000_000,
          statutPaiement: StatutPaiement.PAYE,
          transactions: [{ dateTransaction: new Date('2026-09-01T00:00:00.000Z') }],
        },
      },
    ],
    ...overrides,
  };
}

describe('RegularityService — checkRegularity', () => {
  let service: RegularityService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = { etudiant: { findUnique: jest.fn() } };
    service = new RegularityService(prisma as never);
  });

  it('1 — étudiant introuvable → NotFoundException', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(null);

    await expect(service.checkRegularity(MATRICULE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('2 — aucune inscription active → isRegular false avec motif', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(makeEtudiant({ inscriptions: [] }));

    const result = await service.checkRegularity(MATRICULE);

    expect(result).toEqual({
      isRegular: false,
      reason: 'Aucune inscription active trouvée pour cet étudiant.',
    });
  });

  it('3 — aucun dossier FraisScolarite pour l’inscription active → isRegular false', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(
      makeEtudiant({ inscriptions: [{ id: 'insc-1', estActive: true, frais: null }] }),
    );

    const result = await service.checkRegularity(MATRICULE);

    expect(result.isRegular).toBe(false);
    expect(result.reason).toContain('Aucun dossier de frais');
  });

  it('4 — statutPaiement EN_ATTENTE → isRegular false, motif avec montant restant', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(
      makeEtudiant({
        inscriptions: [
          {
            id: 'insc-1',
            estActive: true,
            frais: {
              montantTotal: 1_000_000,
              montantPaye: 0,
              statutPaiement: StatutPaiement.EN_ATTENTE,
              transactions: [],
            },
          },
        ],
      }),
    );

    const result = await service.checkRegularity(MATRICULE);

    expect(result.isRegular).toBe(false);
    expect(result.reason).toContain('1000000');
    expect(result.reason).toContain('EN_ATTENTE');
  });

  it('5 — statutPaiement PARTIEL → isRegular false, montant restant correct', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(
      makeEtudiant({
        inscriptions: [
          {
            id: 'insc-1',
            estActive: true,
            frais: {
              montantTotal: 1_000_000,
              montantPaye: 400_000,
              statutPaiement: StatutPaiement.PARTIEL,
              transactions: [{ dateTransaction: new Date('2026-09-01T00:00:00.000Z') }],
            },
          },
        ],
      }),
    );

    const result = await service.checkRegularity(MATRICULE);

    expect(result.isRegular).toBe(false);
    expect(result.reason).toContain('600000');
  });

  it('6 — statutPaiement PAYE avec transaction complétée → isRegular true + lastPaymentDate', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(makeEtudiant());

    const result = await service.checkRegularity(MATRICULE);

    expect(result).toEqual({
      isRegular: true,
      lastPaymentDate: new Date('2026-09-01T00:00:00.000Z'),
    });
  });

  it('7 — statutPaiement PAYE sans transaction COMPLETEE trouvée → isRegular true, lastPaymentDate undefined', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(
      makeEtudiant({
        inscriptions: [
          {
            id: 'insc-1',
            estActive: true,
            frais: {
              montantTotal: 1_000_000,
              montantPaye: 1_000_000,
              statutPaiement: StatutPaiement.PAYE,
              transactions: [],
            },
          },
        ],
      }),
    );

    const result = await service.checkRegularity(MATRICULE);

    expect(result.isRegular).toBe(true);
    expect(result.lastPaymentDate).toBeUndefined();
  });

  it('8 — la requête Prisma filtre bien sur estActive et matriculeUnique', async () => {
    prisma.etudiant.findUnique.mockResolvedValue(makeEtudiant());

    await service.checkRegularity(MATRICULE);

    expect(prisma.etudiant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matriculeUnique: MATRICULE } }),
    );
    const call = prisma.etudiant.findUnique.mock.calls[0][0];
    expect(call.include.inscriptions.where).toEqual({ estActive: true });
  });
});
