import { Module } from '@nestjs/common';
import { AttestationModule } from './attestations/attestation.module';
import { CoursSupportITModule } from './cours/cours.module';
import { InscriptionCoursSupportITModule } from './inscriptions/inscription.module';
import { InterventionModule } from './interventions/intervention.module';
import { RequeteModule } from './requetes/requete.module';

/**
 * Module barrel regroupant tous les sous-modules du domaine Support
 * Informatique. Importer uniquement SupportItModule dans AppModule.
 * (La Messagerie est transverse et vit hors de ce module — voir
 * src/messagerie/.)
 */
@Module({
  imports: [RequeteModule, InterventionModule, CoursSupportITModule, InscriptionCoursSupportITModule, AttestationModule],
  exports: [RequeteModule, InterventionModule, CoursSupportITModule, InscriptionCoursSupportITModule],
})
export class SupportItModule {}
