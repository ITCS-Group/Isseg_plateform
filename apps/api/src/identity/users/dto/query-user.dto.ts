import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'diallo', description: 'Recherche partielle sur le nom ou prénom' })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({ example: 'a.diallo@isseg.edu', description: 'Recherche partielle sur l\'email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: true, description: 'Filtrer par statut actif/inactif' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  estActif?: boolean;

  @ApiPropertyOptional({ description: 'Filtrer par UUID de rôle' })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;
}
