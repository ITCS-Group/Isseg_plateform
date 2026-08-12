import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Token de rafraîchissement reçu lors du login',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le token de rafraîchissement est requis' })
  refreshToken: string;
}
