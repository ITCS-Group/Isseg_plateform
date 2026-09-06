import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutValidation } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCoursClasseDto } from './dto/create-cours-classe.dto';
import { ListCoursClasseQueryDto } from './dto/list-cours-classe-query.dto';
import {
  CoursClasseResponseDto,
  PaginatedCoursClasseResponseDto,
} from './dto/cours-classe.response.dto';

/** Rôles qui voient toutes les associations, sans restriction à leurs propres cours. */
const UNSCOPED_ROLES = ['ADMIN', 'DGA_ETUDES', 'CHEF_DEPARTEMENT'];

const COURS_CLASSE_SELECT = {
  id: true,
  coursId: true,
  classeId: true,
  createdAt: true,
  cours: { select: { codeCours: true, titre: true } },
  classe: { select: { codeClasse: true, libelle: true, niveau: true } },
} satisfies Prisma.CoursClasseSelect;

type CoursClasseRow = Prisma.CoursClasseGetPayload<{ select: typeof COURS_CLASSE_SELECT }>;

@Injectable()
export class CoursClasseService {
  private readonly logger = new Logger(CoursClasseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(
    query: ListCoursClasseQueryDto,
    user: Pick<AuthenticatedUser, 'id' | 'roles'>,
  ): Promise<PaginatedCoursClasseResponseDto> {
    const scope = await this.resolveForcedEnseignantId(user);
    if (scope.forced && scope.enseignantId === null) {
      // ENSEIGNANT sans fiche Enseignant liée à son compte : aucun cours à afficher.
      return { data: [], meta: this.buildMeta(0, query) };
    }
    const enseignantId = scope.forced ? scope.enseignantId : query.enseignantId;

    const where: Prisma.CoursClasseWhereInput = {
      coursId: query.coursId,
      classeId: query.classeId,
      ...(enseignantId ? { cours: { enseignantId } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.coursClasse.findMany({
        where,
        select: COURS_CLASSE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coursClasse.count({ where }),
    ]);

    return { data: rows.map(this.toDto), meta: this.buildMeta(total, query) };
  }

  private buildMeta(total: number, query: ListCoursClasseQueryDto): PaginationMetaDto {
    return {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  /**
   * Détermine si la liste doit être restreinte de force aux cours d'un seul
   * enseignant (l'appelant lui-même) : le cas ENSEIGNANT sans rôle
   * dispensé (ADMIN/DGA_ETUDES/CHEF_DEPARTEMENT). Empêche un
   * enseignant de consulter les cours d'un collègue via `?enseignantId=`.
   */
  private async resolveForcedEnseignantId(
    user: Pick<AuthenticatedUser, 'id' | 'roles'>,
  ): Promise<{ forced: true; enseignantId: string | null } | { forced: false }> {
    if (user.roles.some((role) => UNSCOPED_ROLES.includes(role))) {
      return { forced: false };
    }
    if (!user.roles.includes('ENSEIGNANT')) {
      return { forced: false };
    }
    const enseignant = await this.prisma.enseignant.findFirst({
      where: { personnel: { userId: user.id } },
      select: { id: true },
    });
    return { forced: true, enseignantId: enseignant?.id ?? null };
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
      coursCode: row.cours.codeCours,
      coursTitre: row.cours.titre,
      classeCode: row.classe.codeClasse,
      classeLibelle: row.classe.libelle,
      classeNiveau: row.classe.niveau,
    };
  }
}
