import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CoursSupportITResponseDto } from './dto/cours.response.dto';
import { CreateCoursSupportITDto } from './dto/create-cours.dto';

@Injectable()
export class CoursSupportITService {
  private readonly logger = new Logger(CoursSupportITService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCoursSupportITDto): Promise<CoursSupportITResponseDto> {
    const created = await this.prisma.coursSupportIT.create({ data: dto });
    this.logger.log(`Cours Support IT créé : ${created.id} (${created.titre})`);
    return created;
  }

  findAll(): Promise<CoursSupportITResponseDto[]> {
    return this.prisma.coursSupportIT.findMany({ orderBy: { titre: 'asc' } });
  }

  async findOne(id: string): Promise<CoursSupportITResponseDto> {
    const row = await this.prisma.coursSupportIT.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Cours Support IT introuvable (id: ${id})`);
    }
    return row;
  }
}
