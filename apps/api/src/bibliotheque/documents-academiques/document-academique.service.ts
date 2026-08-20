import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDocumentAcademiqueDto } from './dto/create-document-academique.dto';
import { DocumentAcademiqueResponseDto } from './dto/document-academique.response.dto';
import { ListDocumentAcademiqueQueryDto } from './dto/list-document-academique-query.dto';
import { UpdateDocumentAcademiqueDto } from './dto/update-document-academique.dto';

/** Rôles qui voient tous les documents, y compris ceux sous embargo/non diffusés. */
const PRIVILEGED_ROLES = ['ADMIN', 'RESPONSABLE_NUMERISATION'];

const DOCUMENT_SELECT = {
  id: true,
  type: true,
  titre: true,
  anneeUniversitaire: true,
  filiere: true,
  niveau: true,
  urlPdf: true,
  motsCles: true,
  resume: true,
  diffusionAutorisee: true,
  embargoJusqua: true,
  nombreTelechargements: true,
  nombreVues: true,
  auteurId: true,
  directeurMemoireId: true,
  createdAt: true,
  updatedAt: true,
  auteur: { select: { utilisateur: { select: { nom: true, prenom: true } } } },
} satisfies Prisma.DocumentAcademiqueSelect;

type DocumentRow = Prisma.DocumentAcademiqueGetPayload<{ select: typeof DOCUMENT_SELECT }>;

@Injectable()
export class DocumentAcademiqueService {
  private readonly logger = new Logger(DocumentAcademiqueService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(
    query: ListDocumentAcademiqueQueryDto,
    user: Pick<AuthenticatedUser, 'roles'>,
  ): Promise<DocumentAcademiqueResponseDto[]> {
    const isPrivileged = user.roles.some((role) => PRIVILEGED_ROLES.includes(role));

    // AND d'un tableau de filtres indépendants : `q` et la visibilité utilisent
    // chacun un `OR` — les combiner par spread sur le même objet écraserait
    // l'un des deux (clé dupliquée), d'où ce tableau plutôt qu'un objet unique.
    const filters: Prisma.DocumentAcademiqueWhereInput[] = [];
    if (query.type) filters.push({ type: query.type });
    if (query.q) {
      filters.push({
        OR: [{ titre: { contains: query.q, mode: 'insensitive' } }, { motsCles: { has: query.q } }],
      });
    }
    if (!isPrivileged) filters.push(this.visibilityFilter());

    const rows = await this.prisma.documentAcademique.findMany({
      where: { AND: filters },
      select: DOCUMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDto);
  }

  async findOne(id: string, user: Pick<AuthenticatedUser, 'roles'>): Promise<DocumentAcademiqueResponseDto> {
    const row = await this.findRowOrThrow(id);
    const isPrivileged = user.roles.some((role) => PRIVILEGED_ROLES.includes(role));
    if (!isPrivileged && !this.isVisible(row)) {
      throw new NotFoundException(`Document académique introuvable (id: ${id})`);
    }
    return this.toDto(row);
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateDocumentAcademiqueDto): Promise<DocumentAcademiqueResponseDto> {
    const auteur = await this.prisma.etudiant.findUnique({ where: { id: dto.auteurId } });
    if (!auteur) {
      throw new NotFoundException(`Etudiant introuvable (id: ${dto.auteurId})`);
    }
    if (dto.directeurMemoireId) {
      const directeur = await this.prisma.enseignant.findUnique({ where: { id: dto.directeurMemoireId } });
      if (!directeur) {
        throw new NotFoundException(`Enseignant introuvable (id: ${dto.directeurMemoireId})`);
      }
    }

    const created = await this.prisma.documentAcademique.create({
      data: {
        type: dto.type,
        titre: dto.titre,
        anneeUniversitaire: dto.anneeUniversitaire,
        filiere: dto.filiere,
        niveau: dto.niveau,
        urlPdf: dto.urlPdf,
        motsCles: dto.motsCles,
        resume: dto.resume,
        diffusionAutorisee: dto.diffusionAutorisee ?? false,
        embargoJusqua: dto.embargoJusqua ? new Date(dto.embargoJusqua) : null,
        auteurId: dto.auteurId,
        directeurMemoireId: dto.directeurMemoireId,
      },
      select: DOCUMENT_SELECT,
    });

    this.logger.log(`DocumentAcademique créé (titre: ${created.titre})`);
    return this.toDto(created);
  }

  // ── Modification ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateDocumentAcademiqueDto): Promise<DocumentAcademiqueResponseDto> {
    await this.findRowOrThrow(id);

    if (dto.directeurMemoireId) {
      const directeur = await this.prisma.enseignant.findUnique({ where: { id: dto.directeurMemoireId } });
      if (!directeur) {
        throw new NotFoundException(`Enseignant introuvable (id: ${dto.directeurMemoireId})`);
      }
    }

    const updated = await this.prisma.documentAcademique.update({
      where: { id },
      data: {
        type: dto.type,
        titre: dto.titre,
        resume: dto.resume,
        motsCles: dto.motsCles,
        diffusionAutorisee: dto.diffusionAutorisee,
        embargoJusqua: dto.embargoJusqua !== undefined ? new Date(dto.embargoJusqua) : undefined,
        directeurMemoireId: dto.directeurMemoireId,
      },
      select: DOCUMENT_SELECT,
    });

    this.logger.log(`DocumentAcademique modifié : ${id}`);
    return this.toDto(updated);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private visibilityFilter(): Prisma.DocumentAcademiqueWhereInput {
    return {
      diffusionAutorisee: true,
      OR: [{ embargoJusqua: null }, { embargoJusqua: { lte: new Date() } }],
    };
  }

  private isVisible(row: DocumentRow): boolean {
    if (!row.diffusionAutorisee) return false;
    if (row.embargoJusqua && row.embargoJusqua > new Date()) return false;
    return true;
  }

  private async findRowOrThrow(id: string): Promise<DocumentRow> {
    const row = await this.prisma.documentAcademique.findUnique({ where: { id }, select: DOCUMENT_SELECT });
    if (!row) throw new NotFoundException(`Document académique introuvable (id: ${id})`);
    return row;
  }

  private toDto(row: DocumentRow): DocumentAcademiqueResponseDto {
    return {
      id: row.id,
      type: row.type,
      titre: row.titre,
      anneeUniversitaire: row.anneeUniversitaire,
      filiere: row.filiere,
      niveau: row.niveau,
      urlPdf: row.urlPdf,
      motsCles: row.motsCles,
      resume: row.resume,
      diffusionAutorisee: row.diffusionAutorisee,
      embargoJusqua: row.embargoJusqua,
      nombreTelechargements: row.nombreTelechargements,
      nombreVues: row.nombreVues,
      auteurId: row.auteurId,
      auteurNom: row.auteur.utilisateur.nom,
      auteurPrenom: row.auteur.utilisateur.prenom,
      directeurMemoireId: row.directeurMemoireId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
