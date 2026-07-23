import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import {
  MANAGE_ACCOUNTING_ROLES,
  VIEW_ACCOUNTING_ROLES,
} from '../cooperatives/roles.constants';
import { AccountingService } from './accounting.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@UseGuards(CooperativeRolesGuard)
@CooperativeRoles(...VIEW_ACCOUNTING_ROLES)
@Controller('cooperatives')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get(':id/accounting/accounts')
  listAccounts(@Param('id') id: string) {
    return this.accounting.listAccounts(id);
  }

  @CooperativeRoles(...MANAGE_ACCOUNTING_ROLES)
  @Post(':id/accounting/accounts')
  createAccount(@Param('id') id: string, @Body() dto: CreateAccountDto) {
    return this.accounting.createAccount(id, dto);
  }

  @CooperativeRoles(...MANAGE_ACCOUNTING_ROLES)
  @Post(':id/accounting/journal-entries')
  createJournalEntry(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.accounting.createJournalEntry(id, actor.userId, dto);
  }

  @Get(':id/accounting/journal-entries')
  listJournalEntries(
    @Param('id') id: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.accounting.listJournalEntries(id, accountId);
  }

  @Get(':id/accounting/trial-balance')
  getTrialBalance(@Param('id') id: string) {
    return this.accounting.getTrialBalance(id);
  }

  @Get(':id/accounting/income-statement')
  getIncomeStatement(@Param('id') id: string) {
    return this.accounting.getIncomeStatement(id);
  }

  @Get(':id/accounting/balance-sheet')
  getBalanceSheet(@Param('id') id: string) {
    return this.accounting.getBalanceSheet(id);
  }

  @CooperativeRoles(...MANAGE_ACCOUNTING_ROLES)
  @Post(':id/accounting/budgets')
  upsertBudget(@Param('id') id: string, @Body() dto: UpsertBudgetDto) {
    return this.accounting.upsertBudget(id, dto);
  }

  @Get(':id/accounting/budgets')
  getBudgetVsActual(@Param('id') id: string, @Query('period') period?: string) {
    return this.accounting.getBudgetVsActual(id, period);
  }
}
