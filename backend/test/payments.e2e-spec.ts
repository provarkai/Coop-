import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';
import { PaystackService } from '../src/payments/paystack.service';

const resolveAccountNumberMock = jest.fn().mockResolvedValue({
  accountNumber: '0000000000',
  accountName: 'Test Cooperative Ltd',
});
const createSubaccountMock = jest
  .fn()
  .mockResolvedValue({ subaccountCode: 'ACCT_test_mock' });
const initializeTransactionMock = jest
  .fn()
  .mockImplementation((params: { reference: string }) => ({
    authorizationUrl: `https://checkout.paystack.com/${params.reference}`,
    reference: params.reference,
  }));
const verifyTransactionMock = jest.fn();
const verifyWebhookSignatureMock = jest.fn().mockReturnValue(true);

const fakePaystack = {
  listBanks: jest
    .fn()
    .mockResolvedValue([{ name: 'Test Mock Bank', code: '000', slug: 'test-mock-bank' }]),
  resolveAccountNumber: resolveAccountNumberMock,
  createSubaccount: createSubaccountMock,
  initializeTransaction: initializeTransactionMock,
  verifyTransaction: verifyTransactionMock,
  verifyWebhookSignature: verifyWebhookSignatureMock,
};

describe('Payments (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `payments-admin-${suffix}@example.com`;
  const memberEmail = `payments-member-${suffix}@example.com`;
  const outsiderEmail = `payments-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `payments-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberUserId: string;
  let cooperativeId: string;
  let savingsAccountId: string;
  let loanId: string;

  async function registerAndLogin(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'User' })
      .expect(201);
    return {
      accessToken: res.body.accessToken as string,
      userId: res.body.user.id as string,
    };
  }

  function webhookBody(event: string, reference: string, amountKobo: number) {
    return {
      event,
      data: { reference, amount: amountKobo, status: 'success' },
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaystackService)
      .useValue(fakePaystack)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // Mirrors main.ts's body-parser config: the webhook signature check needs
    // the exact raw bytes Paystack signed, which createNestApplication()'s
    // default body parser doesn't stash on the request.
    app.useBodyParser('json', {
      limit: '10mb',
      verify: (req: { rawBody?: Buffer }, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const admin = await registerAndLogin(adminEmail);
    adminToken = admin.accessToken;

    const member = await registerAndLogin(memberEmail);
    memberToken = member.accessToken;
    memberUserId = member.userId;

    const outsider = await registerAndLogin(outsiderEmail);
    outsiderToken = outsider.accessToken;

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Payments Test Cooperative',
        slug,
        initialAdminEmail: adminEmail,
      })
    ).cooperativeId;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(201);

    const savingsProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ordinary', code: 'ORD' })
      .expect(201);

    const account = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: savingsProduct.body.id })
      .expect(201);
    savingsAccountId = account.body.id;

    const loanProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Quick Loan',
        code: 'QL',
        maxAmount: 50000,
        maxTermMonths: 6,
        requiredGuarantors: 0,
      })
      .expect(201);

    const loan = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ productId: loanProduct.body.id, principal: 6000, termMonths: 6 })
      .expect(201);
    loanId = loan.body.id;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/disburse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('refuses to initiate a payment before a bank account is connected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        purpose: 'SAVINGS_DEPOSIT',
        targetId: savingsAccountId,
        amount: 500,
      })
      .expect(400);
    expect(res.body.message).toMatch(/bank account/i);
  });

  it('denies a plain member from connecting the cooperative bank account', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments/bank-account`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ bankCode: '000', accountNumber: '0000000000' })
      .expect(403);
  });

  it('lets governance connect the cooperative bank account via Paystack', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments/bank-account`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bankCode: '000', accountNumber: '0000000000' })
      .expect(201);
    expect(res.body.paystackSubaccountCode).toBe('ACCT_test_mock');
    expect(resolveAccountNumberMock).toHaveBeenCalledWith('0000000000', '000');
    expect(createSubaccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ bankCode: '000', accountNumber: '0000000000' }),
    );

    const status = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/payments/bank-account`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(status.body.connected).toBe(true);

    // Any active member can check whether payments are available -- this is
    // the cooperative's own bank details, not the manage-only action.
    const memberStatus = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/payments/bank-account`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(memberStatus.body.connected).toBe(true);
  });

  it("rejects initiating a payment against another member's savings account", async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        purpose: 'SAVINGS_DEPOSIT',
        targetId: savingsAccountId,
        amount: 500,
      })
      .expect(400);
  });

  let savingsPaymentId: string;
  let savingsPaymentReference: string;

  it('lets the member initiate a savings deposit payment and get a checkout URL', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        purpose: 'SAVINGS_DEPOSIT',
        targetId: savingsAccountId,
        amount: 500,
      })
      .expect(201);
    savingsPaymentId = res.body.id;
    savingsPaymentReference = res.body.gatewayReference;
    expect(res.body.status).toBe('INITIATED');
    expect(res.body.gatewayReference).toMatch(/^NCMS-/);
    expect(res.body.authorizationUrl).toContain(savingsPaymentReference);
    expect(initializeTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subaccountCode: 'ACCT_test_mock',
        amountNaira: 500,
      }),
    );
  });

  it('credits the savings deposit once the Paystack webhook confirms success', async () => {
    await request(app.getHttpServer())
      .post('/payments/webhook/paystack')
      .send(webhookBody('charge.success', savingsPaymentReference, 50000))
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: savingsPaymentId },
    });
    expect(payment.status).toBe('SUCCESS');

    const account = await prisma.savingsAccount.findUniqueOrThrow({
      where: { id: savingsAccountId },
    });
    expect(account.balance.toString()).toBe('500');
  });

  it('ignores a duplicate webhook delivery for the same payment (idempotent)', async () => {
    await request(app.getHttpServer())
      .post('/payments/webhook/paystack')
      .send(webhookBody('charge.success', savingsPaymentReference, 50000))
      .expect(200);

    const account = await prisma.savingsAccount.findUniqueOrThrow({
      where: { id: savingsAccountId },
    });
    // Still 500, not 1000 -- the second delivery must not double-credit.
    expect(account.balance.toString()).toBe('500');
  });

  it('rejects a webhook whose signature does not verify', async () => {
    verifyWebhookSignatureMock.mockReturnValueOnce(false);
    await request(app.getHttpServer())
      .post('/payments/webhook/paystack')
      .send(webhookBody('charge.success', savingsPaymentReference, 50000))
      .expect(403);
  });

  let failedPaymentId: string;
  let failedPaymentReference: string;

  it('records a failed webhook without any side effect', async () => {
    const initiate = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        purpose: 'SAVINGS_DEPOSIT',
        targetId: savingsAccountId,
        amount: 250,
      })
      .expect(201);
    failedPaymentId = initiate.body.id;
    failedPaymentReference = initiate.body.gatewayReference;

    await request(app.getHttpServer())
      .post('/payments/webhook/paystack')
      .send(webhookBody('charge.failed', failedPaymentReference, 25000))
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: failedPaymentId },
    });
    expect(payment.status).toBe('FAILED');

    const account = await prisma.savingsAccount.findUniqueOrThrow({
      where: { id: savingsAccountId },
    });
    expect(account.balance.toString()).toBe('500');
  });

  it('lets the payer manually verify a payment if the webhook has not landed yet', async () => {
    const initiate = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ purpose: 'LOAN_REPAYMENT', targetId: loanId, amount: 1000 })
      .expect(201);

    verifyTransactionMock.mockResolvedValueOnce({
      status: 'success',
      reference: initiate.body.gatewayReference,
      amountKobo: 100000,
    });

    const verified = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${initiate.body.id}/verify`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);
    expect(verified.body.status).toBe('SUCCESS');

    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(Number(loan.outstandingBalance)).toBeLessThan(6000);
  });

  it('lets the checkout-return page verify by Paystack reference alone', async () => {
    const initiate = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        purpose: 'SAVINGS_DEPOSIT',
        targetId: savingsAccountId,
        amount: 50,
      })
      .expect(201);

    verifyTransactionMock.mockResolvedValueOnce({
      status: 'success',
      reference: initiate.body.gatewayReference,
      amountKobo: 5000,
    });

    const verified = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/by-reference/${initiate.body.gatewayReference}/verify`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);
    expect(verified.body.status).toBe('SUCCESS');
    expect(verified.body.id).toBe(initiate.body.id);
  });

  it("denies an outsider from manually verifying someone else's payment", async () => {
    const initiate = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        purpose: 'SAVINGS_DEPOSIT',
        targetId: savingsAccountId,
        amount: 100,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${initiate.body.id}/verify`,
      )
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets the member view their own payment history, but not an outsider', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members/${memberUserId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members/${memberUserId}/payments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets governance reconcile the cooperative-wide payment ledger, filtered by status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/payments?status=SUCCESS`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      res.body.every((p: { status: string }) => p.status === 'SUCCESS'),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('lists Nigerian banks for the connect-bank-account form', async () => {
    const res = await request(app.getHttpServer())
      .get('/cooperatives/payments/banks')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body).toEqual([{ name: 'Test Mock Bank', code: '000', slug: 'test-mock-bank' }]);
  });
});
