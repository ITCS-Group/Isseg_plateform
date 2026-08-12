import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Diallo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nom?: string;

  @ApiPropertyOptional({ example: 'Abdourahmane' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  prenom?: string;

  @ApiPropertyOptional({ example: 'a.diallo@isseg.edu' })
  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email?: string;

  @ApiPropertyOptional({ example: true, description: 'Activer ou désactiver le compte' })
  @IsOptional()
  @IsBoolean()
  estActif?: boolean;
}
