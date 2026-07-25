import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackBank {
  name: string;
  code: string;
  // Paystack's own unique identifier for a bank entry -- `code` (the
  // settlement/sort code) is not always unique across entries (e.g. a bank
  // listed under both its NUBAN and mobile-money forms can share a code), so
  // this is the field to use as a React list key.
  slug: string;
}

export interface ResolvedAccount {
  accountNumber: string;
  accountName: string;
}

export interface CreatedSubaccount {
  subaccountCode: string;
}

export interface InitializedTransaction {
  authorizationUrl: string;
  reference: string;
}

export interface VerifiedTransaction {
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  amountKobo: number;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(private readonly config: ConfigService) {}

  private getSecretKey(): string {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'Real payments are not configured (missing PAYSTACK_SECRET_KEY)',
      );
    }
    return key;
  }

  private async request<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown },
  ): Promise<T> {
    const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.getSecretKey()}`,
        'Content-Type': 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: T;
    } | null;
    if (!res.ok || !data?.status) {
      this.logger.error(
        `Paystack ${init.method} ${path} failed: ${res.status} ${data?.message ?? ''}`,
      );
      throw new BadRequestException(data?.message ?? 'Paystack request failed');
    }
    return data.data as T;
  }

  async listBanks(): Promise<PaystackBank[]> {
    const banks = await this.request<
      { name: string; code: string; slug: string; active: boolean }[]
    >('/bank?country=nigeria', { method: 'GET' });
    return banks
      .filter((b) => b.active)
      .map((b) => ({ name: b.name, code: b.code, slug: b.slug }));
  }

  async resolveAccountNumber(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolvedAccount> {
    const resolved = await this.request<{
      account_number: string;
      account_name: string;
    }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      method: 'GET',
    });
    return {
      accountNumber: resolved.account_number,
      accountName: resolved.account_name,
    };
  }

  async createSubaccount(params: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
  }): Promise<CreatedSubaccount> {
    const created = await this.request<{ subaccount_code: string }>(
      '/subaccount',
      {
        method: 'POST',
        body: {
          business_name: params.businessName,
          settlement_bank: params.bankCode,
          account_number: params.accountNumber,
          // The cooperative keeps 100% of what it's paid; the platform takes
          // no cut. Kesa/NCMS coordinates payments, it doesn't monetize them.
          percentage_charge: 0,
        },
      },
    );
    return { subaccountCode: created.subaccount_code };
  }

  async initializeTransaction(params: {
    email: string;
    amountNaira: number;
    reference: string;
    subaccountCode: string;
    callbackUrl: string;
  }): Promise<InitializedTransaction> {
    const initialized = await this.request<{
      authorization_url: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: {
        email: params.email,
        amount: Math.round(params.amountNaira * 100),
        reference: params.reference,
        subaccount: params.subaccountCode,
        // The cooperative's subaccount already has percentage_charge: 0 (see
        // createSubaccount), so the platform takes no cut; the cooperative
        // bears Paystack's own processing fee, same as using Paystack directly.
        bearer: 'subaccount',
        callback_url: params.callbackUrl,
      },
    });
    return {
      authorizationUrl: initialized.authorization_url,
      reference: initialized.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const verified = await this.request<{
      status: string;
      reference: string;
      amount: number;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });
    return {
      status: verified.status as VerifiedTransaction['status'],
      reference: verified.reference,
      amountKobo: verified.amount,
    };
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean {
    if (!signature) return false;
    const expected = createHmac('sha512', this.getSecretKey())
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  }
}
