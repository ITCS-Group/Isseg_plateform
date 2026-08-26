import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatutInscriptionCoursSupportIT } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AttestationService } from '../attestations/attestation.service';
import { CreateEvaluationSupportITDto } from './dto/create-evaluation.dto';
import { EvaluationSupportITResponseDto } from './dto/evaluation.response.dto';
import {
  InscriptionCoursSupportITResponseDto,
  PaginatedInscriptionCoursSupportITResponseDto,
} from './dto/inscription.response.dto';
import { ListInscriptionQueryDto } from './dto/list-inscription-query.dto';

const UNSCOPED_ROLES = ['ADMIN', 'RESPONSABLE_IT'];

const INSCRIPTION_SELECT = {
  id: true,
  participantId: true,
  coursId: true,
  statut: true,
  progression: true,
  createdAt: true,
  updatedAt: true,
  cours: { select: { titre: true } },
} satisfies Prisma.InscriptionCoursSupportITSelect;

type InscriptionRow = Prisma.InscriptionCoursSupportITGetPayload<{ select: typeof INSCRIPTION_SELECT }>;

@Injectable()
export class InscriptionCoursSupportITService {
  private readonly logger = new Logger(InscriptionCoursSupportITService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attestationService: AttestationService,
  ) {}

  // ── Inscription (self-service) ──────────────────────────────────────────

  async enroll(coursId: string, participantId: string): Promise<InscriptionCoursSupportITResponseDto> {
    const cours = await this.prisma.coursSupportIT.findUnique({ where: { id: coursId } });
    if (!cours) {
      throw new NotFoundException(`Cours Support IT introuvable (id: ${coursId})`);
    }

    let row: InscriptionRow;
    try {
      row = await this.prisma.inscriptionCoursSupportIT.create({
        data: { coursId, participantId },
        select: INSCRIPTION_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Déjà inscrit à ce cours.');
      }
      throw e;
    }

    this.logger.log(`Inscription créée (coursId: ${coursId}, participantId: ${participantId})`);
    return this.toDto(row);
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(
    query: ListInscriptionQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedInscriptionCoursSupportITResponseDto> {
    const isUnscoped = user.roles.some((r) => UNSCOPED_ROLES.includes(r));
    const where = isUnscoped ? {} : { participantId: user.id };

    const [rows, total] = await Promise.all([
      this.prisma.inscriptionCoursSupportIT.findMany({
        where,
        select: INSCRIPTION_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.inscriptionCoursSupportIT.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<InscriptionCoursSupportITResponseDto> {
    const row = await this.prisma.inscriptionCoursSupportIT.findUnique({
      where: { id },
      select: INSCRIPTION_SELECT,
    });
    if (!row) {
      throw new NotFoundException(`Inscription introuvable (id: ${id})`);
    }

    const isUnscoped = user.roles.some((r) => UNSCOPED_ROLES.includes(r));
    if (!isUnscoped && row.participantId !== user.id) {
      throw new ForbiddenException("Vous n'avez pas accès à cette inscription.");
    }

    return this.toDto(row);
  }

  // ── Évaluation (RESPONSABLE_IT, saisie manuelle) ────────────────────────

  async evaluer(id: string, dto: CreateEvaluationSupportITDto): Promise<EvaluationSupportITResponseDto> {
    const inscription = await this.prisma.inscriptionCoursSupportIT.findUnique({
      where: { id },
      include: {
        cours: { select: { titre: true } },
        participant: { select: { nom: true, prenom: true } },
      },
    });
    if (!inscription) {
      throw new NotFoundException(`Inscription introuvable (id: ${id})`);
    }

    const existante = await this.prisma.evaluationSupportIT.findUnique({ where: { inscriptionId: id } });
    if (existante) {
      throw new ConflictException('Cette inscription a déjà été évaluée.');
    }

    const evaluation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.evaluationSupportIT.create({
        data: { inscriptionId: id, note: dto.note, statutReussite: dto.statutReussite },
      });
      await tx.inscriptionCoursSupportIT.update({
        where: { id },
        data: { statut: StatutInscriptionCoursSupportIT.TERMINE },
      });
      return created;
    });

    this.logger.log(`Évaluation Support IT créée (inscriptionId: ${id}, réussite: ${dto.statutReussite})`);

    const attestation = dto.statutReussite
      ? this.attestationService.genererAttestationSupportIT({
          participantNom: inscription.participant.nom,
          participantPrenom: inscription.participant.prenom,
          coursTitre: inscription.cours.titre,
          dateReussite: evaluation.date,
        })
      : undefined;

    return {
      id: evaluation.id,
      inscriptionId: evaluation.inscriptionId,
      note: Number(evaluation.note),
      date: evaluation.date,
      statutReussite: evaluation.statutReussite,
      attestation,
    };
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private toDto(row: InscriptionRow): InscriptionCoursSupportITResponseDto {
    return {
      id: row.id,
      participantId: row.participantId,
      coursId: row.coursId,
      coursTitre: row.cours.titre,
      statut: row.statut,
      progression: row.progression,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
