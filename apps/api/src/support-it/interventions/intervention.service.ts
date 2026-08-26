import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutRequete } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { PrismaService } from '../../database/prisma/prisma.service';
import { assertCanViewRequete } from '../common/requete-access.helper';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { InterventionResponseDto } from './dto/intervention.response.dto';

const INTERVENTION_SELECT = {
  id: true,
  requeteId: true,
  technicienId: true,
  date: true,
  compteRendu: true,
  createdAt: true,
  updatedAt: true,
  technicien: { select: { personnel: { select: { utilisateur: { select: { nom: true, prenom: true } } } } } },
} satisfies Prisma.InterventionSelect;

type InterventionRow = Prisma.InterventionGetPayload<{ select: typeof INTERVENTION_SELECT }>;

@Injectable()
export class InterventionService {
  private readonly logger = new Logger(InterventionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Création ──────────────────────────────────────────────────────────────

  async create(
    requeteId: string,
    dto: CreateInterventionDto,
    utilisateurId: string,
  ): Promise<InterventionResponseDto> {
    const requete = await this.prisma.requete.findUnique({ where: { id: requeteId } });
    if (!requete) {
      throw new NotFoundException(`Requête introuvable (id: ${requeteId})`);
    }
    if (requete.statut === StatutRequete.CLOTUREE) {
      throw new ConflictException('Impossible d’intervenir sur une requête déjà clôturée.');
    }

    const technicien = await this.prisma.technicien.findFirst({
      where: { personnel: { userId: utilisateurId } },
    });
    if (!technicien) {
      throw new ForbiddenException("Aucun profil Technicien associé à ce compte.");
    }
    if (technicien.sousService !== requete.sousServiceCible) {
      throw new ForbiddenException(
        `Cette requête relève du sous-service ${requete.sousServiceCible}, pas de ${technicien.sousService}.`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const intervention = await tx.intervention.create({
        data: { requeteId, technicienId: technicien.id, compteRendu: dto.compteRendu },
        select: INTERVENTION_SELECT,
      });

      if (requete.statut === StatutRequete.OUVERTE) {
        await tx.requete.update({ where: { id: requeteId }, data: { statut: StatutRequete.EN_COURS } });
      }

      return intervention;
    });

    this.logger.log(`Intervention créée (requeteId: ${requeteId}, technicienId: ${technicien.id})`);
    return this.toDto(created);
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAllForRequete(requeteId: string, user: AuthenticatedUser): Promise<InterventionResponseDto[]> {
    const requete = await this.prisma.requete.findUnique({ where: { id: requeteId } });
    if (!requete) {
      throw new NotFoundException(`Requête introuvable (id: ${requeteId})`);
    }

    await assertCanViewRequete(this.prisma, requete, user);

    const rows = await this.prisma.intervention.findMany({
      where: { requeteId },
      select: INTERVENTION_SELECT,
      orderBy: { date: 'desc' },
    });
    return rows.map(this.toDto);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private toDto(row: InterventionRow): InterventionResponseDto {
    return {
      id: row.id,
      requeteId: row.requeteId,
      technicienId: row.technicienId,
      technicienNom: row.technicien.personnel.utilisateur.nom,
      technicienPrenom: row.technicien.personnel.utilisateur.prenom,
      date: row.date,
      compteRendu: row.compteRendu,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
