import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Diallo' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ example: 'Abdourahmane' })
  @IsString()
  @IsNotEmpty()
  prenom: string;

  @ApiProperty({ example: 'a.diallo@isseg.edu' })
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @ApiProperty({
    example: 'MotDePasse123!',
    description: 'Min. 8 caractères, au moins une majuscule, une minuscule et un chiffre',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
  motDePasse: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'UUIDs des rôles à attribuer à la création',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
