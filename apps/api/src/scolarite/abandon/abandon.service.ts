import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, StatutAbandon } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { AbandonListResponseDto } from './dto/abandon-list.response.dto';
import { AbandonResponseDto } from './dto/abandon.response.dto';
import { DecisionReprise, DeciderRepriseDto } from './dto/decider-reprise.dto';
import { QueryAbandonDto } from './dto/query-abandon.dto';
import { SignalerAbandonDto } from './dto/signaler-abandon.dto';
import { isTransitionAllowed } from './state-machine';

const ABANDON_SELECT = {
  id: true,
  etudiantId: true,
  anneeId: true,
  statut: true,
  dateConstat: true,
  signaleParId: true,
  dateDemandeReprise: true,
  dateDecisionReprise: true,
  decideParId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AbandonSelect;

type AbandonRow = Prisma.AbandonGetPayload<{ select: typeof ABANDON_SELECT }>;

/**
 * Service du workflow Abandon (déclaration + reprise).
 *
 * Un Abandon.statut est la seule source de vérité de la machine à états
 * (state-machine.ts). Il est couplé à Inscription.estActive de l'inscription
 * correspondante (même étudiant, même année) :
 *  - signaler()        → CONSTATE           → Inscription.estActive = false
 *  - deciderReprise()  → REPRISE_ACCORDEE   → Inscription.estActive = true
 * Le contrôle de régularité existant (RegularityService) filtre sur
 * estActive : sans cette synchronisation, un étudiant en abandon non lié
 * resterait compté comme actif ailleurs dans le système.
 *
 * Aucune règle RBAC ici : `actorId` est fourni par l'appelant authentifié.
 */
@Injectable()
export class AbandonService {
  private readonly logger = new Logger(AbandonService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: QueryAbandonDto): Promise<AbandonListResponseDto> {
    const where: Prisma.AbandonWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.abandon.findMany({
        where,
        select: ABANDON_SELECT,
        orderBy: { dateConstat: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.abandon.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  async findOne(id: string): Promise<AbandonResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Signalement (création) ──────────────────────────────────────────────────

  /**
   * Signale un abandon : crée l'Abandon (statut CONSTATE) et désactive
   * l'inscription correspondante (même étudiant, même année).
   */
  async signaler(dto: SignalerAbandonDto, actorId: string): Promise<AbandonResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const inscription = await tx.inscription.findUnique({
        where: { etudiantId_anneeId: { etudiantId: dto.etudiantId, anneeId: dto.anneeId } },
      });
      if (!inscription) {
        throw new NotFoundException(
          `Aucune inscription trouvée pour cet étudiant sur cette année (etudiantId: ${dto.etudiantId}, anneeId: ${dto.anneeId})`,
        );
      }

      let row: AbandonRow;
      try {
        row = await tx.abandon.create({
          data: { etudiantId: dto.etudiantId, anneeId: dto.anneeId, signaleParId: actorId },
          select: ABANDON_SELECT,
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException(
            'Un abandon est déjà déclaré pour cet étudiant sur cette année universitaire',
          );
        }
        throw e;
      }

      await tx.inscription.update({
        where: { id: inscription.id },
        data: { estActive: false },
      });

      return row;
    });

    this.logger.log(`Abandon signalé (id: ${created.id}) — inscription désactivée`);
    return this.toDto(created);
  }

  // ── Transitions ──────────────────────────────────────────────────────────

  /** CONSTATE → REPRISE_DEMANDEE */
  async demanderReprise(id: string): Promise<AbandonResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.abandon.findUnique({ where: { id }, select: ABANDON_SELECT });
      if (!current) {
        throw new NotFoundException(`Abandon introuvable (id: ${id})`);
      }
      if (!isTransitionAllowed(current.statut, StatutAbandon.REPRISE_DEMANDEE)) {
        throw new UnprocessableEntityException(
          `Transition invalide : ${current.statut} → ${StatutAbandon.REPRISE_DEMANDEE}`,
        );
      }

      const result = await tx.abandon.updateMany({
        where: { id, statut: current.statut },
        data: { statut: StatutAbandon.REPRISE_DEMANDEE, dateDemandeReprise: new Date() },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de concurrence : l\'abandon a été modifié entre-temps');
      }

      this.logger.log(`Abandon ${id} : ${current.statut} → ${StatutAbandon.REPRISE_DEMANDEE}`);
      return tx.abandon.findUniqueOrThrow({ where: { id }, select: ABANDON_SELECT });
    });
    return this.toDto(updated);
  }

  /**
   * REPRISE_DEMANDEE → REPRISE_ACCORDEE | REPRISE_REFUSEE.
   * Si accordée, réactive l'inscription correspondante (même étudiant, même année).
   */
  async deciderReprise(id: string, actorId: string, dto: DeciderRepriseDto): Promise<AbandonResponseDto> {
    const target =
      dto.decision === DecisionReprise.ACCORDEE ? StatutAbandon.REPRISE_ACCORDEE : StatutAbandon.REPRISE_REFUSEE;

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.abandon.findUnique({ where: { id }, select: ABANDON_SELECT });
      if (!current) {
        throw new NotFoundException(`Abandon introuvable (id: ${id})`);
      }
      if (!isTransitionAllowed(current.statut, target)) {
        throw new UnprocessableEntityException(`Transition invalide : ${current.statut} → ${target}`);
      }

      const result = await tx.abandon.updateMany({
        where: { id, statut: current.statut },
        data: { statut: target, dateDecisionReprise: new Date(), decideParId: actorId },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de concurrence : l\'abandon a été modifié entre-temps');
      }

      if (target === StatutAbandon.REPRISE_ACCORDEE) {
        await tx.inscription.update({
          where: { etudiantId_anneeId: { etudiantId: current.etudiantId, anneeId: current.anneeId } },
          data: { estActive: true },
        });
      }

      this.logger.log(`Abandon ${id} : ${current.statut} → ${target}`);
      return tx.abandon.findUniqueOrThrow({ where: { id }, select: ABANDON_SELECT });
    });
    return this.toDto(updated);
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<AbandonRow> {
    const row = await this.prisma.abandon.findUnique({ where: { id }, select: ABANDON_SELECT });
    if (!row) {
      throw new NotFoundException(`Abandon introuvable (id: ${id})`);
    }
    return row;
  }

  private toDto(row: AbandonRow): AbandonResponseDto {
    return { ...row };
  }
}
