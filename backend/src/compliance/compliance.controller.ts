import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ComplianceFilingStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ComplianceService } from './compliance.service';
import { ReviewFilingDto } from './dto/review-filing.dto';

// Regulator oversight: cross-cooperative visibility for the platform-wide
// REGULATOR role (SUPER_ADMIN can act as a regulator too). Unlike the
// cooperative-scoped routes, nothing here is gated by CooperativeMembership.
@Roles(Role.REGULATOR, Role.SUPER_ADMIN)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('cooperatives')
  listCooperatives() {
    return this.compliance.listCooperatives();
  }

  @Get('filings')
  listFilings(@Query('status') status?: string) {
    const parsed =
      status &&
      (Object.values(ComplianceFilingStatus) as string[]).includes(status)
        ? (status as ComplianceFilingStatus)
        : undefined;
    return this.compliance.listFilings(parsed);
  }

  @Get('filings/:id')
  getFiling(@Param('id') id: string) {
    return this.compliance.getFiling(id);
  }

  @Patch('filings/:id/review')
  reviewFiling(
    @Param('id') id: string,
    @CurrentUser() reviewer: AuthenticatedUser,
    @Body() dto: ReviewFilingDto,
  ) {
    return this.compliance.reviewFiling(id, reviewer, dto);
  }
}
