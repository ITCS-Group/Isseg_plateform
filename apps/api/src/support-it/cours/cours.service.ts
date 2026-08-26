import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CoursSupportITResponseDto, PaginatedCoursSupportITResponseDto } from './dto/cours.response.dto';
import { CreateCoursSupportITDto } from './dto/create-cours.dto';
import { ListCoursSupportITQueryDto } from './dto/list-cours-query.dto';

@Injectable()
export class CoursSupportITService {
  private readonly logger = new Logger(CoursSupportITService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCoursSupportITDto): Promise<CoursSupportITResponseDto> {
    const created = await this.prisma.coursSupportIT.create({ data: dto });
    this.logger.log(`Cours Support IT créé : ${created.id} (${created.titre})`);
    return created;
  }

  async findAll(query: ListCoursSupportITQueryDto): Promise<PaginatedCoursSupportITResponseDto> {
    const [data, total] = await Promise.all([
      this.prisma.coursSupportIT.findMany({
        orderBy: { titre: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coursSupportIT.count(),
    ]);

    const meta: PaginationMetaDto = {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { data, meta };
  }

  async findOne(id: string): Promise<CoursSupportITResponseDto> {
    const row = await this.prisma.coursSupportIT.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Cours Support IT introuvable (id: ${id})`);
    }
    return row;
  }
}
