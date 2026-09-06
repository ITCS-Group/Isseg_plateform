import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TYPE_ABONNE_RULES } from '../common/loan-rules.constants';
import { AbonneResponseDto, PaginatedAbonneResponseDto } from './dto/abonne.response.dto';
import { CreateAbonneDto } from './dto/create-abonne.dto';
import { ListAbonneQueryDto } from './dto/list-abonne-query.dto';

const ABONNE_SELECT = {
  id: true,
  utilisateurId: true,
  typeAbonne: true,
  dateDebut: true,
  dateFin: true,
  statutActif: true,
  limiteEmprunts: true,
  dureePretJours: true,
  createdAt: true,
  updatedAt: true,
  utilisateur: { select: { nom: true, prenom: true } },
} satisfies Prisma.AbonneSelect;

type AbonneRow = Prisma.AbonneGetPayload<{ select: typeof ABONNE_SELECT }>;

/**
 * Un Abonne matérialise les règles d'emprunt (quota, durée) d'un Utilisateur.
 * Créé automatiquement pour un étudiant lors de son inscription (cf.
 * RegistrationWorkflowService, décision #6) ; ce service gère la création
 * manuelle pour le personnel (enseignant, admin) qui n'a pas ce déclencheur.
 */
@Injectable()
export class AbonneService {
  private readonly logger = new Logger(AbonneService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListAbonneQueryDto): Promise<PaginatedAbonneResponseDto> {
    const [rows, total] = await Promise.all([
      this.prisma.abonne.findMany({
        select: ABONNE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.abonne.count(),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  async create(dto: CreateAbonneDto): Promise<AbonneResponseDto> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: dto.utilisateurId },
    });
    if (!utilisateur) {
      throw new NotFoundException(`Utilisateur introuvable (id: ${dto.utilisateurId})`);
    }

    const existing = await this.prisma.abonne.findUnique({
      where: { utilisateurId: dto.utilisateurId },
    });
    if (existing) {
      throw new ConflictException('Cet utilisateur est déjà abonné.');
    }

    const rule = TYPE_ABONNE_RULES[dto.typeAbonne];
    const created = await this.prisma.abonne.create({
      data: {
        utilisateurId: dto.utilisateurId,
        typeAbonne: dto.typeAbonne,
        limiteEmprunts: rule.limiteEmprunts,
        dureePretJours: rule.dureePretJours,
      },
      select: ABONNE_SELECT,
    });

    this.logger.log(`Abonne créé (utilisateurId: ${dto.utilisateurId}, type: ${dto.typeAbonne})`);
    return this.toDto(created);
  }

  private toDto(row: AbonneRow): AbonneResponseDto {
    return {
      id: row.id,
      utilisateurId: row.utilisateurId,
      utilisateurNom: row.utilisateur.nom,
      utilisateurPrenom: row.utilisateur.prenom,
      typeAbonne: row.typeAbonne,
      dateDebut: row.dateDebut,
      dateFin: row.dateFin,
      statutActif: row.statutActif,
      limiteEmprunts: row.limiteEmprunts ?? TYPE_ABONNE_RULES[row.typeAbonne].limiteEmprunts,
      dureePretJours: row.dureePretJours ?? TYPE_ABONNE_RULES[row.typeAbonne].dureePretJours,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
