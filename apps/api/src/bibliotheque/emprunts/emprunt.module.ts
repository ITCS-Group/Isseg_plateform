import { Module } from '@nestjs/common';
import { RegularityModule } from '../../scolarite/regularity/regularity.module';
import { EmpruntController } from './emprunt.controller';
import { EmpruntService } from './emprunt.service';

@Module({
  imports: [RegularityModule],
  controllers: [EmpruntController],
  providers: [EmpruntService],
  exports: [EmpruntService],
})
export class EmpruntModule {}
