import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateOuvrageDto } from './dto/create-ouvrage.dto';
import { ListOuvrageQueryDto } from './dto/list-ouvrage-query.dto';
import { OuvrageResponseDto } from './dto/ouvrage.response.dto';
import { UpdateOuvrageDto } from './dto/update-ouvrage.dto';

const OUVRAGE_SELECT = {
  id: true,
  isbn: true,
  titre: true,
  auteur: true,
  editeur: true,
  anneeEdition: true,
  cote: true,
  classificationDewey: true,
  matieres: true,
  salle: true,
  etagere: true,
  nombreExemplaires: true,
  exemplairesDisponibles: true,
  statut: true,
  sectionId: true,
  createdAt: true,
  updatedAt: true,
  section: { select: { nom: true } },
} satisfies Prisma.OuvrageSelect;

type OuvrageRow = Prisma.OuvrageGetPayload<{ select: typeof OUVRAGE_SELECT }>;

@Injectable()
export class OuvrageService {
  private readonly logger = new Logger(OuvrageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: ListOuvrageQueryDto): Promise<OuvrageResponseDto[]> {
    const rows = await this.prisma.ouvrage.findMany({
      where: {
        sectionId: query.sectionId,
        statut: query.statut,
        ...(query.q
          ? {
              OR: [
                { titre: { contains: query.q, mode: 'insensitive' } },
                { auteur: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: OUVRAGE_SELECT,
      orderBy: { titre: 'asc' },
    });
    return rows.map(this.toDto);
  }

  async findOne(id: string): Promise<OuvrageResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateOuvrageDto): Promise<OuvrageResponseDto> {
    const section = await this.prisma.sectionBibliotheque.findUnique({
      where: { id: dto.sectionId },
    });
    if (!section) {
      throw new NotFoundException(`SectionBibliotheque introuvable (id: ${dto.sectionId})`);
    }

    const created = await this.prisma.ouvrage.create({
      data: {
        isbn: dto.isbn,
        titre: dto.titre,
        auteur: dto.auteur,
        editeur: dto.editeur,
        anneeEdition: dto.anneeEdition,
        cote: dto.cote,
        classificationDewey: dto.classificationDewey,
        matieres: dto.matieres,
        salle: dto.salle,
        etagere: dto.etagere,
        nombreExemplaires: dto.nombreExemplaires,
        exemplairesDisponibles: dto.nombreExemplaires,
        sectionId: dto.sectionId,
      },
      select: OUVRAGE_SELECT,
    });

    this.logger.log(`Ouvrage créé (cote: ${created.cote})`);
    return this.toDto(created);
  }

  // ── Modification ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateOuvrageDto): Promise<OuvrageResponseDto> {
    const existing = await this.findRowOrThrow(id);

    if (dto.sectionId) {
      const section = await this.prisma.sectionBibliotheque.findUnique({
        where: { id: dto.sectionId },
      });
      if (!section) {
        throw new NotFoundException(`SectionBibliotheque introuvable (id: ${dto.sectionId})`);
      }
    }

    // Si nombreExemplaires change, exemplairesDisponibles suit le même delta
    // (jamais recalculé depuis les emprunts en cours ici — cohérence assurée
    // par EmpruntService lors de chaque emprunt/retour).
    let exemplairesDisponibles = existing.exemplairesDisponibles;
    if (dto.nombreExemplaires !== undefined) {
      const delta = dto.nombreExemplaires - existing.nombreExemplaires;
      exemplairesDisponibles = Math.max(0, existing.exemplairesDisponibles + delta);
    }

    const updated = await this.prisma.ouvrage.update({
      where: { id },
      data: {
        isbn: dto.isbn,
        titre: dto.titre,
        auteur: dto.auteur,
        editeur: dto.editeur,
        anneeEdition: dto.anneeEdition,
        cote: dto.cote,
        classificationDewey: dto.classificationDewey,
        matieres: dto.matieres,
        salle: dto.salle,
        etagere: dto.etagere,
        nombreExemplaires: dto.nombreExemplaires,
        exemplairesDisponibles,
        statut: dto.statut,
        sectionId: dto.sectionId,
      },
      select: OUVRAGE_SELECT,
    });

    this.logger.log(`Ouvrage modifié : ${id}`);
    return this.toDto(updated);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findRowOrThrow(id);

    const empruntsEnCoursCount = await this.prisma.emprunt.count({
      where: { ouvrageId: id, statut: { in: ['EN_COURS', 'EN_RETARD'] } },
    });
    if (empruntsEnCoursCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer cet ouvrage : ${empruntsEnCoursCount} emprunt(s) en cours.`,
      );
    }

    await this.prisma.ouvrage.delete({ where: { id } });
    this.logger.log(`Ouvrage supprimé : ${id}`);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<OuvrageRow> {
    const row = await this.prisma.ouvrage.findUnique({ where: { id }, select: OUVRAGE_SELECT });
    if (!row) throw new NotFoundException(`Ouvrage introuvable (id: ${id})`);
    return row;
  }

  private toDto(row: OuvrageRow): OuvrageResponseDto {
    return {
      id: row.id,
      isbn: row.isbn,
      titre: row.titre,
      auteur: row.auteur,
      editeur: row.editeur,
      anneeEdition: row.anneeEdition,
      cote: row.cote,
      classificationDewey: row.classificationDewey,
      matieres: row.matieres,
      salle: row.salle,
      etagere: row.etagere,
      nombreExemplaires: row.nombreExemplaires,
      exemplairesDisponibles: row.exemplairesDisponibles,
      statut: row.statut,
      sectionId: row.sectionId,
      sectionNom: row.section.nom,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
