import { ApiProperty } from '@nestjs/swagger';
import { NatureRequete } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateRequeteDto {
  @ApiProperty({
    enum: NatureRequete,
    description: 'Détermine automatiquement le sous-service destinataire (voir NATURE_SOUS_SERVICE_MAP)',
  })
  @IsEnum(NatureRequete)
  nature: NatureRequete;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  description: string;
}
