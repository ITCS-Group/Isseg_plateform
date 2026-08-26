import { Module } from '@nestjs/common';
import { AttestationModule } from '../attestations/attestation.module';
import { InscriptionEnrollmentController } from './inscription-enrollment.controller';
import { InscriptionController } from './inscription.controller';
import { InscriptionCoursSupportITService } from './inscription.service';

@Module({
  imports: [AttestationModule],
  controllers: [InscriptionEnrollmentController, InscriptionController],
  providers: [InscriptionCoursSupportITService],
  exports: [InscriptionCoursSupportITService],
})
export class InscriptionCoursSupportITModule {}
