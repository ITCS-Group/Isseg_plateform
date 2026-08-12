import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class RoleBasicDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'ADMIN' })
  nomRole: string;
}

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Diallo' })
  nom: string;

  @ApiProperty({ example: 'Abdourahmane' })
  prenom: string;

  @ApiProperty({ example: 'a.diallo@isseg.edu' })
  email: string;

  @ApiProperty({ example: true })
  estActif: boolean;

  @ApiProperty({ type: [RoleBasicDto] })
  roles: RoleBasicDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
