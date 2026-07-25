import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CooperativeRoles } from '../cooperatives/decorators/cooperative-roles.decorator';
import { CooperativeRolesGuard } from '../cooperatives/guards/cooperative-roles.guard';
import {
  MANAGE_PAYMENT_ROLES,
  VIEW_PAYMENT_ROLES,
} from '../cooperatives/roles.constants';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConnectBankAccountDto } from './dto/connect-bank-account.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments/banks')
  listBanks() {
    return this.payments.listBanks();
  }

  // No @CooperativeRoles: any active member needs to see whether payments are
  // available before trying to pay, same as the cooperative logo being open
  // to any authenticated user -- this is the cooperative's own bank details,
  // not a member's private data.
  @Get(':id/payments/bank-account')
  getBankAccountStatus(@Param('id') id: string) {
    return this.payments.getBankAccountStatus(id);
  }

  @CooperativeRoles(...MANAGE_PAYMENT_ROLES)
  @Post(':id/payments/bank-account')
  connectBankAccount(
    @Param('id') id: string,
    @Body() dto: ConnectBankAccountDto,
  ) {
    return this.payments.connectBankAccount(id, dto);
  }

  @Post(':id/payments')
  initiate(
    @Param('id') id: string,
    @CurrentUser() payer: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payments.initiate(id, payer, dto);
  }

  @CooperativeRoles(...VIEW_PAYMENT_ROLES)
  @Get(':id/payments')
  listForCooperative(
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    const parsed =
      status && (Object.values(PaymentStatus) as string[]).includes(status)
        ? (status as PaymentStatus)
        : undefined;
    return this.payments.listForCooperative(id, parsed);
  }

  @Get(':id/members/:userId/payments')
  listForMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.payments.listForMember(id, userId, requester);
  }

  @Get(':id/payments/:paymentId')
  getPayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.payments.getPayment(id, paymentId, requester);
  }

  @Post(':id/payments/:paymentId/verify')
  verify(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.payments.verifyAndSync(id, paymentId, requester);
  }

  // Used by the /payments/callback return page, which only has the Paystack
  // reference Paystack appended to the redirect -- not our internal payment id.
  @Post(':id/payments/by-reference/:reference/verify')
  verifyByReference(
    @Param('id') id: string,
    @Param('reference') reference: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.payments.verifyByReference(id, reference, requester);
  }
}
