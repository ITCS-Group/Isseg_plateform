import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessageQueryDto } from './dto/list-message-query.dto';
import { MessageResponseDto, PaginatedMessageResponseDto } from './dto/message.response.dto';
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
  @ApiResponse({ status: 200, type: PaginatedMessageResponseDto })
  findRecus(
    @Query() query: ListMessageQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedMessageResponseDto> {
    return this.messageService.findRecus(query, user.id);
  }

  @Get('envoyes')
  @ApiOperation({ summary: 'Lister les messages envoyés' })
  @ApiResponse({ status: 200, type: PaginatedMessageResponseDto })
  findEnvoyes(
    @Query() query: ListMessageQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedMessageResponseDto> {
    return this.messageService.findEnvoyes(query, user.id);
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
