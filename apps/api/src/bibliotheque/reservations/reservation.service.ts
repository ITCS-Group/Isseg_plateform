import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutReservation } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation.response.dto';

const RESERVATION_SELECT = {
  id: true,
  ouvrageId: true,
  abonneId: true,
  dateReservation: true,
  statut: true,
  createdAt: true,
  updatedAt: true,
  ouvrage: { select: { titre: true } },
} satisfies Prisma.ReservationSelect;

type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Réserve pour l'utilisateur authentifié (résolu en Abonne). */
  async create(dto: CreateReservationDto, utilisateurId: string): Promise<ReservationResponseDto> {
    const ouvrage = await this.prisma.ouvrage.findUnique({ where: { id: dto.ouvrageId } });
    if (!ouvrage) {
      throw new NotFoundException(`Ouvrage introuvable (id: ${dto.ouvrageId})`);
    }
    if (ouvrage.exemplairesDisponibles > 0) {
      throw new ConflictException(
        'Des exemplaires sont disponibles — empruntez directement plutôt que réserver.',
      );
    }

    const abonne = await this.prisma.abonne.findUnique({ where: { utilisateurId } });
    if (!abonne) {
      throw new NotFoundException(
        `Aucun profil abonné pour cet utilisateur (id: ${utilisateurId}).`,
      );
    }

    const existing = await this.prisma.reservation.findFirst({
      where: { ouvrageId: dto.ouvrageId, abonneId: abonne.id, statut: StatutReservation.EN_ATTENTE },
    });
    if (existing) {
      throw new ConflictException('Une réservation en attente existe déjà pour cet ouvrage.');
    }

    const created = await this.prisma.reservation.create({
      data: { ouvrageId: dto.ouvrageId, abonneId: abonne.id },
      select: RESERVATION_SELECT,
    });

    this.logger.log(`Reservation créée (ouvrageId: ${dto.ouvrageId}, abonneId: ${abonne.id})`);
    return this.toDto(created);
  }

  private toDto(row: ReservationRow): ReservationResponseDto {
    return {
      id: row.id,
      ouvrageId: row.ouvrageId,
      ouvrageTitre: row.ouvrage.titre,
      abonneId: row.abonneId,
      dateReservation: row.dateReservation,
      statut: row.statut,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
