import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'WRITE_INSCRIPTIONS',
    description: 'Nom de la permission en MAJUSCULES_SNAKE_CASE, format ACTION_RESSOURCE',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Le nom de la permission doit être en MAJUSCULES (ex: READ_USERS, WRITE_INSCRIPTIONS)',
  })
  nomPermission: string;

  @ApiPropertyOptional({ example: 'Permet de créer et modifier des inscriptions étudiantes' })
  @IsOptional()
  @IsString()
  description?: string;
}
