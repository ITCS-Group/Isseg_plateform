import { Module } from '@nestjs/common';
import { EpreuveController } from './epreuve.controller';
import { EpreuveService } from './epreuve.service';

/**
 * Module Epreuve (Pédagogie).
 *
 * PrismaService est fourni globalement par PrismaModule (@Global).
 */
@Module({
  controllers: [EpreuveController],
  providers: [EpreuveService],
  exports: [EpreuveService],
})
export class EpreuveModule {}
