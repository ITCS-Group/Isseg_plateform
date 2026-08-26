import { Module } from '@nestjs/common';
import { InterventionModule } from './interventions/intervention.module';
import { RequeteModule } from './requetes/requete.module';

/**
 * Module barrel regroupant tous les sous-modules du domaine Support
 * Informatique. Importer uniquement SupportItModule dans AppModule.
 * (La Messagerie est transverse et vit hors de ce module — voir
 * src/messagerie/.)
 */
@Module({
  imports: [RequeteModule, InterventionModule],
  exports: [RequeteModule, InterventionModule],
})
export class SupportItModule {}
