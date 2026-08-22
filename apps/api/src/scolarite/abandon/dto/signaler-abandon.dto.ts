import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * DTO de signalement d'un abandon (création, statut initial CONSTATE).
 *
 * `signaleParId` provient EXCLUSIVEMENT du JWT (jamais du body).
 */
export class SignalerAbandonDto {
  @ApiProperty({ format: 'uuid', description: 'UUID de l\'étudiant concerné' })
  @IsUUID()
  etudiantId: string;

  @ApiProperty({ format: 'uuid', description: 'UUID de l\'année universitaire concernée' })
  @IsUUID()
  anneeId: string;
}
