import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    example: 'SCOLARITE',
    description: 'Nom du rôle en MAJUSCULES_SNAKE_CASE',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Le nom du rôle doit être en MAJUSCULES (ex: ADMIN, SCOLARITE, DGA_ETUDES)',
  })
  nomRole: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'UUIDs des permissions à attribuer à la création',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
