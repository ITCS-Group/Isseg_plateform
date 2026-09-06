import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRoleQueryDto } from './dto/list-role-query.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginatedRoleResponseDto, RoleResponseDto } from './dto/role.response.dto';

// ── Sélection Prisma ─────────────────────────────────────────────────────────

const ROLE_SELECT = {
  id: true,
  nomRole: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      permission: { select: { id: true, nomPermission: true, description: true } },
    },
  },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof ROLE_SELECT }>;

// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(query: ListRoleQueryDto): Promise<PaginatedRoleResponseDto> {
    // Aucun filtre métier sur cet endpoint : le même `where` (vide) est passé
    // à findMany et à count, pour que meta.total reste cohérent si un filtre
    // est ajouté plus tard.
    const where: Prisma.RoleWhereInput = {};

    const [rows, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        select: ROLE_SELECT,
        orderBy: { nomRole: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.role.count({ where }),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data: rows.map(this.toDto), meta };
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    await this.assertNameFree(dto.nomRole);

    const role = await this.prisma.role.create({
      data: {
        nomRole: dto.nomRole,
        ...(dto.permissionIds?.length && {
          permissions: {
            create: dto.permissionIds.map((permissionId) => ({ permissionId })),
          },
        }),
      },
      select: ROLE_SELECT,
    });

    this.logger.log(`Rôle créé : ${role.nomRole}`);
    return this.toDto(role);
  }

  // ── Mise à jour ───────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    await this.findRowOrThrow(id);

    if (dto.nomRole) await this.assertNameFree(dto.nomRole, id);

    const role = await this.prisma.role.update({
      where: { id },
      data: dto,
      select: ROLE_SELECT,
    });

    return this.toDto(role);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findRowOrThrow(id);

    const usersCount = await this.prisma.utilisateurRole.count({
      where: { roleId: id },
    });

    if (usersCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ce rôle est attribué à ${usersCount} utilisateur(s)`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    this.logger.log(`Rôle supprimé : ${id}`);
  }

  // ── Gestion des permissions ───────────────────────────────────────────────

  async assignPermission(roleId: string, permissionId: string): Promise<RoleResponseDto> {
    await this.findRowOrThrow(roleId);
    await this.assertPermissionExists(permissionId);

    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {},
    });

    this.logger.log(`Permission ${permissionId} attribuée au rôle ${roleId}`);
    return this.findOne(roleId);
  }

  async removePermission(roleId: string, permissionId: string): Promise<RoleResponseDto> {
    await this.findRowOrThrow(roleId);

    const link = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });

    if (!link) {
      throw new NotFoundException('Cette permission n\'est pas attribuée à ce rôle');
    }

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });

    this.logger.log(`Permission ${permissionId} retirée du rôle ${roleId}`);
    return this.findOne(roleId);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<RoleRow> {
    const role = await this.prisma.role.findUnique({ where: { id }, select: ROLE_SELECT });
    if (!role) throw new NotFoundException(`Rôle introuvable (id: ${id})`);
    return role;
  }

  private async assertNameFree(nomRole: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.role.findUnique({ where: { nomRole } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Le rôle "${nomRole}" existe déjà`);
    }
  }

  private async assertPermissionExists(permissionId: string): Promise<void> {
    const perm = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!perm) throw new NotFoundException(`Permission introuvable (id: ${permissionId})`);
  }

  private toDto(role: RoleRow): RoleResponseDto {
    return {
      id: role.id,
      nomRole: role.nomRole,
      permissions: role.permissions.map((rp) => rp.permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
