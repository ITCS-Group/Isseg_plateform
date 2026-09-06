import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StatutEmprunt, StatutOuvrage } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegularityService } from '../../scolarite/regularity/regularity.service';
import { TYPE_ABONNE_RULES } from '../common/loan-rules.constants';
import { CreateEmpruntDto } from './dto/create-emprunt.dto';
import { EmpruntResponseDto, PaginatedEmpruntResponseDto } from './dto/emprunt.response.dto';
import { ListEmpruntQueryDto } from './dto/list-emprunt-query.dto';

/** Rôles qui voient tous les emprunts, sans restriction à leurs propres emprunts. */
const UNSCOPED_ROLES = ['ADMIN', 'BIBLIOTHECAIRE', 'RESPONSABLE_BIBLIOTHEQUE'];

const ACTIVE_STATUTS: StatutEmprunt[] = [StatutEmprunt.EN_COURS, StatutEmprunt.EN_RETARD];

const EMPRUNT_SELECT = {
  id: true,
  ouvrageId: true,
  emprunteurId: true,
  dateEmprunt: true,
  dateRetourPrevue: true,
  dateRetourEffectif: true,
  renouvellementsRestants: true,
  statut: true,
  retardJours: true,
  montantPenalite: true,
  penalitesPayees: true,
  createdAt: true,
  updatedAt: true,
  ouvrage: { select: { titre: true } },
  emprunteur: { select: { nom: true, prenom: true } },
} satisfies Prisma.EmpruntSelect;

type EmpruntRow = Prisma.EmpruntGetPayload<{ select: typeof EMPRUNT_SELECT }>;

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

