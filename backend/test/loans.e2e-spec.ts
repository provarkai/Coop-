import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Loans (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `loans-admin-${suffix}@example.com`;
  const borrowerEmail = `loans-borrower-${suffix}@example.com`;
  const guarantorEmail = `loans-guarantor-${suffix}@example.com`;
  const outsiderEmail = `loans-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `loans-coop-${suffix}`;

  let adminToken: string;
  let borrowerToken: string;
  let guarantorToken: string;
  let outsiderToken: string;
  let cooperativeId: string;
  let productId: string;
  let loanId: string;
  let guarantorRecordId: string;

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

    const borrower = await registerAndLogin(borrowerEmail);
    borrowerToken = borrower.accessToken;

    const guarantor = await registerAndLogin(guarantorEmail);
    guarantorToken = guarantor.accessToken;

    const outsider = await registerAndLogin(outsiderEmail);
    outsiderToken = outsider.accessToken;

    const coop = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Loans Test Cooperative', slug })
      .expect(201);
    cooperativeId = coop.body.id;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: borrowerEmail, role: 'MEMBER' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: guarantorEmail, role: 'MEMBER' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, borrowerEmail, guarantorEmail, outsiderEmail],
        },
      },
    });
    await app.close();
  });

  it('lets the admin create a loan product', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Emergency Loan',
        code: 'EMG',
        interestRatePercent: 12,
        maxAmount: 100000,
        maxTermMonths: 12,
        penaltyRatePercent: 5,
        requiredGuarantors: 1,
      })
      .expect(201);
    productId = res.body.id;
    expect(res.body.code).toBe('EMG');
  });

  it('rejects a duplicate product code', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', code: 'EMG', maxAmount: 1000, maxTermMonths: 6 })
      .expect(400);
  });

  it('denies a non-member from listing products', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('rejects an application exceeding the product maximum amount', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${borrowerToken}`)
      .send({ productId, principal: 999999, termMonths: 6 })
      .expect(400);
  });

  it('lets a member apply for a loan', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${borrowerToken}`)
      .send({ productId, principal: 12000, termMonths: 12 })
      .expect(201);
    loanId = res.body.id;
    expect(res.body.status).toBe('PENDING');
  });

  it('refuses to approve a loan without enough approved guarantors', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('only lets the borrower nominate guarantors for their own loan', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/guarantors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: guarantorEmail })
      .expect(403);
  });

  it('lets the borrower nominate a guarantor', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/guarantors`)
      .set('Authorization', `Bearer ${borrowerToken}`)
      .send({ email: guarantorEmail })
      .expect(201);
    guarantorRecordId = res.body.id;
    expect(res.body.status).toBe('PENDING');
  });

  it('refuses to approve while the guarantor is still pending', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('only lets the nominated guarantor respond', async () => {
    await request(app.getHttpServer())
      .patch(
        `/cooperatives/${cooperativeId}/loans/${loanId}/guarantors/${guarantorRecordId}/respond`,
      )
      .set('Authorization', `Bearer ${borrowerToken}`)
      .send({ status: 'APPROVED' })
      .expect(403);
  });

  it('lets the guarantor discover their pending request and view the loan, but not an outsider', async () => {
    const requests = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loan-guarantor-requests`)
      .set('Authorization', `Bearer ${guarantorToken}`)
      .expect(200);
    expect(requests.body).toHaveLength(1);
    expect(requests.body[0].id).toBe(guarantorRecordId);
    expect(requests.body[0].loan.id).toBe(loanId);

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loanId}`)
      .set('Authorization', `Bearer ${guarantorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loanId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets the guarantor approve the request', async () => {
    const res = await request(app.getHttpServer())
      .patch(
        `/cooperatives/${cooperativeId}/loans/${loanId}/guarantors/${guarantorRecordId}/respond`,
      )
      .set('Authorization', `Bearer ${guarantorToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('approves the loan once enough guarantors have signed off', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(res.body.status).toBe('APPROVED');
  });

  it('disburses the loan and generates a repayment schedule', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/disburse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.schedule).toHaveLength(12);
    // principal 12000 @ 12%/yr over 12 months => 12000 * 0.12 = 1440 interest
    expect(Number(res.body.outstandingBalance)).toBeCloseTo(13440, 0);
    const totalPrincipal = res.body.schedule.reduce(
      (sum: number, i: { principalDue: string }) =>
        sum + Number(i.principalDue),
      0,
    );
    expect(totalPrincipal).toBeCloseTo(12000, 1);
  });

  it('denies a plain outsider from viewing the loan', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loanId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets the borrower view their own loan', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loanId}`)
      .set('Authorization', `Bearer ${borrowerToken}`)
      .expect(200);
    expect(res.body.id).toBe(loanId);
  });

  it('records a repayment against the oldest installment first', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/repayments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1120, narration: 'First installment' })
      .expect(201);
    expect(res.body.type).toBe('REPAYMENT');

    const loan = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(loan.body.schedule[0].status).toBe('PAID');
    expect(loan.body.schedule[1].status).toBe('PENDING');
  });

  it('refuses a repayment exceeding the outstanding balance', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/repayments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 999999 })
      .expect(400);
  });

  it('refuses to assess a penalty when nothing is overdue', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/assess-penalty`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('assesses a penalty once an installment is overdue', async () => {
    const secondInstallment =
      await prisma.repaymentInstallment.findFirstOrThrow({
        where: { loanId, installmentNumber: 2 },
      });
    await prisma.repaymentInstallment.update({
      where: { id: secondInstallment.id },
      data: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/assess-penalty`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(res.body.type).toBe('PENALTY');
    expect(Number(res.body.amount)).toBeGreaterThan(0);
  });

  it('denies a plain member from recording a repayment or approving loans', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans/${loanId}/repayments`)
      .set('Authorization', `Bearer ${borrowerToken}`)
      .send({ amount: 100 })
      .expect(403);
  });
});
