import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutValidation } from '@prisma/client';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateEpreuveDto } from './dto/create-epreuve.dto';
import { ListEpreuveQueryDto } from './dto/list-epreuve-query.dto';
import { EpreuveResponseDto, PaginatedEpreuveResponseDto } from './dto/epreuve.response.dto';

const EPREUVE_SELECT = {
  id: true,
  coursClasseId: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EpreuveSelect;

type EpreuveRow = Prisma.EpreuveGetPayload<{ select: typeof EPREUVE_SELECT }>;

@Injectable()
export class EpreuveService {
  private readonly logger = new Logger(EpreuveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: ListEpreuveQueryDto): Promise<PaginatedEpreuveResponseDto> {
    const where: Prisma.EpreuveWhereInput = {
      coursClasseId: query.coursClasseId,
      type: query.type,
    };

    const [rows, total] = await Promise.all([
      this.prisma.epreuve.findMany({
        where,
        select: EPREUVE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.epreuve.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  async findOne(id: string): Promise<EpreuveResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateEpreuveDto, actorId: string): Promise<EpreuveResponseDto> {
    const coursClasse = await this.prisma.coursClasse.findUnique({
      where: { id: dto.coursClasseId },
      include: { cours: true },
    });
    if (!coursClasse) {
      throw new NotFoundException(`CoursClasse introuvable (id: ${dto.coursClasseId})`);
    }

    if (coursClasse.cours.statutValidation !== StatutValidation.APPROUVE) {
      throw new ConflictException(
        'Le cours doit être approuvé avant de pouvoir recevoir une épreuve.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const epreuve = await tx.epreuve.create({
        data: { coursClasseId: dto.coursClasseId, type: dto.type },
        select: EPREUVE_SELECT,
      });

      await this.audit.record(tx, {
        action: 'CREATE',
        entity: 'Epreuve',
        entityId: epreuve.id,
        actorId,
        details: { coursClasseId: dto.coursClasseId, type: dto.type },
      });

      return epreuve;
    });

    this.logger.log(`Epreuve créée (coursClasseId: ${dto.coursClasseId}, type: ${dto.type})`);
    return this.toDto(created);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async remove(id: string, actorId: string): Promise<void> {
    // Type et cours-classe capturés avant la suppression.
    const epreuve = await this.findRowOrThrow(id);

    const notesCount = await this.prisma.noteEtudiant.count({ where: { epreuveId: id } });
    if (notesCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer cette épreuve : ${notesCount} note(s) y sont encore rattachée(s).`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.epreuve.delete({ where: { id } });

      await this.audit.record(tx, {
        action: 'DELETE',
        entity: 'Epreuve',
        entityId: id,
        actorId,
        details: { coursClasseId: epreuve.coursClasseId, type: epreuve.type },
      });
    });

    this.logger.log(`Epreuve supprimée : ${id}`);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<EpreuveRow> {
    const row = await this.prisma.epreuve.findUnique({ where: { id }, select: EPREUVE_SELECT });
    if (!row) throw new NotFoundException(`Epreuve introuvable (id: ${id})`);
    return row;
  }

  private toDto(row: EpreuveRow): EpreuveResponseDto {
    return {
      id: row.id,
      coursClasseId: row.coursClasseId,
      type: row.type,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
