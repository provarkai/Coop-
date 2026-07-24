import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import {
  MANAGE_GOVERNANCE_ROLES,
  VIEW_DASHBOARD_ROLES,
} from '../cooperatives/roles.constants';
import { ReportsService } from './reports.service';

function sendCsv(res: Response, csv: string, fileName: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csv);
}

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Get(':id/dashboard')
  getDashboard(@Param('id') id: string) {
    return this.reports.computeDashboard(id);
  }

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Get(':id/dashboard/trends')
  getTrends(@Param('id') id: string, @Query('months') months?: string) {
    const parsed = months ? Number.parseInt(months, 10) : 6;
    return this.reports.computeTrends(id, Number.isNaN(parsed) ? 6 : parsed);
  }

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Get(':id/exports/members.csv')
  async exportMembers(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.reports.exportMembersCsv(id);
    sendCsv(res, csv, 'members.csv');
  }

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Get(':id/exports/savings-transactions.csv')
  async exportSavingsTransactions(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.reports.exportSavingsTransactionsCsv(id);
    sendCsv(res, csv, 'savings-transactions.csv');
  }

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Get(':id/exports/loans.csv')
  async exportLoans(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.reports.exportLoansCsv(id);
    sendCsv(res, csv, 'loans.csv');
  }

  @CooperativeRoles(...VIEW_DASHBOARD_ROLES)
  @Get(':id/exports/journal-entries.csv')
  async exportJournalEntries(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.reports.exportJournalEntriesCsv(id);
    sendCsv(res, csv, 'journal-entries.csv');
  }

  @CooperativeRoles(...MANAGE_GOVERNANCE_ROLES)
  @Post(':id/reports/monthly-digest')
  generateMonthlyDigest(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reports.generateMonthlyDigest(id, actor.userId);
  }
}
