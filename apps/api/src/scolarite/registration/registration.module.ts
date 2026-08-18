import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationWorkflowService } from './registration-workflow.service';

/**
 * Module du workflow d'inscription (B1.1).
 *
 * Expose le service de transition et son contrôleur HTTP mince.
 * Les guards (JWT, Roles) et le ValidationPipe sont globaux (AppModule/main.ts).
 * PrismaService est fourni globalement par PrismaModule (@Global).
 */
@Module({
  controllers: [RegistrationController],
  providers: [RegistrationWorkflowService],
  exports: [RegistrationWorkflowService],
})
export class RegistrationModule {}
