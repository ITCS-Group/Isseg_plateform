import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de réponse contenant uniquement l'access token.
 * Le refresh token est transmis via un cookie HttpOnly sécurisé.
 */
export class AccessTokenResponseDto {
  @ApiProperty({
    description: "Token JWT d'accès à inclure dans l'en-tête Authorization: Bearer <token>",
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}
