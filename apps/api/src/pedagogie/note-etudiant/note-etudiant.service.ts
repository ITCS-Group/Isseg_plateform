import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutValidation } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateNoteEtudiantDto } from './dto/create-note-etudiant.dto';
import { ListNoteEtudiantQueryDto } from './dto/list-note-etudiant-query.dto';
import { UpdateNoteEtudiantDto } from './dto/update-note-etudiant.dto';
import { NoteEtudiantResponseDto } from './dto/note-etudiant.response.dto';

/** Rôles dispensés de la vérification de propriété enseignant (§7 spécification). */
const OWNERSHIP_EXEMPT_ROLES = ['ADMIN', 'RESPONSABLE_PEDAGOGIQUE'];

const NOTE_ETUDIANT_SELECT = {
  id: true,
  epreuveId: true,
  inscriptionId: true,
  noteBrute: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteEtudiantSelect;

type NoteEtudiantRow = Prisma.NoteEtudiantGetPayload<{ select: typeof NOTE_ETUDIANT_SELECT }>;

/** Note + chaîne de propriété enseignant, en une seule requête (cf. create()). */
const NOTE_WITH_OWNERSHIP_SELECT = {
  id: true,
  epreuveId: true,
  inscriptionId: true,
  noteBrute: true,
  createdAt: true,
  updatedAt: true,
  epreuve: {
    select: {
      coursClasse: {
        select: {
          cours: {
            select: {
              enseignant: {
                select: {
                  personnel: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.NoteEtudiantSelect;

type NoteEtudiantWithOwnershipRow = Prisma.NoteEtudiantGetPayload<{
  select: typeof NOTE_WITH_OWNERSHIP_SELECT;
}>;

/**
 * La protection de suppression liée à NoteEtudiantHistory sera ajoutée à une
 * étape suivante validée séparément.
 */
@Injectable()
export class NoteEtudiantService {
  private readonly logger = new Logger(NoteEtudiantService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: ListNoteEtudiantQueryDto): Promise<NoteEtudiantResponseDto[]> {
    const rows = await this.prisma.noteEtudiant.findMany({
      where: {
        epreuveId: query.epreuveId,
        inscriptionId: query.inscriptionId,
      },
      select: NOTE_ETUDIANT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDto);
  }

  async findOne(id: string): Promise<NoteEtudiantResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(
    dto: CreateNoteEtudiantDto,
    currentUser: Pick<AuthenticatedUser, 'id' | 'roles'>,
  ): Promise<NoteEtudiantResponseDto> {
    // Récupéré avec la chaîne de propriété complète en une seule requête :
    // Epreuve → CoursClasse → CoursScenarise → Enseignant → Personnel.
    // Toutes ces relations sont obligatoires (FK NOT NULL) : si `epreuve`
    // existe, la chaîne entière existe nécessairement aussi.
    const epreuve = await this.prisma.epreuve.findUnique({
      where: { id: dto.epreuveId },
      include: {
        coursClasse: {
          include: {
            cours: {
              include: {
                enseignant: { include: { personnel: true } },
              },
            },
          },
        },
      },
    });
    if (!epreuve) {
      throw new NotFoundException(`Epreuve introuvable (id: ${dto.epreuveId})`);
    }

    const inscription = await this.prisma.inscription.findUnique({ where: { id: dto.inscriptionId } });
    if (!inscription) {
      throw new NotFoundException(`Inscription introuvable (id: ${dto.inscriptionId})`);
    }

    const existing = await this.prisma.noteEtudiant.findUnique({
      where: {
        epreuveId_inscriptionId: { epreuveId: dto.epreuveId, inscriptionId: dto.inscriptionId },
      },
    });
    if (existing) {
      throw new ConflictException('Une note existe déjà pour cette épreuve et cette inscription.');
    }

    const coursScenarise = epreuve.coursClasse.cours;

    if (coursScenarise.statutValidation !== StatutValidation.APPROUVE) {
      throw new ConflictException('Le cours doit être approuvé avant de pouvoir recevoir des notes.');
    }

    const isExempt = currentUser.roles.some((role) => OWNERSHIP_EXEMPT_ROLES.includes(role));
    if (!isExempt && coursScenarise.enseignant.personnel.userId !== currentUser.id) {
      throw new ForbiddenException("Vous n'êtes pas l'enseignant titulaire de ce cours.");
    }

    const created = await this.prisma.noteEtudiant.create({
      data: {
        epreuveId: dto.epreuveId,
        inscriptionId: dto.inscriptionId,
        noteBrute: dto.noteBrute,
      },
      select: NOTE_ETUDIANT_SELECT,
    });

    this.logger.log(
      `NoteEtudiant créée (epreuveId: ${dto.epreuveId}, inscriptionId: ${dto.inscriptionId}) par ${currentUser.id}`,
    );
    return this.toDto(created);
  }

  // ── Modification ──────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateNoteEtudiantDto,
    currentUser: Pick<AuthenticatedUser, 'id' | 'roles'>,
  ): Promise<NoteEtudiantResponseDto> {
    const note = await this.prisma.noteEtudiant.findUnique({
      where: { id },
      select: NOTE_WITH_OWNERSHIP_SELECT,
    });
    if (!note) {
      throw new NotFoundException(`NoteEtudiant introuvable (id: ${id})`);
    }

    const ownerUserId = note.epreuve.coursClasse.cours.enseignant.personnel.userId;
    const isExempt = currentUser.roles.some((role) => OWNERSHIP_EXEMPT_ROLES.includes(role));
    if (!isExempt && ownerUserId !== currentUser.id) {
      throw new ForbiddenException("Vous n'êtes pas l'enseignant titulaire de ce cours.");
    }

    const ancienneValeur = note.noteBrute;
    const nouvelleValeur = dto.noteBrute;

    if (Number(ancienneValeur) === nouvelleValeur) {
      return this.toDto(note);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.noteEtudiant.update({
        where: { id },
        data: { noteBrute: nouvelleValeur },
        select: NOTE_ETUDIANT_SELECT,
      });

      await tx.noteEtudiantHistory.create({
        data: {
          noteEtudiantId: id,
          ancienneValeur,
          nouvelleValeur,
          modifieParId: currentUser.id,
          motif: dto.motif ?? null,
        },
      });

      return row;
    });

    this.logger.log(`NoteEtudiant modifiée : ${id} par ${currentUser.id}`);
    return this.toDto(updated);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findRowOrThrow(id);

    const historyCount = await this.prisma.noteEtudiantHistory.count({
      where: { noteEtudiantId: id },
    });
    if (historyCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer la NoteEtudiant ${id} : un historique existe.`,
      );
    }

    await this.prisma.noteEtudiant.delete({ where: { id } });
    this.logger.log(`NoteEtudiant supprimée : ${id}`);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<NoteEtudiantRow> {
    const row = await this.prisma.noteEtudiant.findUnique({
      where: { id },
      select: NOTE_ETUDIANT_SELECT,
    });
    if (!row) throw new NotFoundException(`NoteEtudiant introuvable (id: ${id})`);
    return row;
  }

  private toDto(row: NoteEtudiantRow): NoteEtudiantResponseDto {
    return {
      id: row.id,
      epreuveId: row.epreuveId,
      inscriptionId: row.inscriptionId,
      noteBrute: Number(row.noteBrute),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
