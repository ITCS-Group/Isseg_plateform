import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutValidation } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCoursClasseDto } from './dto/create-cours-classe.dto';
import { ListCoursClasseQueryDto } from './dto/list-cours-classe-query.dto';
import { CoursClasseResponseDto } from './dto/cours-classe.response.dto';

const COURS_CLASSE_SELECT = {
  id: true,
  coursId: true,
  classeId: true,
  createdAt: true,
} satisfies Prisma.CoursClasseSelect;

type CoursClasseRow = Prisma.CoursClasseGetPayload<{ select: typeof COURS_CLASSE_SELECT }>;

@Injectable()
export class CoursClasseService {
  private readonly logger = new Logger(CoursClasseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: ListCoursClasseQueryDto): Promise<CoursClasseResponseDto[]> {
    const rows = await this.prisma.coursClasse.findMany({
      where: {
        coursId: query.coursId,
        classeId: query.classeId,
      },
      select: COURS_CLASSE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDto);
  }

  async findOne(id: string): Promise<CoursClasseResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateCoursClasseDto): Promise<CoursClasseResponseDto> {
    const cours = await this.prisma.coursScenarise.findUnique({ where: { id: dto.coursId } });
    if (!cours) {
      throw new NotFoundException(`CoursScenarise introuvable (id: ${dto.coursId})`);
    }

    const classe = await this.prisma.classe.findUnique({ where: { id: dto.classeId } });
    if (!classe) {
      throw new NotFoundException(`Classe introuvable (id: ${dto.classeId})`);
    }

    if (cours.statutValidation !== StatutValidation.APPROUVE) {
      throw new ConflictException(
        'Le cours doit être approuvé avant de pouvoir être associé à une classe.',
      );
    }

    await this.assertAssociationFree(dto.coursId, dto.classeId);

    const created = await this.prisma.coursClasse.create({
      data: { coursId: dto.coursId, classeId: dto.classeId },
      select: COURS_CLASSE_SELECT,
    });

    this.logger.log(
      `Association CoursClasse créée (coursId: ${dto.coursId}, classeId: ${dto.classeId})`,
    );
    return this.toDto(created);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findRowOrThrow(id);

    const epreuvesCount = await this.prisma.epreuve.count({ where: { coursClasseId: id } });
    if (epreuvesCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer cette association : ${epreuvesCount} épreuve(s) y sont encore rattachée(s).`,
      );
    }

    await this.prisma.coursClasse.delete({ where: { id } });
    this.logger.log(`Association CoursClasse supprimée : ${id}`);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<CoursClasseRow> {
    const row = await this.prisma.coursClasse.findUnique({
      where: { id },
      select: COURS_CLASSE_SELECT,
    });
    if (!row) throw new NotFoundException(`Association CoursClasse introuvable (id: ${id})`);
    return row;
  }

  private async assertAssociationFree(coursId: string, classeId: string): Promise<void> {
    const existing = await this.prisma.coursClasse.findUnique({
      where: { coursId_classeId: { coursId, classeId } },
    });
    if (existing) {
      throw new ConflictException('Cette association cours/classe existe déjà.');
    }
  }

  private toDto(row: CoursClasseRow): CoursClasseResponseDto {
    return {
      id: row.id,
      coursId: row.coursId,
      classeId: row.classeId,
      createdAt: row.createdAt,
    };
  }
}
