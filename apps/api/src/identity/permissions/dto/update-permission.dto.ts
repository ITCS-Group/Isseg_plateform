import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional({ example: 'WRITE_INSCRIPTIONS' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Le nom de la permission doit être en MAJUSCULES (ex: READ_USERS, WRITE_INSCRIPTIONS)',
  })
  nomPermission?: string;

  @ApiPropertyOptional({ example: 'Description mise à jour' })
  @IsOptional()
  @IsString()
  description?: string;
}
