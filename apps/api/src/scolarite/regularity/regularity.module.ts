import { Module } from '@nestjs/common';
import { RegularityController } from './regularity.controller';
import { RegularityService } from './regularity.service';

@Module({
  controllers: [RegularityController],
  providers: [RegularityService],
  exports: [RegularityService],
})
export class RegularityModule {}
