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
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionResponseDto } from './dto/permission.response.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Rôles & Permissions')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister toutes les permissions' })
  @ApiResponse({ status: 200, type: [PermissionResponseDto] })
  findAll(): Promise<PermissionResponseDto[]> {
    return this.permissionsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Créer une permission' })
  @ApiBody({ type: CreatePermissionDto })
  @ApiResponse({ status: 201, type: PermissionResponseDto })
  @ApiResponse({ status: 409, description: 'Nom de permission déjà utilisé' })
  create(@Body() dto: CreatePermissionDto): Promise<PermissionResponseDto> {
    return this.permissionsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une permission par UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PermissionResponseDto })
  @ApiResponse({ status: 404, description: 'Permission introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PermissionResponseDto> {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une permission' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdatePermissionDto })
  @ApiResponse({ status: 200, type: PermissionResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionDto,
  ): Promise<PermissionResponseDto> {
    return this.permissionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une permission',
    description: 'Échoue si la permission est encore utilisée par au moins un rôle.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Permission supprimée' })
  @ApiResponse({ status: 409, description: 'Permission encore utilisée par des rôles' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.permissionsService.remove(id);
  }
}
