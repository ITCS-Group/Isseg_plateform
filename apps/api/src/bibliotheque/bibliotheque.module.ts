import { Module } from '@nestjs/common';
import { AbonneModule } from './abonnes/abonne.module';
import { DocumentAcademiqueModule } from './documents-academiques/document-academique.module';
import { EmpruntModule } from './emprunts/emprunt.module';
import { OuvrageModule } from './ouvrages/ouvrage.module';
import { ReservationModule } from './reservations/reservation.module';
import { StatsModule } from './stats/stats.module';

/**
 * Module barrel regroupant tous les sous-modules du domaine Bibliothèque.
 * Importer uniquement BibliothequeModule dans AppModule.
 */
@Module({
  imports: [
    OuvrageModule,
    AbonneModule,
    EmpruntModule,
    ReservationModule,
    DocumentAcademiqueModule,
    StatsModule,
  ],
  exports: [OuvrageModule, AbonneModule, EmpruntModule, ReservationModule, DocumentAcademiqueModule],
})
export class BibliothequeModule {}
