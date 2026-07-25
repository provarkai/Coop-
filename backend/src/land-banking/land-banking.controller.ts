import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import { MANAGE_LAND_ROLES } from '../cooperatives/roles.constants';
import { LandBankingService } from './land-banking.service';
import { CreateLandParcelDto } from './dto/create-land-parcel.dto';
import { UpdateLandParcelDto } from './dto/update-land-parcel.dto';
import { ReserveParcelDto } from './dto/reserve-parcel.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class LandBankingController {
  constructor(private readonly landBanking: LandBankingService) {}

  @CooperativeRoles(...MANAGE_LAND_ROLES)
  @Post(':id/land-parcels')
  createParcel(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateLandParcelDto,
  ) {
    return this.landBanking.createParcel(id, actor, dto);
  }

  @Get(':id/land-parcels')
  listParcels(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.landBanking.listParcels(id, user);
  }

  @Get(':id/land-parcels/:parcelId')
  getParcel(
    @Param('id') id: string,
    @Param('parcelId') parcelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.landBanking.getParcel(id, parcelId, user);
  }

  @CooperativeRoles(...MANAGE_LAND_ROLES)
  @Patch(':id/land-parcels/:parcelId')
  updateParcel(
    @Param('id') id: string,
    @Param('parcelId') parcelId: string,
    @Body() dto: UpdateLandParcelDto,
  ) {
    return this.landBanking.updateParcel(id, parcelId, dto);
  }

  @CooperativeRoles(...MANAGE_LAND_ROLES)
  @Post(':id/land-parcels/:parcelId/publish')
  publishParcel(
    @Param('id') id: string,
    @Param('parcelId') parcelId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.landBanking.publishParcel(id, parcelId, actor);
  }

  @Post(':id/land-parcels/:parcelId/reservations')
  reserveParcel(
    @Param('id') id: string,
    @Param('parcelId') parcelId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReserveParcelDto,
  ) {
    return this.landBanking.reserveParcel(id, parcelId, actor, dto);
  }

  @Get(':id/land-parcels/:parcelId/reservations')
  listReservationsForParcel(
    @Param('id') id: string,
    @Param('parcelId') parcelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.landBanking.listReservationsForParcel(id, parcelId, user);
  }

  @Get(':id/reservations/:reservationId')
  getReservation(
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.landBanking.getReservation(id, reservationId, user);
  }

  @Patch(':id/reservations/:reservationId/confirm')
  confirmReservation(
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.landBanking.confirmReservation(id, reservationId, actor);
  }

  @Patch(':id/reservations/:reservationId/cancel')
  cancelReservation(
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.landBanking.cancelReservation(id, reservationId, actor);
  }
}
