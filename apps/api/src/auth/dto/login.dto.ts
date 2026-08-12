import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'jean.dupont@isseg.edu',
    description: 'Adresse e-mail de l\'utilisateur',
  })
  @IsEmail({}, { message: 'L\'adresse e-mail est invalide' })
  email: string;

  @ApiProperty({
    example: 'MotDePasse123!',
    description: 'Mot de passe (minimum 8 caractères)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  motDePasse: string;
}