@Injectable()
export class EmpruntService {
  private readonly logger = new Logger(EmpruntService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly regularityService: RegularityService,
    private readonly config: ConfigService,
  ) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(
    query: ListEmpruntQueryDto,
    user: Pick<AuthenticatedUser, 'id' | 'roles'>,
  ): Promise<PaginatedEmpruntResponseDto> {
    const isUnscoped = user.roles.some((role) => UNSCOPED_ROLES.includes(role));
    const emprunteurId = isUnscoped ? query.emprunteurId : user.id;

    const where: Prisma.EmpruntWhereInput = { emprunteurId, statut: query.statut };

    const [rows, total] = await Promise.all([
      this.prisma.emprunt.findMany({
        where,
        select: EMPRUNT_SELECT,
        orderBy: { dateEmprunt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.emprunt.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  // ── Création (emprunt) ───────────────────────────────────────────────────

  async create(dto: CreateEmpruntDto): Promise<EmpruntResponseDto> {
    const ouvrage = await this.prisma.ouvrage.findUnique({ where: { id: dto.ouvrageId } });
    if (!ouvrage) {
      throw new NotFoundException(`Ouvrage introuvable (id: ${dto.ouvrageId})`);
    }
    if (ouvrage.exemplairesDisponibles <= 0) {
      throw new ConflictException('Aucun exemplaire disponible pour cet ouvrage.');
    }

    const abonne = await this.prisma.abonne.findUnique({
      where: { utilisateurId: dto.emprunteurId },
    });
    if (!abonne) {
      throw new NotFoundException(
        `Aucun profil abonné pour cet utilisateur (id: ${dto.emprunteurId}) — créez-le via POST /abonnes.`,
      );
    }
    if (!abonne.statutActif) {
      throw new ForbiddenException('Abonnement inactif.');
    }

    // Prêt à domicile réservé aux types d'abonné listés en configuration
    // (décision métier du 05/08/2026 : ENSEIGNANT uniquement au lancement,
    // étudiants limités à la consultation sur place — cf.
    // apps/api/src/config/configuration.ts). Paramètre, pas une règle figée
    // en dur : réactiver l'accès étudiant ne nécessite qu'un changement de
    // variable d'environnement, aucun redéploiement de code.
    const typesAutorises = this.config.get<string[]>('bibliotheque.empruntDomicileTypesAutorises', []);
    if (!typesAutorises.includes(abonne.typeAbonne)) {
      throw new ForbiddenException(
        `Le prêt à domicile est actuellement réservé aux types d'abonné suivants : ${typesAutorises.join(', ')}.`,
      );
    }

    // Régularité — ne s'applique qu'aux étudiants (règle CLAUDE.md § Student
    // Regularity) ; le personnel (Enseignant/Personnel Admin) n'a pas de
    // FraisScolarite et n'est donc pas concerné.
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { userId: dto.emprunteurId },
      select: { matriculeUnique: true },
    });
    if (etudiant?.matriculeUnique) {
      const regularite = await this.regularityService.checkRegularity(etudiant.matriculeUnique);
      if (!regularite.isRegular) {
        throw new ForbiddenException(
          `Étudiant non régulier — emprunt refusé (${regularite.reason ?? 'motif non précisé'}).`,
        );
      }
    }

    const limiteEmprunts = abonne.limiteEmprunts ?? TYPE_ABONNE_RULES[abonne.typeAbonne].limiteEmprunts;
    const dureePretJours = abonne.dureePretJours ?? TYPE_ABONNE_RULES[abonne.typeAbonne].dureePretJours;
    const renouvellementsMax = TYPE_ABONNE_RULES[abonne.typeAbonne].renouvellementsMax;

    const empruntsEnCours = await this.prisma.emprunt.count({
      where: { emprunteurId: dto.emprunteurId, statut: { in: ACTIVE_STATUTS } },
    });
    if (empruntsEnCours >= limiteEmprunts) {
      throw new ConflictException(
        `Quota d'emprunts atteint (${empruntsEnCours}/${limiteEmprunts}).`,
      );
    }

    const dateEmprunt = new Date();
    const dateRetourPrevue = new Date(dateEmprunt.getTime() + dureePretJours * MS_PAR_JOUR);

    const created = await this.prisma.$transaction(async (tx) => {
      const emprunt = await tx.emprunt.create({
        data: {
          ouvrageId: dto.ouvrageId,
          emprunteurId: dto.emprunteurId,
          dateEmprunt,
          dateRetourPrevue,
          renouvellementsRestants: renouvellementsMax,
          statut: StatutEmprunt.EN_COURS,
        },
        select: EMPRUNT_SELECT,
      });

      const exemplairesDisponibles = ouvrage.exemplairesDisponibles - 1;
      await tx.ouvrage.update({
        where: { id: dto.ouvrageId },
        data: {
          exemplairesDisponibles,
          statut: exemplairesDisponibles === 0 ? StatutOuvrage.EMPRUNTE : ouvrage.statut,
        },
      });

      return emprunt;
    });

    this.logger.log(`Emprunt créé (ouvrageId: ${dto.ouvrageId}, emprunteurId: ${dto.emprunteurId})`);
    return this.toDto(created);
  }

  // ── Retour ────────────────────────────────────────────────────────────────

  async retour(id: string): Promise<EmpruntResponseDto> {
    const emprunt = await this.prisma.emprunt.findUnique({ where: { id }, select: EMPRUNT_SELECT });
    if (!emprunt) {
      throw new NotFoundException(`Emprunt introuvable (id: ${id})`);
    }
    if (emprunt.statut === StatutEmprunt.RETOURNE) {
      throw new ConflictException('Cet emprunt a déjà été retourné.');
    }

    const dateRetourEffectif = new Date();
    const retardJours = Math.max(
      0,
      Math.ceil((dateRetourEffectif.getTime() - emprunt.dateRetourPrevue.getTime()) / MS_PAR_JOUR),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.emprunt.update({
        where: { id },
        data: {
          dateRetourEffectif,
          retardJours,
          statut: StatutEmprunt.RETOURNE,
        },
        select: EMPRUNT_SELECT,
      });

      const ouvrage = await tx.ouvrage.findUniqueOrThrow({ where: { id: emprunt.ouvrageId } });
      const exemplairesDisponibles = Math.min(
        ouvrage.nombreExemplaires,
        ouvrage.exemplairesDisponibles + 1,
      );
      await tx.ouvrage.update({
        where: { id: emprunt.ouvrageId },
        data: {
          exemplairesDisponibles,
          statut: ouvrage.statut === StatutOuvrage.EMPRUNTE ? StatutOuvrage.DISPONIBLE : ouvrage.statut,
        },
      });

      return row;
    });

    this.logger.log(`Emprunt retourné : ${id} (retard: ${retardJours}j)`);
    return this.toDto(updated);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private toDto(row: EmpruntRow): EmpruntResponseDto {
    return {
      id: row.id,
      ouvrageId: row.ouvrageId,
      ouvrageTitre: row.ouvrage.titre,
      emprunteurId: row.emprunteurId,
      emprunteurNom: row.emprunteur.nom,
      emprunteurPrenom: row.emprunteur.prenom,
      dateEmprunt: row.dateEmprunt,
      dateRetourPrevue: row.dateRetourPrevue,
      dateRetourEffectif: row.dateRetourEffectif,
      renouvellementsRestants: row.renouvellementsRestants,
      statut: row.statut,
      retardJours: row.retardJours,
      montantPenalite: Number(row.montantPenalite),
      penalitesPayees: row.penalitesPayees,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
