import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StatutPoste } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePosteDto } from './dto/create-poste.dto';
import { DisponibilitePosteDto, PosteResponseDto } from './dto/poste.response.dto';
import { ListPosteQueryDto } from './dto/list-poste-query.dto';
import { UpdatePosteStatutDto } from './dto/update-poste-statut.dto';

@Injectable()
export class PosteService {
  private readonly logger = new Logger(PosteService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePosteDto): Promise<PosteResponseDto> {
    const created = await this.prisma.poste.create({ data: { salle: dto.salle } });
    this.logger.log(`Poste créé : ${created.id} (salle: ${created.salle})`);
    return created;
  }

  findAll(query: ListPosteQueryDto): Promise<PosteResponseDto[]> {
    return this.prisma.poste.findMany({
      where: { salle: query.salle, statut: query.statut },
      orderBy: [{ salle: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string): Promise<PosteResponseDto> {
    const row = await this.prisma.poste.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Poste introuvable (id: ${id})`);
    }
    return row;
  }

  async updateStatut(id: string, dto: UpdatePosteStatutDto): Promise<PosteResponseDto> {
    const row = await this.prisma.poste.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Poste introuvable (id: ${id})`);
    }

    const updated = await this.prisma.poste.update({
      where: { id },
      data: {
        statut: dto.statut,
        dateDerniereMaintenance: dto.statut === StatutPoste.DISPONIBLE ? new Date() : row.dateDerniereMaintenance,
      },
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
