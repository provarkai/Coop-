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
  Query,
} from '@nestjs/common';
import { ComplianceFilingStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ComplianceService } from './compliance.service';
import { ReviewFilingDto } from './dto/review-filing.dto';
import { AssignRegulatorDto } from './dto/assign-regulator.dto';

// Regulator oversight: cross-cooperative visibility for the platform-wide
// REGULATOR role, scoped to whichever cooperatives are assigned to them
// (SUPER_ADMIN sees everything, unscoped). Unlike the cooperative-scoped
// routes, nothing here is gated by CooperativeMembership.
@Roles(Role.REGULATOR, Role.SUPER_ADMIN)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('cooperatives')
  listCooperatives(@CurrentUser() user: AuthenticatedUser) {
    return this.compliance.listCooperatives(user);
  }

  @Get('filings')
  listFilings(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    const parsed =
      status &&
      (Object.values(ComplianceFilingStatus) as string[]).includes(status)
        ? (status as ComplianceFilingStatus)
        : undefined;
    return this.compliance.listFilings(user, parsed);
  }

  @Get('filings/:id')
  getFiling(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.compliance.getFiling(id, user);
  }

  @Patch('filings/:id/review')
  reviewFiling(
    @Param('id') id: string,
    @CurrentUser() reviewer: AuthenticatedUser,
    @Body() dto: ReviewFilingDto,
  ) {
    return this.compliance.reviewFiling(id, reviewer, dto);
  }

  @Get('cooperatives/:id/financial-standing')
  getFinancialStanding(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compliance.getFinancialStanding(id, user);
  }

  @Get('cooperatives/:id/meetings')
  getMeetings(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.compliance.getMeetings(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('cooperatives/:id/assignments')
  listAssignments(@Param('id') id: string) {
    return this.compliance.listAssignments(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('assignments')
  assignRegulator(
    @Body() dto: AssignRegulatorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compliance.assignRegulator(dto, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unassignRegulator(@Param('id') id: string) {
    return this.compliance.unassignRegulator(id);
  }
}
