import { ApiProperty } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../interfaces/auth.interfaces';

export class UserProfileResponseDto implements AuthenticatedUser {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'jean.dupont@isseg.edu' })
  email: string;

  @ApiProperty({ example: 'Dupont' })
  nom: string;

  @ApiProperty({ example: 'Jean' })
  prenom: string;

  @ApiProperty({ example: true })
  estActif: boolean;

  @ApiProperty({
    type: [String],
    example: ['ADMIN', 'SCOLARITE'],
    description: 'Liste des rôles attribués à cet utilisateur',
  })
  roles: string[];

  @ApiProperty({
    type: [String],
    example: ['READ_USERS', 'WRITE_INSCRIPTIONS', 'VALIDATE_DOSSIER'],
    description: 'Permissions effectives (union de toutes les permissions des rôles)',
  })
  permissions: string[];
}
