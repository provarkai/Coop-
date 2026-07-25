import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

// Paystack calls this directly -- no JWT, verified purely by HMAC signature
// (see PaystackService.verifyWebhookSignature). Exempt from throttling since
// Paystack may deliver several events in quick succession.
@Controller('payments/webhook')
export class PaystackWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('paystack')
  handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string | undefined,
  ) {
    return this.payments.handleWebhookEvent(
      req.rawBody ?? Buffer.from(''),
      signature,
    );
  }
}
