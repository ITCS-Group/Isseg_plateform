import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RegularityModule } from '../../scolarite/regularity/regularity.module';
import { EmpruntController } from './emprunt.controller';
import { EmpruntService } from './emprunt.service';

@Module({
  // Import explicite de ConfigModule — garantit la disponibilité de
  // ConfigService même si le module global n'est pas initialisé (cf. AuthModule).
  imports: [RegularityModule, ConfigModule],
  controllers: [EmpruntController],
  providers: [EmpruntService],
  exports: [EmpruntService],
})
export class EmpruntModule {}
