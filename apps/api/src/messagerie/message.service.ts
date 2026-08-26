import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaginationMetaDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessageQueryDto } from './dto/list-message-query.dto';
import { MessageResponseDto, PaginatedMessageResponseDto } from './dto/message.response.dto';

const MESSAGE_SELECT = {
  id: true,
  expediteurId: true,
  contenu: true,
  date: true,
  createdAt: true,
  expediteur: { select: { nom: true, prenom: true } },
  destinataires: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.MessageInterneSelect;

type MessageRow = Prisma.MessageInterneGetPayload<{ select: typeof MESSAGE_SELECT }>;

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageDto, expediteurId: string): Promise<MessageResponseDto> {
    const destinatairesExistants = await this.prisma.utilisateur.count({
      where: { id: { in: dto.destinataireIds } },
    });
    if (destinatairesExistants !== dto.destinataireIds.length) {
      throw new NotFoundException('Un ou plusieurs destinataires sont introuvables.');
    }

    const created = await this.prisma.messageInterne.create({
      data: {
        expediteurId,
        contenu: dto.contenu,
        destinataires: { connect: dto.destinataireIds.map((id) => ({ id })) },
      },
      select: MESSAGE_SELECT,
    });

    this.logger.log(`Message créé (id: ${created.id}, expediteurId: ${expediteurId})`);
    return this.toDto(created);
  }

  findRecus(query: ListMessageQueryDto, utilisateurId: string): Promise<PaginatedMessageResponseDto> {
    return this.findPaginated(query, { destinataires: { some: { id: utilisateurId } } });
  }

  findEnvoyes(query: ListMessageQueryDto, utilisateurId: string): Promise<PaginatedMessageResponseDto> {
    return this.findPaginated(query, { expediteurId: utilisateurId });
  }

  private async findPaginated(
    query: ListMessageQueryDto,
    where: Prisma.MessageInterneWhereInput,
  ): Promise<PaginatedMessageResponseDto> {
    const [rows, total] = await Promise.all([
      this.prisma.messageInterne.findMany({
        where,
        select: MESSAGE_SELECT,
        orderBy: { date: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.messageInterne.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  async findOne(id: string, utilisateurId: string): Promise<MessageResponseDto> {
    const row = await this.prisma.messageInterne.findUnique({ where: { id }, select: MESSAGE_SELECT });
    if (!row) {
      throw new NotFoundException(`Message introuvable (id: ${id})`);
    }

    const estExpediteur = row.expediteurId === utilisateurId;
    const estDestinataire = row.destinataires.some((d) => d.id === utilisateurId);
    if (!estExpediteur && !estDestinataire) {
      throw new ForbiddenException("Vous n'avez pas accès à ce message.");
    }

    return this.toDto(row);
  }

  private toDto(row: MessageRow): MessageResponseDto {
    return {
      id: row.id,
      expediteurId: row.expediteurId,
      expediteurNom: row.expediteur.nom,
      expediteurPrenom: row.expediteur.prenom,
      destinataires: row.destinataires,
      contenu: row.contenu,
      date: row.date,
      createdAt: row.createdAt,
    };
  }
}
