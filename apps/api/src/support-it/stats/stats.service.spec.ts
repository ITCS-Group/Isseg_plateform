import { NatureRequete, SousServiceIT, StatutRequete } from '@prisma/client';
import { StatsService } from './stats.service';

interface PrismaMock {
  requete: { groupBy: jest.Mock };
}

describe('StatsService', () => {
  let service: StatsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = { requete: { groupBy: jest.fn() } };
    service = new StatsService(prisma as never);
  });

  it('agrège par sous-service, nature et statut pour le mois demandé', async () => {
    prisma.requete.groupBy
      .mockResolvedValueOnce([
        { sousServiceCible: SousServiceIT.MAINTENANCE, nature: NatureRequete.PANNE_MATERIEL, _count: { _all: 3 } },
        { sousServiceCible: SousServiceIT.CYBER, nature: NatureRequete.INCIDENT_SECURITE, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { sousServiceCible: SousServiceIT.MAINTENANCE, statut: StatutRequete.OUVERTE, _count: { _all: 1 } },
        { sousServiceCible: SousServiceIT.MAINTENANCE, statut: StatutRequete.CLOTUREE, _count: { _all: 2 } },
        { sousServiceCible: SousServiceIT.CYBER, statut: StatutRequete.EN_COURS, _count: { _all: 2 } },
      ]);

    const result = await service.syntheseMensuelle({ mois: '2026-08' });

    expect(result.mois).toBe('2026-08');
    expect(result.parSousService).toHaveLength(3);

    const maintenance = result.parSousService.find((s) => s.sousService === SousServiceIT.MAINTENANCE);
    expect(maintenance?.totalRequetes).toBe(3);
    expect(maintenance?.parNature).toEqual([{ nature: NatureRequete.PANNE_MATERIEL, total: 3 }]);
    expect(maintenance?.parStatut).toEqual([
      { statut: StatutRequete.OUVERTE, total: 1 },
      { statut: StatutRequete.CLOTUREE, total: 2 },
    ]);

    const centreInfo = result.parSousService.find((s) => s.sousService === SousServiceIT.CENTRE_INFORMATIQUE);
    expect(centreInfo?.totalRequetes).toBe(0);
    expect(centreInfo?.parNature).toEqual([]);

    const [{ where: whereNature }] = prisma.requete.groupBy.mock.calls[0];
    expect(whereNature.dateOuverture.gte).toEqual(new Date(Date.UTC(2026, 7, 1)));
    expect(whereNature.dateOuverture.lt).toEqual(new Date(Date.UTC(2026, 8, 1)));
  });

  it('sans paramètre mois → utilise le mois en cours', async () => {
    prisma.requete.groupBy.mockResolvedValue([]);
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const result = await service.syntheseMensuelle({});
    expect(result.mois).toBe(expected);
  });
});
