import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../common/audit/audit.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  async create(dto: CreateUserDto, actorId: string): Promise<UserResponseDto> {
    await this.assertEmailFree(dto.email);

    const hash = await bcrypt.hash(dto.motDePasse, BCRYPT_ROUNDS);

    // Création et audit dans la même transaction : un compte créé sans trace
    // serait un angle mort, la création de compte étant l'opération la plus
    // sensible du module.
    const user = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.utilisateur.create({
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

      await this.audit.record(tx, {
        action: 'CREATE',
        entity: 'Utilisateur',
        entityId: cree.id,
        actorId,
        // Ni dto.motDePasse ni le hash ne sont transmis : le mot de passe n'a
        // aucune raison d'apparaître dans une trace d'audit.
        details: {
          email: cree.email,
          nom: cree.nom,
          prenom: cree.prenom,
          estActif: cree.estActif,
          roleIds: dto.roleIds ?? [],
        },
      });

      return cree;
    });

    this.logger.log(`Utilisateur créé : ${user.email}`);
    return this.toDto(user);
  }

  // ── Mise à jour ───────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this.findRowOrThrow(id);

    if (dto.email) await this.assertEmailFree(dto.email, id);

    const user = await this.prisma.$transaction(async (tx) => {
      const modifie = await tx.utilisateur.update({
        where: { id },
        data: dto,
        select: USER_SELECT,
      });

      await this.audit.record(tx, {
        action: 'UPDATE',
        entity: 'Utilisateur',
        entityId: id,
        actorId,
        // On journalise les NOMS des champs modifiés, pas leurs valeurs :
        // l'audit doit dire ce qui a bougé, l'état courant reste en base.
        details: { champsModifies: Object.keys(dto) },
      });

      return modifie;
    });

    return this.toDto(user);
  }

  // ── Désactivation (soft delete) ───────────────────────────────────────────

  async remove(id: string, actorId: string): Promise<void> {
    await this.findRowOrThrow(id);

    // Désactivation, révocation des sessions et audit dans la MÊME transaction :
    // un échec partiel laisserait un compte désactivé conservant des refresh
    // tokens valides, donc la capacité d'obtenir de nouveaux access tokens
    // pendant toute leur durée de vie (7 jours).
    const revoquesCount = await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id },
        data: { estActif: false },
      });

      const revoques = await tx.refreshToken.updateMany({
        where: { utilisateurId: id, isRevoked: false },
        data: { isRevoked: true },
      });

      await this.audit.record(tx, {
        action: 'DELETE',
        entity: 'Utilisateur',
        entityId: id,
        actorId,
        details: {
          typeSuppression: 'desactivation',
          refreshTokensRevoques: revoques.count,
        },
      });

      return revoques.count;
    });

    this.logger.log(
      `Utilisateur désactivé : ${id} (${revoquesCount} refresh token(s) révoqué(s))`,
    );
  }

  // ── Changement de mot de passe ────────────────────────────────────────────

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    actorId: string,
  ): Promise<void> {
    await this.findRowOrThrow(id);

    const hash = await bcrypt.hash(dto.nouveauMotDePasse, BCRYPT_ROUNDS);

    // Nouveau hash, révocation des sessions et audit dans la MÊME transaction :
    // un changement de mot de passe doit faire tomber les sessions ouvertes,
    // sans quoi un refresh token volé resterait exploitable après la mesure
    // de remédiation.
    const revoquesCount = await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id },
        data: { motDePasseHash: hash },
      });

      const revoques = await tx.refreshToken.updateMany({
        where: { utilisateurId: id, isRevoked: false },
        data: { isRevoked: true },
      });

      await this.audit.record(tx, {
        action: 'UPDATE',
        entity: 'Utilisateur',
        entityId: id,
        actorId,
        // Le fait est journalisé, jamais la valeur : ni le mot de passe en
        // clair, ni son hash, ne doivent transiter par AuditLog.
        details: {
          motDePasseModifie: true,
          refreshTokensRevoques: revoques.count,
        },
      });

      return revoques.count;
    });

    this.logger.log(
      `Mot de passe modifié pour l'utilisateur ${id} (${revoquesCount} refresh token(s) révoqué(s))`,
    );
  }

  // ── Gestion des rôles ─────────────────────────────────────────────────────

  async assignRole(
    userId: string,
    roleId: string,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this.findRowOrThrow(userId);
    const role = await this.assertRoleExists(roleId);

    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateurRole.upsert({
        where: { utilisateurId_roleId: { utilisateurId: userId, roleId } },
        create: { utilisateurId: userId, roleId },
        update: {},
      });

      // La cible est l'UTILISATEUR, pas la table de liaison : la question à
      // laquelle l'audit répond est « qu'est-il arrivé à ce compte ».
      await this.audit.record(tx, {
        action: 'CREATE',
        entity: 'Utilisateur',
        entityId: userId,
        actorId,
        details: { roleId, roleNom: role.nomRole },
      });
    });

    this.logger.log(`Rôle ${roleId} attribué à l'utilisateur ${userId}`);
    return this.findOne(userId);
  }

  async removeRole(
    userId: string,
    roleId: string,
    actorId: string,
  ): Promise<UserResponseDto> {
    await this.findRowOrThrow(userId);

    const link = await this.prisma.utilisateurRole.findUnique({
      where: { utilisateurId_roleId: { utilisateurId: userId, roleId } },
      include: { role: { select: { nomRole: true } } },
    });

    if (!link) {
      throw new NotFoundException('Ce rôle n\'est pas attribué à cet utilisateur');
    }

    // Le nom du rôle est capturé AVANT la suppression du lien : l'audit ne doit
    // jamais dépendre d'une relecture de ce qu'il vient de supprimer.
    const roleNom = link.role.nomRole;

    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateurRole.delete({
        where: { utilisateurId_roleId: { utilisateurId: userId, roleId } },
      });

      await this.audit.record(tx, {
        action: 'DELETE',
        entity: 'Utilisateur',
        entityId: userId,
        actorId,
        details: { roleId, roleNom },
      });
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

  private async assertRoleExists(roleId: string): Promise<{ nomRole: string }> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { nomRole: true },
    });
    if (!role) throw new NotFoundException(`Rôle introuvable (id: ${roleId})`);
    return role;
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
