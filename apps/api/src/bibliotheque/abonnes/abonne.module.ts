import { Module } from '@nestjs/common';
import { AbonneController } from './abonne.controller';
import { AbonneService } from './abonne.service';

@Module({
  controllers: [AbonneController],
  providers: [AbonneService],
  exports: [AbonneService],
})
export class AbonneModule {}
