import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionBasicDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'WRITE_INSCRIPTIONS' })
  nomPermission: string;

  @ApiPropertyOptional({ example: 'Permet de créer et modifier des inscriptions' })
  description?: string | null;
}

export class RoleResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'SCOLARITE' })
  nomRole: string;

  @ApiProperty({ type: [PermissionBasicDto] })
  permissions: PermissionBasicDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
