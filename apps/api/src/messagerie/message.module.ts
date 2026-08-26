import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

/**
 * Module transverse — Messagerie interne. Remplace l'ancien modèle
 * Message (Parent), mort et jamais branché (voir schema.prisma). Ne vit
 * pas sous support-it/ : sert Support IT et tout usage futur (Portail
 * Parent inclus).
 */
@Module({
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
