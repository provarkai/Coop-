import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    const coop = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Payments Test Cooperative', slug })
      .expect(201);
    cooperativeId = coop.body.id;

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

  it('lets the member initiate a savings deposit payment', async () => {
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
    expect(res.body.status).toBe('INITIATED');
    expect(res.body.gatewayReference).toMatch(/^SIM-/);
  });

  it('denies an outsider from simulating the callback', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${savingsPaymentId}/simulate-callback`,
      )
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ outcome: 'SUCCESS' })
      .expect(403);
  });

  it('applies the savings deposit once the callback succeeds', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${savingsPaymentId}/simulate-callback`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ outcome: 'SUCCESS' })
      .expect(201);
    expect(res.body.status).toBe('SUCCESS');

    const account = await prisma.savingsAccount.findUniqueOrThrow({
      where: { id: savingsAccountId },
    });
    expect(account.balance.toString()).toBe('500');
  });

  it('refuses to complete an already-completed payment', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${savingsPaymentId}/simulate-callback`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ outcome: 'SUCCESS' })
      .expect(400);
  });

  let failedPaymentId: string;

  it('records a failed callback without any side effect', async () => {
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

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${failedPaymentId}/simulate-callback`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'FAILED' })
      .expect(201);

    const account = await prisma.savingsAccount.findUniqueOrThrow({
      where: { id: savingsAccountId },
    });
    expect(account.balance.toString()).toBe('500');
  });

  it('applies a loan repayment payment once the callback succeeds', async () => {
    const initiate = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ purpose: 'LOAN_REPAYMENT', targetId: loanId, amount: 1000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/payments/${initiate.body.id}/simulate-callback`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ outcome: 'SUCCESS' })
      .expect(201);

    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
    expect(Number(loan.outstandingBalance)).toBeLessThan(6000);
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
});
