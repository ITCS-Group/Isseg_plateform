import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'SCOLARITE_SENIOR' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Le nom du rôle doit être en MAJUSCULES (ex: ADMIN, SCOLARITE)',
  })
  nomRole?: string;
}
