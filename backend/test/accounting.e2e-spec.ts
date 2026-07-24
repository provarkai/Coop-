import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';

describe('Accounting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `accounting-admin-${suffix}@example.com`;
  const memberEmail = `accounting-member-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `accounting-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let memberUserId: string;
  let cooperativeId: string;
  let cashAccountId: string;
  let memberSavingsAccountId: string;
  let loansReceivableAccountId: string;
  let interestIncomeAccountId: string;

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

  function balanceOf(
    trialBalance: { account: { code: string } }[],
    code: string,
  ) {
    const row = trialBalance.find((r) => r.account.code === code) as
      { totalDebit: string; totalCredit: string; balance: string } | undefined;
    return row;
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

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Accounting Test Cooperative',
        slug,
        initialAdminEmail: adminEmail,
      })
    ).cooperativeId;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail] } },
    });
    await app.close();
  });

  it('denies a plain member from viewing the chart of accounts', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/accounts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('auto-seeds the default chart of accounts on first access', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/accounts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(6);
    cashAccountId = res.body.find(
      (a: { code: string }) => a.code === '1000',
    ).id;
    memberSavingsAccountId = res.body.find(
      (a: { code: string }) => a.code === '2000',
    ).id;
    loansReceivableAccountId = res.body.find(
      (a: { code: string }) => a.code === '1100',
    ).id;
    interestIncomeAccountId = res.body.find(
      (a: { code: string }) => a.code === '4000',
    ).id;
  });

  it('auto-posts a balanced journal entry when a savings deposit is recorded', async () => {
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

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${account.body.id}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'DEPOSIT', amount: 1000 })
      .expect(201);

    const trialBalance = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/trial-balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(balanceOf(trialBalance.body, '1000')?.balance).toBe('1000');
    expect(balanceOf(trialBalance.body, '2000')?.balance).toBe('-1000');
  });

  it('auto-posts a balanced journal entry for loan disbursement and repayment', async () => {
    const loanProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Quick Loan',
        code: 'QL',
        interestRatePercent: 12,
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

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loan.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loan.body.id}/disburse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    let trialBalance = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/trial-balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    // cash: +1000 (savings deposit) - 6000 (loan disbursement) = -5000
    expect(balanceOf(trialBalance.body, '1000')?.balance).toBe('-5000');
    expect(balanceOf(trialBalance.body, '1100')?.balance).toBe('6000');

    // First installment: principal 1000, interest 60 (6000 * 12% / 12 months * 6 = 360 / 6)
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loan.body.id}/repayments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1060 })
      .expect(201);

    trialBalance = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/trial-balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(balanceOf(trialBalance.body, '1000')?.balance).toBe('-3940');
    expect(balanceOf(trialBalance.body, '1100')?.balance).toBe('5000');
    expect(balanceOf(trialBalance.body, '4000')?.balance).toBe('-60');
  });

  it('rejects an unbalanced manual journal entry', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/accounting/journal-entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memo: 'Unbalanced test',
        lines: [
          { accountId: cashAccountId, debit: 100 },
          { accountId: memberSavingsAccountId, credit: 50 },
        ],
      })
      .expect(400);
  });

  it('rejects a line with both debit and credit set', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/accounting/journal-entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: [
          { accountId: cashAccountId, debit: 100, credit: 100 },
          { accountId: memberSavingsAccountId, credit: 100 },
        ],
      })
      .expect(400);
  });

  it('lets governance post a balanced manual journal entry', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/accounting/journal-entries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        memo: 'Manual adjustment',
        lines: [
          { accountId: loansReceivableAccountId, debit: 200 },
          { accountId: interestIncomeAccountId, credit: 200 },
        ],
      })
      .expect(201);
    expect(res.body.lines).toHaveLength(2);
  });

  it('denies a plain member from posting a journal entry', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/accounting/journal-entries`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        lines: [
          { accountId: cashAccountId, debit: 10 },
          { accountId: memberSavingsAccountId, credit: 10 },
        ],
      })
      .expect(403);
  });

  it('produces an income statement and balance sheet', async () => {
    const income = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/income-statement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Number(income.body.totalIncome)).toBeGreaterThan(0);

    const balanceSheet = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/balance-sheet`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(balanceSheet.body.assets.length).toBeGreaterThan(0);
  });

  it('sets a budget and reports variance against actual', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/accounting/budgets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountId: interestIncomeAccountId,
        period: '2026',
        plannedAmount: 1000,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/budgets?period=2026`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].budget.plannedAmount).toBe('1000');
  });
});
