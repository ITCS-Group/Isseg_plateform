import { Module } from '@nestjs/common';
import { DocumentAcademiqueController } from './document-academique.controller';
import { DocumentAcademiqueService } from './document-academique.service';

@Module({
  controllers: [DocumentAcademiqueController],
  providers: [DocumentAcademiqueService],
  exports: [DocumentAcademiqueService],
})
export class DocumentAcademiqueModule {}
