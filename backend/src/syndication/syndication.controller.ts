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
import { MANAGE_SYNDICATION_ROLES } from '../cooperatives/roles.constants';
import { SyndicationService } from './syndication.service';
import { FundEscrowDto } from './dto/fund-escrow.dto';
import { VerifyMilestoneDto } from './dto/verify-milestone.dto';
import { RecordAllocationDto } from './dto/record-allocation.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class SyndicationController {
  constructor(private readonly syndication: SyndicationService) {}

  @CooperativeRoles(...MANAGE_SYNDICATION_ROLES)
  @Post(':id/reservations/:reservationId/syndication')
  initiate(
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.syndication.initiateSyndication(id, reservationId, actor);
  }

  @Get(':id/syndications')
  list(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.syndication.listSyndications(id, user);
  }

  @Get(':id/syndications/:syndicationId')
  get(
    @Param('id') id: string,
    @Param('syndicationId') syndicationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.syndication.getSyndication(id, syndicationId, user);
  }

  @CooperativeRoles(...MANAGE_SYNDICATION_ROLES)
  @Patch(':id/syndications/:syndicationId/fund-escrow')
  fundEscrow(
    @Param('id') id: string,
    @Param('syndicationId') syndicationId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: FundEscrowDto,
  ) {
    return this.syndication.fundEscrow(id, syndicationId, actor, dto);
  }

  @CooperativeRoles(...MANAGE_SYNDICATION_ROLES)
  @Patch(':id/syndications/:syndicationId/milestones/:milestoneId/verify')
  verifyMilestone(
    @Param('id') id: string,
    @Param('syndicationId') syndicationId: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: VerifyMilestoneDto,
  ) {
    return this.syndication.verifyMilestone(
      id,
      syndicationId,
      milestoneId,
      actor,
      dto,
    );
  }

  @CooperativeRoles(...MANAGE_SYNDICATION_ROLES)
  @Patch(':id/syndications/:syndicationId/milestones/:milestoneId/release')
  releaseMilestone(
    @Param('id') id: string,
    @Param('syndicationId') syndicationId: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.syndication.releaseMilestone(
      id,
      syndicationId,
      milestoneId,
      actor,
    );
  }

  @CooperativeRoles(...MANAGE_SYNDICATION_ROLES)
  @Post(':id/syndications/:syndicationId/allocations')
  recordAllocation(
    @Param('id') id: string,
    @Param('syndicationId') syndicationId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordAllocationDto,
  ) {
    return this.syndication.recordAllocation(id, syndicationId, actor, dto);
  }
}
