import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleResponseDto } from './dto/role.response.dto';
import { RolesService } from './roles.service';

@ApiTags('Rôles & Permissions')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ── GET /api/v1/roles ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister tous les rôles avec leurs permissions' })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  findAll(): Promise<RoleResponseDto[]> {
    return this.rolesService.findAll();
  }

  // ── POST /api/v1/roles ───────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer un rôle' })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({ status: 201, type: RoleResponseDto })
  @ApiResponse({ status: 409, description: 'Nom de rôle déjà utilisé' })
  create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(dto);
  }

  // ── GET /api/v1/roles/:id ────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un rôle par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Rôle introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RoleResponseDto> {
    return this.rolesService.findOne(id);
  }

  // ── PATCH /api/v1/roles/:id ──────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Renommer un rôle' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(id, dto);
  }

  // ── DELETE /api/v1/roles/:id ─────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un rôle',
    description: 'Échoue si le rôle est encore attribué à au moins un utilisateur.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Rôle supprimé' })
  @ApiResponse({ status: 409, description: 'Rôle encore utilisé par des utilisateurs' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.rolesService.remove(id);
  }

  // ── POST /api/v1/roles/:id/permissions/:permissionId ────────────────────

  @Post(':id/permissions/:permissionId')
  @ApiOperation({ summary: 'Attribuer une permission à un rôle' })
  @ApiParam({ name: 'id', description: 'UUID du rôle', format: 'uuid' })
  @ApiParam({ name: 'permissionId', description: 'UUID de la permission', format: 'uuid' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  assignPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<RoleResponseDto> {
    return this.rolesService.assignPermission(id, permissionId);
  }

  // ── DELETE /api/v1/roles/:id/permissions/:permissionId ──────────────────

  @Delete(':id/permissions/:permissionId')
  @ApiOperation({ summary: 'Retirer une permission d\'un rôle' })
  @ApiParam({ name: 'id', description: 'UUID du rôle', format: 'uuid' })
  @ApiParam({ name: 'permissionId', description: 'UUID de la permission', format: 'uuid' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<RoleResponseDto> {
    return this.rolesService.removePermission(id, permissionId);
  }
}
