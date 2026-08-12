import { ApiProperty } from '@nestjs/swagger';
import type { AuthTokens } from '../interfaces/auth.interfaces';

export class AuthTokensResponseDto implements AuthTokens {
  @ApiProperty({
    description: "Token JWT d'accès à inclure dans l'en-tête Authorization: Bearer <token>",
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token de rafraîchissement (stocker de façon sécurisée côté client)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}
