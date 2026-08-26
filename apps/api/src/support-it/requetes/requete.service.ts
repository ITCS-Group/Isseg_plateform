import { ConflictException, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, StatutRequete } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  assertCanHandleRequete,
  assertCanViewRequete,
  buildRequeteScopeFilter,
} from '../common/requete-access.helper';
import { NATURE_SOUS_SERVICE_MAP } from '../common/nature-sous-service.mapping';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { CreateRequeteDto } from './dto/create-requete.dto';
import { ListRequeteQueryDto } from './dto/list-requete-query.dto';
import { PaginatedRequeteResponseDto, RequeteResponseDto } from './dto/requete.response.dto';

const REQUETE_SELECT = {
  id: true,
  demandeurId: true,
  nature: true,
  sousServiceCible: true,
  description: true,
  statut: true,
  dateOuverture: true,
  dateCloture: true,
  createdAt: true,
  updatedAt: true,
  demandeur: { select: { utilisateur: { select: { nom: true, prenom: true } } } },
} satisfies Prisma.RequeteSelect;

type RequeteRow = Prisma.RequeteGetPayload<{ select: typeof REQUETE_SELECT }>;

@Injectable()
export class RequeteService {
  private readonly logger = new Logger(RequeteService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateRequeteDto, utilisateurId: string): Promise<RequeteResponseDto> {
    const personnel = await this.prisma.personnel.findUnique({ where: { userId: utilisateurId } });
    if (!personnel) {
      throw new ForbiddenException(
        "Aucun profil Personnel associé à ce compte — l'ouverture d'une requête Support IT est réservée au personnel.",
      );
    }

    const sousServiceCible = NATURE_SOUS_SERVICE_MAP[dto.nature];

    const created = await this.prisma.requete.create({
      data: {
        demandeurId: personnel.id,
        nature: dto.nature,
        sousServiceCible,
        description: dto.description,
      },
      select: REQUETE_SELECT,
    });

    this.logger.log(`Requête créée (id: ${created.id}, sousService: ${sousServiceCible})`);
    return this.toDto(created);
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: ListRequeteQueryDto, user: AuthenticatedUser): Promise<PaginatedRequeteResponseDto> {
    const scope = await buildRequeteScopeFilter(this.prisma, user);
    const meta: PaginationMetaDto = { total: 0, page: query.page, limit: query.limit, totalPages: 1 };
    if (scope === null) return { data: [], meta };

    const where = { ...scope, statut: query.statut };
    const [rows, total] = await Promise.all([
      this.prisma.requete.findMany({
        where,
        select: REQUETE_SELECT,
        orderBy: { dateOuverture: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.requete.count({ where }),
    ]);

    return {
      data: rows.map(this.toDto),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<RequeteResponseDto> {
    const row = await this.prisma.requete.findUnique({ where: { id }, select: REQUETE_SELECT });
    if (!row) {
      throw new NotFoundException(`Requête introuvable (id: ${id})`);
    }

    await assertCanViewRequete(this.prisma, row, user);
    return this.toDto(row);
  }

  // ── Clôture ───────────────────────────────────────────────────────────────

  async cloturer(id: string, user: AuthenticatedUser): Promise<RequeteResponseDto> {
    const row = await this.prisma.requete.findUnique({ where: { id }, select: REQUETE_SELECT });
    if (!row) {
      throw new NotFoundException(`Requête introuvable (id: ${id})`);
    }
    if (row.statut === StatutRequete.CLOTUREE) {
      throw new ConflictException('Cette requête est déjà clôturée.');
    }

    await assertCanHandleRequete(this.prisma, row, user);

    const updated = await this.prisma.requete.update({
      where: { id },
      data: { statut: StatutRequete.CLOTUREE, dateCloture: new Date() },
      select: REQUETE_SELECT,
    });

    this.logger.log(`Requête clôturée : ${id}`);
    return this.toDto(updated);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private toDto(row: RequeteRow): RequeteResponseDto {
    return {
      id: row.id,
      demandeurId: row.demandeurId,
      demandeurNom: row.demandeur.utilisateur.nom,
      demandeurPrenom: row.demandeur.utilisateur.prenom,
      nature: row.nature,
      sousServiceCible: row.sousServiceCible,
      description: row.description,
      statut: row.statut,
      dateOuverture: row.dateOuverture,
      dateCloture: row.dateCloture,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
