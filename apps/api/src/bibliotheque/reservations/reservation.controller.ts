import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/auth.interfaces';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation.response.dto';
import { ReservationService } from './reservation.service';

@ApiTags('Bibliothèque — Réservations')
@ApiBearerAuth('JWT')
@Roles('ETUDIANT', 'ENSEIGNANT')
@Controller({ path: 'reservations', version: '1' })
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  // ── POST /api/v1/reservations ─────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Réserver un ouvrage indisponible' })
  @ApiBody({ type: CreateReservationDto })
  @ApiResponse({ status: 201, type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Ouvrage ou profil abonné introuvable' })
  @ApiResponse({ status: 409, description: 'Exemplaires disponibles ou réservation déjà en attente' })
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationResponseDto> {
    return this.reservationService.create(dto, user.id);
  }
}
