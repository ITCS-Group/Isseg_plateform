import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginatedUsersResponseDto,
  UserResponseDto,
} from './dto/user.response.dto';

// ── Sélection Prisma sans données sensibles ─────────────────────────────────

const USER_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  estActif: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: { select: { id: true, nomRole: true } },
    },
  },
} satisfies Prisma.UtilisateurSelect;

type UserRow = Prisma.UtilisateurGetPayload<{ select: typeof USER_SELECT }>;

const BCRYPT_ROUNDS = 12;

// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: QueryUserDto): Promise<PaginatedUsersResponseDto> {
    const { page, limit, nom, email, estActif, roleId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UtilisateurWhereInput = {
      ...(nom && {
        OR: [
          { nom: { contains: nom, mode: 'insensitive' } },
          { prenom: { contains: nom, mode: 'insensitive' } },
        ],
      }),
      ...(email && { email: { contains: email, mode: 'insensitive' } }),
      ...(estActif !== undefined && { estActif }),
      ...(roleId && { roles: { some: { roleId } } }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where,
        select: USER_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.utilisateur.count({ where }),
    ]);

    return {
      data: rows.map(this.toDto),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    await this.assertEmailFree(dto.email);

    const hash = await bcrypt.hash(dto.motDePasse, BCRYPT_ROUNDS);

    const user = await this.prisma.utilisateur.create({
      data: {
        nom: dto.nom,
        prenom: dto.prenom,
        email: dto.email,
        motDePasseHash: hash,
        ...(dto.roleIds?.length && {
          roles: {
            create: dto.roleIds.map((roleId) => ({ roleId })),
          },
        }),
      },
      select: USER_SELECT,
    });

    this.logger.log(`Utilisateur créé : ${user.email}`);
    return this.toDto(user);
  }

  // ── Mise à jour ───────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.findRowOrThrow(id);

    if (dto.email) await this.assertEmailFree(dto.email, id);

    const user = await this.prisma.utilisateur.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });

    return this.toDto(user);
  }

  // ── Désactivation (soft delete) ───────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findRowOrThrow(id);

    // TODO: Révoquer les refresh tokens actifs dans la table RefreshToken
    await this.prisma.utilisateur.update({
      where: { id },
      data: { estActif: false },
    });

    this.logger.log(`Utilisateur désactivé : ${id}`);
  }

  // ── Changement de mot de passe ────────────────────────────────────────────

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    await this.findRowOrThrow(id);

    const hash = await bcrypt.hash(dto.nouveauMotDePasse, BCRYPT_ROUNDS);

    // TODO: Révoquer les refresh tokens actifs dans la table RefreshToken
    await this.prisma.utilisateur.update({
      where: { id },
      data: { motDePasseHash: hash },
    });

    this.logger.log(`Mot de passe modifié pour l'utilisateur ${id}`);
  }

  // ── Gestion des rôles ─────────────────────────────────────────────────────

  async assignRole(userId: string, roleId: string): Promise<UserResponseDto> {
    await this.findRowOrThrow(userId);
    await this.assertRoleExists(roleId);

    await this.prisma.utilisateurRole.upsert({
      where: { utilisateurId_roleId: { utilisateurId: userId, roleId } },
      create: { utilisateurId: userId, roleId },
      update: {},
    });

    this.logger.log(`Rôle ${roleId} attribué à l'utilisateur ${userId}`);
    return this.findOne(userId);
  }

  async removeRole(userId: string, roleId: string): Promise<UserResponseDto> {
    await this.findRowOrThrow(userId);

    const link = await this.prisma.utilisateurRole.findUnique({
      where: { utilisateurId_roleId: { utilisateurId: userId, roleId } },
    });

    if (!link) {
      throw new NotFoundException('Ce rôle n\'est pas attribué à cet utilisateur');
    }

    await this.prisma.utilisateurRole.delete({
      where: { utilisateurId_roleId: { utilisateurId: userId, roleId } },
    });

    this.logger.log(`Rôle ${roleId} retiré de l'utilisateur ${userId}`);
    return this.findOne(userId);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<UserRow> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException(`Utilisateur introuvable (id: ${id})`);
    return user;
  }

  private async assertEmailFree(email: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.utilisateur.findUnique({ where: { email } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`L'adresse e-mail "${email}" est déjà utilisée`);
    }
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Rôle introuvable (id: ${roleId})`);
  }

  private toDto(user: UserRow): UserResponseDto {
    return {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      estActif: user.estActif,
      roles: user.roles.map((ur) => ur.role),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
