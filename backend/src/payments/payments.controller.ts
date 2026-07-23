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
import { VIEW_PAYMENT_ROLES } from '../cooperatives/roles.constants';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { SimulateCallbackDto } from './dto/simulate-callback.dto';

@UseGuards(CooperativeRolesGuard)
@Controller('cooperatives')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

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

  @Post(':id/payments/:paymentId/simulate-callback')
  simulateCallback(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() requester: AuthenticatedUser,
    @Body() dto: SimulateCallbackDto,
  ) {
    return this.payments.simulateCallback(id, paymentId, requester, dto);
  }
}
