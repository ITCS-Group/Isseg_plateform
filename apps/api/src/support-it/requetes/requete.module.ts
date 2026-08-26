import { Module } from '@nestjs/common';
import { RequeteController } from './requete.controller';
import { RequeteService } from './requete.service';

@Module({
  controllers: [RequeteController],
  providers: [RequeteService],
  exports: [RequeteService],
})
export class RequeteModule {}
