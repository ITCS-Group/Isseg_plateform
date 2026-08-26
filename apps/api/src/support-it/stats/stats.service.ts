import { Injectable } from '@nestjs/common';
import { SousServiceIT } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListSyntheseQueryDto } from './dto/list-synthese-query.dto';
import { SyntheseMensuelleResponseDto } from './dto/synthese-mensuelle.response.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Synthèse mensuelle du volume/type de requêtes par sous-service —
   * agrégat à la demande (pas un job poussé par email/notification), même
   * pattern que GET /bibliotheque/stats/dashboard.
   */
  async syntheseMensuelle(query: ListSyntheseQueryDto): Promise<SyntheseMensuelleResponseDto> {
    const { debut, fin, moisLabel } = this.resoudreMois(query.mois);

    const [parNatureRows, parStatutRows] = await Promise.all([
      this.prisma.requete.groupBy({
        by: ['sousServiceCible', 'nature'],
        where: { dateOuverture: { gte: debut, lt: fin } },
        _count: { _all: true },
      }),
      this.prisma.requete.groupBy({
        by: ['sousServiceCible', 'statut'],
        where: { dateOuverture: { gte: debut, lt: fin } },
        _count: { _all: true },
      }),
    ]);

    const parSousService = Object.values(SousServiceIT).map((sousService) => {
      const parNature = parNatureRows
        .filter((r) => r.sousServiceCible === sousService)
        .map((r) => ({ nature: r.nature, total: r._count._all }));
      const parStatut = parStatutRows
        .filter((r) => r.sousServiceCible === sousService)
        .map((r) => ({ statut: r.statut, total: r._count._all }));
      const totalRequetes = parNature.reduce((sum, r) => sum + r.total, 0);

      return { sousService, totalRequetes, parNature, parStatut };
    });

    return { mois: moisLabel, parSousService };
  }

  private resoudreMois(mois?: string): { debut: Date; fin: Date; moisLabel: string } {
    let annee: number;
    let moisIndex1: number; // 1-12

    if (mois) {
      const [anneeStr, moisStr] = mois.split('-');
      annee = Number(anneeStr);
      moisIndex1 = Number(moisStr);
    } else {
      const maintenant = new Date();
      annee = maintenant.getUTCFullYear();
      moisIndex1 = maintenant.getUTCMonth() + 1;
    }

    const debut = new Date(Date.UTC(annee, moisIndex1 - 1, 1));
    const fin = new Date(Date.UTC(annee, moisIndex1, 1));
    const moisLabel = `${annee}-${String(moisIndex1).padStart(2, '0')}`;

    return { debut, fin, moisLabel };
  }
}
