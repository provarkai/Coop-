import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiClientService } from '../src/ai/ai-client.service';

describe('Reports & Dashboards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `reports-admin-${suffix}@example.com`;
  const memberEmail = `reports-member-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `reports-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let memberUserId: string;
  let cooperativeId: string;
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
    })
      .overrideProvider(AiClientService)
      .useValue({ chat: () => Promise.resolve('MOCK AI NARRATIVE') })
      .compile();

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

    const coop = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reports Test Cooperative', slug })
      .expect(201);
    cooperativeId = coop.body.id;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(201);

    // Savings: deposit 1000
    const savingsProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ordinary', code: 'ORD' })
      .expect(201);
    const savingsAccount = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: savingsProduct.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${savingsAccount.body.id}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'DEPOSIT', amount: 1000 })
      .expect(201);

    // Loan: disburse 6000, repay 1060 (interest-first: 60 interest, 1000 principal)
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
    loanId = loan.body.id;
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/disburse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/repayments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1060 })
      .expect(201);

    // Meeting + resolution, so upcomingMeetings/openResolutions are non-zero
    const futureDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const meeting = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'AGM', type: 'AGM', scheduledAt: futureDate })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meeting.body.id}/resolutions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Adopt budget' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail] } },
    });
    await app.close();
  });

  it('denies a plain member from viewing the dashboard', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/dashboard`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('computes accurate KPI totals for governance', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.activeMembers).toBe(2);
    expect(res.body.pendingApplications).toBe(0);
    expect(res.body.totalSavingsBalance).toBe('1000.00');
    // outstandingBalance starts at principal + total scheduled interest (6000 + 6*60 = 6360),
    // reduced by the 1060 repayment => 5300
    expect(res.body.totalOutstandingLoans).toBe('5300.00');
    expect(res.body.loansDisbursedThisMonth).toBe('6000.00');
    expect(res.body.cashBalance).toBe('-3940.00');
    expect(res.body.totalIncome).toBe('60.00');
    expect(res.body.totalExpense).toBe('0.00');
    expect(res.body.netSurplus).toBe('60.00');
    expect(res.body.upcomingMeetings).toBe(1);
    expect(res.body.openResolutions).toBe(1);
  });

  it("computes month-over-month trends reflecting this month's activity", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/dashboard/trends?months=3`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveLength(3);
    const currentMonth = res.body[res.body.length - 1];
    expect(currentMonth.newMembers).toBe(2);
    expect(currentMonth.savingsNet).toBe('1000.00');
    expect(currentMonth.loanDisbursed).toBe('6000.00');
    expect(currentMonth.loanRepaid).toBe('1060.00');
  });

  it('denies a plain member from exporting CSVs', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/exports/members.csv`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('exports members as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/exports/members.csv`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toBe(
      'membershipNumber,firstName,lastName,email,role,status,category,joinedAt',
    );
    expect(res.text).toContain(memberEmail);
  });

  it('exports savings transactions as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/exports/savings-transactions.csv`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.text).toContain('DEPOSIT');
    expect(res.text).toContain('1000.00');
  });

  it('exports loans as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/exports/loans.csv`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.text).toContain('5300.00');
    expect(res.text).toContain('ACTIVE');
  });

  it('exports journal entries as CSV', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/exports/journal-entries.csv`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.text).toContain('1000');
    expect(res.text).toContain('SAVINGS');
    expect(res.text).toContain('LOAN');
  });

  it('denies a plain member from generating the monthly digest', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/reports/monthly-digest`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('lets governance generate the monthly digest as a downloadable PDF and notifies members', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/reports/monthly-digest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.category).toBe('REPORT');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.title).toContain('Monthly Report');

    const download = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/documents/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect((download.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const notifications = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/notifications`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(
      notifications.body.some((n: { subject: string | null }) =>
        n.subject?.includes('Monthly report ready'),
      ),
    ).toBe(true);
  });
});
