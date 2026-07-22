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
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativesService } from './cooperatives.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { AddCommitteeMemberDto } from './dto/add-committee-member.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { CooperativeRoles } from './decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from './guards/cooperative-roles.guard';

const MANAGE_COOPERATIVE = [Role.COOPERATIVE_ADMIN, Role.CHAIRMAN] as const;
const MANAGE_GOVERNANCE = [
  Role.COOPERATIVE_ADMIN,
  Role.CHAIRMAN,
  Role.SECRETARY,
] as const;

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class CooperativesController {
  constructor(private readonly cooperatives: CooperativesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCooperativeDto,
  ) {
    return this.cooperatives.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.cooperatives.findAllForUser(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cooperatives.findOne(id, user);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCooperativeDto) {
    return this.cooperatives.update(id, dto);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Post(':id/branches')
  createBranch(@Param('id') id: string, @Body() dto: CreateBranchDto) {
    return this.cooperatives.createBranch(id, dto);
  }

  @Get(':id/branches')
  listBranches(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cooperatives.listBranches(id, user);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Patch(':id/branches/:branchId')
  updateBranch(
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.cooperatives.updateBranch(id, branchId, dto);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/branches/:branchId')
  async removeBranch(
    @Param('id') id: string,
    @Param('branchId') branchId: string,
  ) {
    await this.cooperatives.removeBranch(id, branchId);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE)
  @Post(':id/committees')
  createCommittee(@Param('id') id: string, @Body() dto: CreateCommitteeDto) {
    return this.cooperatives.createCommittee(id, dto);
  }

  @Get(':id/committees')
  listCommittees(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cooperatives.listCommittees(id, user);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE)
  @Post(':id/committees/:committeeId/members')
  addCommitteeMember(
    @Param('id') id: string,
    @Param('committeeId') committeeId: string,
    @Body() dto: AddCommitteeMemberDto,
  ) {
    return this.cooperatives.addCommitteeMember(id, committeeId, dto);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/committees/:committeeId/members/:userId')
  async removeCommitteeMember(
    @Param('id') id: string,
    @Param('committeeId') committeeId: string,
    @Param('userId') userId: string,
  ) {
    await this.cooperatives.removeCommitteeMember(id, committeeId, userId);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE)
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.cooperatives.addMember(id, dto);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cooperatives.listMembers(id, user);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Patch(':id/members/:userId')
  updateMembership(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.cooperatives.updateMembership(id, userId, dto);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId')
  async removeMembership(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.cooperatives.removeMembership(id, userId);
  }
}
