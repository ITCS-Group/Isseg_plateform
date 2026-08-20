import { Injectable } from '@nestjs/common';
import { StatutEmprunt, StatutReservation } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { BibliothequeStatsResponseDto } from './dto/bibliotheque-stats.response.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(): Promise<BibliothequeStatsResponseDto> {
    const [
      totalOuvrages,
      exemplairesAgg,
      empruntsEnCours,
      empruntsEnRetard,
      reservationsEnAttente,
      totalAbonnes,
      totalDocumentsAcademiques,
    ] = await Promise.all([
      this.prisma.ouvrage.count(),
      this.prisma.ouvrage.aggregate({
        _sum: { nombreExemplaires: true, exemplairesDisponibles: true },
      }),
      this.prisma.emprunt.count({ where: { statut: StatutEmprunt.EN_COURS } }),
      this.prisma.emprunt.count({ where: { statut: StatutEmprunt.EN_RETARD } }),
      this.prisma.reservation.count({ where: { statut: StatutReservation.EN_ATTENTE } }),
      this.prisma.abonne.count(),
      this.prisma.documentAcademique.count(),
    ]);

    return {
      totalOuvrages,
      totalExemplaires: exemplairesAgg._sum.nombreExemplaires ?? 0,
      exemplairesDisponibles: exemplairesAgg._sum.exemplairesDisponibles ?? 0,
      empruntsEnCours,
      empruntsEnRetard,
      reservationsEnAttente,
      totalAbonnes,
      totalDocumentsAcademiques,
    };
  }
}
