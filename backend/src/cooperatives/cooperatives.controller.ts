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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativesService } from './cooperatives.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { UpdateCooperativeDto } from './dto/update-cooperative.dto';
import { UpdateCooperativeLogoDto } from './dto/update-cooperative-logo.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { AddCommitteeMemberDto } from './dto/add-committee-member.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { ApplyDto } from './dto/apply.dto';
import { AddGuarantorDto } from './dto/add-guarantor.dto';
import { RespondGuarantorDto } from './dto/respond-guarantor.dto';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { CreateComplianceFilingDto } from './dto/create-compliance-filing.dto';
import { CooperativeRoles } from './decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from './guards/cooperative-roles.guard';
import {
  MANAGE_COOPERATIVE_ROLES as MANAGE_COOPERATIVE,
  MANAGE_GOVERNANCE_ROLES as MANAGE_GOVERNANCE,
  AUDIT_ROLES,
} from './roles.constants';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class CooperativesController {
  constructor(private readonly cooperatives: CooperativesService) {}

  @Roles(Role.SUPER_ADMIN)
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

  // Lets a prospective member see the cooperative's name before applying,
  // without exposing full details to non-members.
  @Get(':id/preview')
  getPreview(@Param('id') id: string) {
    return this.cooperatives.getPreview(id);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCooperativeDto) {
    return this.cooperatives.update(id, dto);
  }

  // No CooperativeRoles restriction: a logo is shown pre-membership too (e.g.
  // the join page), same as the preview endpoint above.
  @Get(':id/logo')
  async getLogo(@Param('id') id: string, @Res() res: Response) {
    const logo = await this.cooperatives.getLogo(id);
    res.setHeader('Content-Type', logo.mimeType);
    res.send(logo.content);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Patch(':id/logo')
  updateLogo(@Param('id') id: string, @Body() dto: UpdateCooperativeLogoDto) {
    return this.cooperatives.updateLogo(id, dto);
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
  addMember(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.cooperatives.addMember(id, actor, dto);
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
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.cooperatives.updateMembership(id, userId, actor, dto);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId')
  async removeMembership(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.cooperatives.removeMembership(id, userId, actor);
  }

  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyDto,
  ) {
    return this.cooperatives.apply(id, user, dto);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE)
  @Post(':id/members/:userId/approve')
  approveMembership(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.cooperatives.approveMembership(id, userId, actor);
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE)
  @Post(':id/members/:userId/reject')
  rejectMembership(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.cooperatives.rejectMembership(id, userId, actor);
  }

  @Get(':id/members/:userId/profile')
  getMemberProfile(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.cooperatives.getMemberProfile(id, userId, requester);
  }

  @Get(':id/members/:userId/avatar')
  async getMemberAvatar(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const avatar = await this.cooperatives.getMemberAvatar(
      id,
      userId,
      requester,
    );
    res.setHeader('Content-Type', avatar.mimeType);
    res.send(avatar.content);
  }

  @Get(':id/members/:userId/card')
  getMembershipCard(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.cooperatives.getMembershipCard(id, userId, requester);
  }

  @Get(':id/members/:userId/card.pdf')
  async getMembershipCardPdf(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdf = await this.cooperatives.getMembershipCardPdf(
      id,
      userId,
      requester,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="membership-card.pdf"',
    );
    res.send(pdf);
  }

  @Post(':id/members/:userId/guarantors')
  addGuarantor(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: AddGuarantorDto,
  ) {
    return this.cooperatives.addGuarantor(id, userId, requester, dto);
  }

  @Get(':id/members/:userId/guarantors')
  listGuarantors(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.cooperatives.listGuarantors(id, userId, requester);
  }

  @Patch(':id/guarantors/:guarantorId/respond')
  respondToGuarantorRequest(
    @Param('id') id: string,
    @Param('guarantorId') guarantorId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: RespondGuarantorDto,
  ) {
    return this.cooperatives.respondToGuarantorRequest(
      id,
      guarantorId,
      requester,
      dto,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId/guarantors/:guarantorId')
  async removeGuarantor(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Param('guarantorId') guarantorId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    await this.cooperatives.removeGuarantor(id, userId, guarantorId, requester);
  }

  @Post(':id/members/:userId/beneficiaries')
  addBeneficiary(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: CreateBeneficiaryDto,
  ) {
    return this.cooperatives.addBeneficiary(id, userId, requester, dto);
  }

  @Get(':id/members/:userId/beneficiaries')
  listBeneficiaries(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.cooperatives.listBeneficiaries(id, userId, requester);
  }

  @Patch(':id/members/:userId/beneficiaries/:beneficiaryId')
  updateBeneficiary(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Param('beneficiaryId') beneficiaryId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    return this.cooperatives.updateBeneficiary(
      id,
      userId,
      beneficiaryId,
      requester,
      dto,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId/beneficiaries/:beneficiaryId')
  async removeBeneficiary(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Param('beneficiaryId') beneficiaryId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    await this.cooperatives.removeBeneficiary(
      id,
      userId,
      beneficiaryId,
      requester,
    );
  }

  @CooperativeRoles(...AUDIT_ROLES)
  @Get(':id/audit-logs')
  listAuditLogs(@Param('id') id: string) {
    return this.cooperatives.listAuditLogs(id);
  }

  @CooperativeRoles(...MANAGE_COOPERATIVE)
  @Post(':id/compliance-filings')
  createComplianceFiling(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateComplianceFilingDto,
  ) {
    return this.cooperatives.createComplianceFiling(id, actor, dto);
  }

  @Get(':id/compliance-filings')
  listComplianceFilings(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cooperatives.listComplianceFilings(id, user);
  }
}
