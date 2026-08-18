import { Module } from '@nestjs/common';
import { NoteEtudiantController } from './note-etudiant.controller';
import { NoteEtudiantService } from './note-etudiant.service';

/**
 * Module NoteEtudiant (Pédagogie).
 *
 * PrismaService est fourni globalement par PrismaModule (@Global).
 */
@Module({
  controllers: [NoteEtudiantController],
  providers: [NoteEtudiantService],
  exports: [NoteEtudiantService],
})
export class NoteEtudiantModule {}
