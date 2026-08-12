import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionResponseDto } from './dto/permission.response.dto';

const PERMISSION_SELECT = {
  id: true,
  nomPermission: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PermissionSelect;

type PermissionRow = Prisma.PermissionGetPayload<{ select: typeof PERMISSION_SELECT }>;

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  async findAll(): Promise<PermissionResponseDto[]> {
    const rows = await this.prisma.permission.findMany({
      select: PERMISSION_SELECT,
      orderBy: { nomPermission: 'asc' },
    });
    return rows.map(this.toDto);
  }

  async findOne(id: string): Promise<PermissionResponseDto> {
    return this.toDto(await this.findRowOrThrow(id));
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(dto: CreatePermissionDto): Promise<PermissionResponseDto> {
    await this.assertNameFree(dto.nomPermission);

    const perm = await this.prisma.permission.create({
      data: dto,
      select: PERMISSION_SELECT,
    });

    this.logger.log(`Permission créée : ${perm.nomPermission}`);
    return this.toDto(perm);
  }

  // ── Mise à jour ───────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePermissionDto): Promise<PermissionResponseDto> {
    await this.findRowOrThrow(id);

    if (dto.nomPermission) await this.assertNameFree(dto.nomPermission, id);

    const perm = await this.prisma.permission.update({
      where: { id },
      data: dto,
      select: PERMISSION_SELECT,
    });

    return this.toDto(perm);
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findRowOrThrow(id);

    const rolesCount = await this.prisma.rolePermission.count({
      where: { permissionId: id },
    });

    if (rolesCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : cette permission est utilisée par ${rolesCount} rôle(s)`,
      );
    }

    await this.prisma.permission.delete({ where: { id } });
    this.logger.log(`Permission supprimée : ${id}`);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async findRowOrThrow(id: string): Promise<PermissionRow> {
    const perm = await this.prisma.permission.findUnique({ where: { id }, select: PERMISSION_SELECT });
    if (!perm) throw new NotFoundException(`Permission introuvable (id: ${id})`);
    return perm;
  }

  private async assertNameFree(nomPermission: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.permission.findUnique({ where: { nomPermission } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`La permission "${nomPermission}" existe déjà`);
    }
  }

  private toDto(perm: PermissionRow): PermissionResponseDto {
    return {
      id: perm.id,
      nomPermission: perm.nomPermission,
      description: perm.description,
      createdAt: perm.createdAt,
      updatedAt: perm.updatedAt,
    };
  }
}
