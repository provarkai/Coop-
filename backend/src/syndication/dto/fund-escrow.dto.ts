import { IsNumber, IsString, Min, MinLength } from 'class-validator';

// Records that funds were sent to an external licensed trustee/escrow
// partner -- NCMS is the coordination layer, not the fund holder, so this
// is a simulated record of an external transfer, the same convention the
// Payments module already uses for the payment gateway.
export class FundEscrowDto {
  @IsString()
  @MinLength(1)
  escrowPartnerRef: string;

  @IsNumber()
  @Min(0)
  amount: number;
}
