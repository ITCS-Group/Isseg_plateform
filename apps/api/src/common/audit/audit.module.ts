import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Module global, sur le modèle de PrismaModule.
 *
 * L'audit est une préoccupation transverse consommée par une quinzaine de
 * modules métier. Le déclarer global évite d'ajouter un import dans chacun
 * d'eux, exactement comme le fait déjà PrismaModule pour PrismaService.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
