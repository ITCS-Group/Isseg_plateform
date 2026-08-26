import { Module } from '@nestjs/common';
import { CoursSupportITController } from './cours.controller';
import { CoursSupportITService } from './cours.service';

@Module({
  controllers: [CoursSupportITController],
  providers: [CoursSupportITService],
  exports: [CoursSupportITService],
})
export class CoursSupportITModule {}
