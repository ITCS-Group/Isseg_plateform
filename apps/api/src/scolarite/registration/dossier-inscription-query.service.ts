import { Injectable } from '@nestjs/common';
import { Prisma, StatutDossier } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { QueryDossierInscriptionDto } from './dto/query-dossier-inscription.dto';
import {
  DossierInscriptionListItemDto,
  PaginatedDossiersInscriptionResponseDto,
} from './dto/dossier-inscription.response.dto';
import { DossierInscriptionStatsResponseDto } from './dto/dossier-inscription-stats.response.dto';

const DOSSIER_LIST_SELECT = {
  id: true,
  statutDossier: true,
  dateSoumission: true,
  etudiant: {
    select: {
      matriculeUnique: true,
      utilisateur: { select: { nom: true, prenom: true } },
    },
  },
  classe: {
    select: {
      libelle: true,
      filiere: { select: { nom: true } },
    },
  },
} satisfies Prisma.DossierInscriptionSelect;

type DossierListRow = Prisma.DossierInscriptionGetPayload<{ select: typeof DOSSIER_LIST_SELECT }>;

/**
 * Lecture seule sur DossierInscription (listing + agrégats) — volontairement
 * séparé de RegistrationWorkflowService, qui ne porte que la machine à états
 * des transitions (cf. son propre docstring). Toujours scopé à l'année
 * universitaire active (AnneeUniversitaire.estActive) : reflète l'effectif
 * courant, pas un cumul historique.
 */
@Injectable()
export class DossierInscriptionQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private async activeAnneeId(): Promise<string | null> {
    const annee = await this.prisma.anneeUniversitaire.findFirst({
      where: { estActive: true },
      select: { id: true },
    });
    return annee?.id ?? null;
  }

  async findAll(query: QueryDossierInscriptionDto): Promise<PaginatedDossiersInscriptionResponseDto> {
    const { page, limit } = query;
    const anneeId = await this.activeAnneeId();

    if (!anneeId) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const skip = (page - 1) * limit;
    const where: Prisma.DossierInscriptionWhereInput = { anneeId };

    const [rows, total] = await Promise.all([
      this.prisma.dossierInscription.findMany({
        where,
        select: DOSSIER_LIST_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dossierInscription.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toListItemDto(row)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async stats(): Promise<DossierInscriptionStatsResponseDto> {
    const anneeId = await this.activeAnneeId();
    if (!anneeId) {
      return { effectifInscrit: 0 };
    }

    const effectifInscrit = await this.prisma.dossierInscription.count({
      where: { anneeId, statutDossier: StatutDossier.INSCRIT },
    });

    return { effectifInscrit };
  }

  private toListItemDto(row: DossierListRow): DossierInscriptionListItemDto {
    return {
      id: row.id,
      matricule: row.etudiant.matriculeUnique,
      etudiantNom: row.etudiant.utilisateur.nom,
      etudiantPrenom: row.etudiant.utilisateur.prenom,
      filiere: row.classe.filiere.nom,
      classeLibelle: row.classe.libelle,
      statutDossier: row.statutDossier,
      dateSoumission: row.dateSoumission,
    };
  }
}
