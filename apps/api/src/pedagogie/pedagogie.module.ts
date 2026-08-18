import { Module } from '@nestjs/common';
import { CoursClasseModule } from './cours-classe/cours-classe.module';
import { EpreuveModule } from './epreuve/epreuve.module';
import { NoteEtudiantModule } from './note-etudiant/note-etudiant.module';

/**
 * Module barrel regroupant tous les sous-modules du domaine Pédagogie.
 * Importer uniquement PedagogieModule dans AppModule.
 */
@Module({
  imports: [CoursClasseModule, EpreuveModule, NoteEtudiantModule],
  exports: [CoursClasseModule, EpreuveModule, NoteEtudiantModule],
})
export class PedagogieModule {}
