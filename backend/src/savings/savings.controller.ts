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
import {
  MANAGE_SAVINGS_ROLES,
  VIEW_SAVINGS_ROLES,
} from '../cooperatives/roles.constants';
import { SavingsService } from './savings.service';
import { CreateSavingsProductDto } from './dto/create-savings-product.dto';
import { UpdateSavingsProductDto } from './dto/update-savings-product.dto';
import { OpenSavingsAccountDto } from './dto/open-savings-account.dto';
import { RecordSavingsTransactionDto } from './dto/record-savings-transaction.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class SavingsController {
  constructor(private readonly savings: SavingsService) {}

  @CooperativeRoles(...MANAGE_SAVINGS_ROLES)
  @Post(':id/savings/products')
  createProduct(@Param('id') id: string, @Body() dto: CreateSavingsProductDto) {
    return this.savings.createProduct(id, dto);
  }

  @Get(':id/savings/products')
  listProducts(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.savings.listProducts(id, user);
  }

  @CooperativeRoles(...MANAGE_SAVINGS_ROLES)
  @Patch(':id/savings/products/:productId')
  updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateSavingsProductDto,
  ) {
    return this.savings.updateProduct(id, productId, dto);
  }

  @CooperativeRoles(...VIEW_SAVINGS_ROLES)
  @Get(':id/savings/accounts')
  listAccountsForCooperative(@Param('id') id: string) {
    return this.savings.listAccountsForCooperative(id);
  }

  @CooperativeRoles(...MANAGE_SAVINGS_ROLES)
  @Post(':id/members/:userId/savings/accounts')
  openAccount(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: OpenSavingsAccountDto,
  ) {
    return this.savings.openAccount(id, userId, actor, dto);
  }

  @Get(':id/members/:userId/savings/accounts')
  listAccountsForMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.savings.listAccountsForMember(id, userId, requester);
  }

  @CooperativeRoles(...MANAGE_SAVINGS_ROLES)
  @Post(':id/savings/accounts/:accountId/transactions')
  recordTransaction(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordSavingsTransactionDto,
  ) {
    return this.savings.recordTransaction(id, accountId, actor, dto);
  }

  @Get(':id/savings/accounts/:accountId/transactions')
  listTransactions(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.savings.listTransactions(id, accountId, requester);
  }

  @CooperativeRoles(...MANAGE_SAVINGS_ROLES)
  @Post(':id/savings/accounts/:accountId/accrue-interest')
  accrueInterest(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.savings.accrueInterest(id, accountId, actor);
  }

  @Get(':id/savings/accounts/:accountId/transactions/:transactionId/receipt')
  getReceipt(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.savings.getReceipt(id, accountId, transactionId, requester);
  }
}
