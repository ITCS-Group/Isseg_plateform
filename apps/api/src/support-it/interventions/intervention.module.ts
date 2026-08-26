import { Module } from '@nestjs/common';
import { InterventionController } from './intervention.controller';
import { InterventionService } from './intervention.service';

@Module({
  controllers: [InterventionController],
  providers: [InterventionService],
  exports: [InterventionService],
})
export class InterventionModule {}
