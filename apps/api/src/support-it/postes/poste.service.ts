import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StatutPoste } from '@prisma/client';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePosteDto } from './dto/create-poste.dto';
import { DisponibilitePosteDto, PaginatedPosteResponseDto, PosteResponseDto } from './dto/poste.response.dto';
import { ListPosteQueryDto } from './dto/list-poste-query.dto';
import { UpdatePosteStatutDto } from './dto/update-poste-statut.dto';

@Injectable()
export class PosteService {
  private readonly logger = new Logger(PosteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePosteDto, actorId: string): Promise<PosteResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const poste = await tx.poste.create({ data: { salle: dto.salle } });

      await this.audit.record(tx, {
        action: 'CREATE',
        entity: 'Poste',
        entityId: poste.id,
        actorId,
        details: { salle: poste.salle, statut: poste.statut },
      });

      return poste;
    });

    this.logger.log(`Poste créé : ${created.id} (salle: ${created.salle})`);
    return created;
  }

  async findAll(query: ListPosteQueryDto): Promise<PaginatedPosteResponseDto> {
    const where = { salle: query.salle, statut: query.statut };
    const [data, total] = await Promise.all([
      this.prisma.poste.findMany({
        where,
        orderBy: [{ salle: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.poste.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data, meta };
  }

  async findOne(id: string): Promise<PosteResponseDto> {
    const row = await this.prisma.poste.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Poste introuvable (id: ${id})`);
    }
    return row;
  }

  async updateStatut(
    id: string,
    dto: UpdatePosteStatutDto,
    actorId: string,
  ): Promise<PosteResponseDto> {
    const row = await this.prisma.poste.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Poste introuvable (id: ${id})`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const poste = await tx.poste.update({
        where: { id },
        data: {
          statut: dto.statut,
          dateDerniereMaintenance:
            dto.statut === StatutPoste.DISPONIBLE ? new Date() : row.dateDerniereMaintenance,
        },
      });

      await this.audit.record(tx, {
        action: 'UPDATE',
        entity: 'Poste',
        entityId: id,
        actorId,
        details: { statutAvant: row.statut, statutApres: dto.statut },
      });

      return poste;
    });

    this.logger.log(`Poste ${id} → statut ${dto.statut}`);
    return updated;
  }

  /** Comptage des postes disponibles/hors service par salle — cf. business rule "tracking per room". */
  async disponibiliteParSalle(): Promise<DisponibilitePosteDto[]> {
    const rows = await this.prisma.poste.groupBy({
      by: ['salle', 'statut'],
      _count: { _all: true },
    });

    const parSalle = new Map<string, DisponibilitePosteDto>();
    for (const row of rows) {
      const entry = parSalle.get(row.salle) ?? { salle: row.salle, total: 0, disponibles: 0, horsService: 0 };
      entry.total += row._count._all;
      if (row.statut === StatutPoste.DISPONIBLE) entry.disponibles += row._count._all;
      if (row.statut === StatutPoste.HORS_SERVICE) entry.horsService += row._count._all;
      parSalle.set(row.salle, entry);
    }

    return [...parSalle.values()].sort((a, b) => a.salle.localeCompare(b.salle));
  }
}
