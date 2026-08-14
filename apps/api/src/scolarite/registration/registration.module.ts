import { Module } from '@nestjs/common';
import { RegistrationWorkflowService } from './registration-workflow.service';

/**
 * Module du workflow d'inscription (B1.1).
 *
 * Expose uniquement le service de transition. Aucun contrôleur ni RBAC à ce
 * stade (le service est piloté par d'autres couches / testé directement).
 * PrismaService est fourni globalement par PrismaModule (@Global).
 */
@Module({
  providers: [RegistrationWorkflowService],
  exports: [RegistrationWorkflowService],
})
export class RegistrationModule {}
