import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageResponseDto } from './dto/message.response.dto';
import { MessageService } from './message.service';

@ApiTags('Messagerie interne')
@ApiBearerAuth('JWT')
@Controller({ path: 'messages', version: '1' })
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @ApiOperation({ summary: 'Envoyer un message interne à un ou plusieurs destinataires' })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @ApiResponse({ status: 404, description: 'Un ou plusieurs destinataires introuvables' })
  create(
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.messageService.create(dto, user.id);
  }

  @Get('recus')
  @ApiOperation({ summary: 'Lister les messages reçus' })
  @ApiResponse({ status: 200, type: [MessageResponseDto] })
  findRecus(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto[]> {
    return this.messageService.findRecus(user.id);
  }

  @Get('envoyes')
  @ApiOperation({ summary: 'Lister les messages envoyés' })
  @ApiResponse({ status: 200, type: [MessageResponseDto] })
  findEnvoyes(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponseDto[]> {
    return this.messageService.findEnvoyes(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un message' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @ApiResponse({ status: 403, description: 'Ni expéditeur ni destinataire de ce message' })
  @ApiResponse({ status: 404, description: 'Message introuvable' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.messageService.findOne(id, user.id);
  }
}
