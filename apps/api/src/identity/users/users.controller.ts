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
  Query,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersResponseDto, UserResponseDto } from './dto/user.response.dto';
import { UsersService } from './users.service';

@ApiTags('Utilisateurs')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller({ path: 'utilisateurs', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── GET /api/v1/utilisateurs ────────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'SCOLARITE')
  @ApiOperation({ summary: 'Liste paginée des utilisateurs avec filtres' })
  @ApiResponse({ status: 200, type: PaginatedUsersResponseDto })
  findAll(@Query() query: QueryUserDto): Promise<PaginatedUsersResponseDto> {
    return this.usersService.findAll(query);
  }

  // ── POST /api/v1/utilisateurs ───────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  // ── GET /api/v1/utilisateurs/:id ────────────────────────────────────────────────

  @Get(':id')
  @Roles('ADMIN', 'SCOLARITE')
  @ApiOperation({ summary: 'Récupérer un utilisateur par son UUID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  // ── PATCH /api/v1/utilisateurs/:id ──────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier nom, prénom, email ou statut actif' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  // ── DELETE /api/v1/utilisateurs/:id ─────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Désactiver un utilisateur (soft delete)',
    description: 'Le compte est désactivé (estActif = false) et sa session révoquée. Aucune donnée n\'est supprimée.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Utilisateur désactivé' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  // ── PATCH /api/v1/utilisateurs/:id/password ────────────────────────────────────

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Réinitialiser le mot de passe d\'un utilisateur',
    description: 'Le nouveau mot de passe est haché (bcrypt). Toutes les sessions actives sont révoquées.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 204, description: 'Mot de passe modifié' })
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(id, dto);
  }

  // ── POST /api/v1/utilisateurs/:id/roles/:roleId ─────────────────────────────────

  @Post(':id/roles/:roleId')
  @ApiOperation({ summary: 'Attribuer un rôle à un utilisateur' })
  @ApiParam({ name: 'id', description: 'UUID de l\'utilisateur', format: 'uuid' })
  @ApiParam({ name: 'roleId', description: 'UUID du rôle', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserResponseDto, description: 'Utilisateur avec rôles mis à jour' })
  @ApiResponse({ status: 404, description: 'Utilisateur ou rôle introuvable' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.assignRole(id, roleId);
  }

  // ── DELETE /api/v1/utilisateurs/:id/roles/:roleId ───────────────────────────────

  @Delete(':id/roles/:roleId')
  @ApiOperation({ summary: 'Retirer un rôle d\'un utilisateur' })
  @ApiParam({ name: 'id', description: 'UUID de l\'utilisateur', format: 'uuid' })
  @ApiParam({ name: 'roleId', description: 'UUID du rôle', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserResponseDto, description: 'Utilisateur avec rôles mis à jour' })
  @ApiResponse({ status: 404, description: 'Association utilisateur-rôle introuvable' })
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.removeRole(id, roleId);
  }
}
