import { Module } from '@nestjs/common';
import { PosteController } from './poste.controller';
import { PosteService } from './poste.service';

@Module({
  controllers: [PosteController],
  providers: [PosteService],
  exports: [PosteService],
})
export class PosteModule {}
