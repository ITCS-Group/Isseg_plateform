import { Module } from '@nestjs/common';
import { OuvrageController } from './ouvrage.controller';
import { OuvrageService } from './ouvrage.service';

@Module({
  controllers: [OuvrageController],
  providers: [OuvrageService],
  exports: [OuvrageService],
})
export class OuvrageModule {}
