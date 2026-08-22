import { Module } from '@nestjs/common';
import { AbandonController } from './abandon.controller';
import { AbandonService } from './abandon.service';

/**
 * Module du workflow Abandon (déclaration + reprise).
 *
 * Expose le service de transition et son contrôleur HTTP mince.
 * Les guards (JWT, Roles) et le ValidationPipe sont globaux (AppModule/main.ts).
 * PrismaService est fourni globalement par PrismaModule (@Global).
 */
@Module({
  controllers: [AbandonController],
  providers: [AbandonService],
  exports: [AbandonService],
})
export class AbandonModule {}
