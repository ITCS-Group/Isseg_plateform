import { Module } from '@nestjs/common';
import { CoursClasseController } from './cours-classe.controller';
import { CoursClasseService } from './cours-classe.service';

/**
 * Module CoursClasse (Pédagogie).
 *
 * PrismaService est fourni globalement par PrismaModule (@Global).
 */
@Module({
  controllers: [CoursClasseController],
  providers: [CoursClasseService],
  exports: [CoursClasseService],
})
export class CoursClasseModule {}
