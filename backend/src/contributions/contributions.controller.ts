import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import { MANAGE_GROUP_ROLES } from '../cooperatives/roles.constants';
import { ContributionsService } from './contributions.service';
import { CreateContributionGroupDto } from './dto/create-contribution-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { RecordContributionPeriodDto } from './dto/record-contribution-period.dto';
import { FlagContributionDto } from './dto/flag-contribution.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @CooperativeRoles(...MANAGE_GROUP_ROLES)
  @Post(':id/contribution-groups')
  createGroup(
    @Param('id') id: string,
    @Body() dto: CreateContributionGroupDto,
  ) {
    return this.contributions.createGroup(id, dto);
  }

  @Get(':id/contribution-groups')
  listGroups(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contributions.listGroups(id, user);
  }

  @Get(':id/contribution-groups/:groupId')
  getGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contributions.getGroup(id, groupId, user);
  }

  @Post(':id/contribution-groups/:groupId/members')
  addMember(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.contributions.addMember(id, groupId, actor, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/contribution-groups/:groupId/members/:membershipId')
  removeMember(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contributions.removeMember(id, groupId, membershipId, actor);
  }

  @Post(':id/contribution-groups/:groupId/contributions')
  recordContributionPeriod(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordContributionPeriodDto,
  ) {
    return this.contributions.recordContributionPeriod(id, groupId, actor, dto);
  }

  @Get(':id/contribution-groups/:groupId/contributions')
  listContributions(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contributions.listContributions(id, groupId, user);
  }

  @Patch(
    ':id/contribution-groups/:groupId/contributions/:contributionId/confirm',
  )
  confirmContribution(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contributions.confirmContribution(
      id,
      groupId,
      contributionId,
      actor,
    );
  }

  @Patch(':id/contribution-groups/:groupId/contributions/:contributionId/flag')
  flagContribution(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: FlagContributionDto,
  ) {
    return this.contributions.flagContribution(
      id,
      groupId,
      contributionId,
      actor,
      dto,
    );
  }

  @Get(':id/contribution-groups/:groupId/trust-score')
  getGroupTrustScore(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contributions.getGroupTrustScore(id, groupId, user);
  }

  @Get(':id/members/:userId/trust-score')
  getMemberTrustScore(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contributions.getMemberTrustScore(id, userId, user);
  }
}
