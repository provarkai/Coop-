import { Module } from '@nestjs/common';
import { SavingsModule } from '../savings/savings.module';
import { LoansModule } from '../loans/loans.module';
import { PaymentsController } from './payments.controller';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';

@Module({
  imports: [SavingsModule, LoansModule],
  controllers: [PaymentsController, PaystackWebhookController],
  providers: [PaymentsService, PaystackService],
})
export class PaymentsModule {}
