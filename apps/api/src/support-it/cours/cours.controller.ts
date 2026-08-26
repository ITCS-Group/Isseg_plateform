import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CoursSupportITService } from './cours.service';
import { CoursSupportITResponseDto, PaginatedCoursSupportITResponseDto } from './dto/cours.response.dto';
import { CreateCoursSupportITDto } from './dto/create-cours.dto';
import { ListCoursSupportITQueryDto } from './dto/list-cours-query.dto';

@ApiTags('Support IT — Cours')
@ApiBearerAuth('JWT')
@Controller({ path: 'cours-support-it', version: '1' })
export class CoursSupportITController {
  constructor(private readonly coursService: CoursSupportITService) {}

  @Post()
  @Roles('RESPONSABLE_IT', 'ADMIN')
  @ApiOperation({ summary: 'Créer un cours Support IT' })
  @ApiBody({ type: CreateCoursSupportITDto })
  @ApiResponse({ status: 201, type: CoursSupportITResponseDto })
  create(@Body() dto: CreateCoursSupportITDto): Promise<CoursSupportITResponseDto> {
    return this.coursService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les cours Support IT' })
  @ApiResponse({ status: 200, type: PaginatedCoursSupportITResponseDto })
  findAll(@Query() query: ListCoursSupportITQueryDto): Promise<PaginatedCoursSupportITResponseDto> {
    return this.coursService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un cours Support IT' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CoursSupportITResponseDto })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CoursSupportITResponseDto> {
    return this.coursService.findOne(id);
  }
}
