import { Module } from '@nestjs/common';
import { DossierInscriptionQueryService } from './dossier-inscription-query.service';
import { RegistrationController } from './registration.controller';
import { RegistrationWorkflowService } from './registration-workflow.service';

/**
 * Module du workflow d'inscription (B1.1) + lecture (listing/stats).
 *
 * Expose le service de transition, le service de lecture, et son contrôleur
 * HTTP mince. Les guards (JWT, Roles) et le ValidationPipe sont globaux
 * (AppModule/main.ts). PrismaService est fourni globalement par PrismaModule
 * (@Global).
 */
@Module({
  controllers: [RegistrationController],
  providers: [RegistrationWorkflowService, DossierInscriptionQueryService],
  exports: [RegistrationWorkflowService],
})
export class RegistrationModule {}
