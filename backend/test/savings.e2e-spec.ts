import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';

describe('Savings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `savings-admin-${suffix}@example.com`;
  const memberEmail = `savings-member-${suffix}@example.com`;
  const outsiderEmail = `savings-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `savings-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberUserId: string;
  let cooperativeId: string;
  let productId: string;
  let accountId: string;
  let depositTransactionId: string;

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

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Savings Test Cooperative',
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
      where: { email: { in: [adminEmail, memberEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('lets a cooperative admin create a savings product', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Ordinary Savings',
        code: 'ORD',
        interestRatePercent: 10,
        minimumBalance: 100,
      })
      .expect(201);
    productId = res.body.id;
    expect(res.body.code).toBe('ORD');
  });

  it('rejects a duplicate product code', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', code: 'ORD' })
      .expect(400);
  });

  it('denies non-members from listing products', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('denies a plain member from opening an account for themselves', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ productId })
      .expect(403);
  });

  it('lets the admin open a savings account for the member', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId })
      .expect(201);
    accountId = res.body.id;
    expect(res.body.balance).toBe('0');
  });

  it('rejects opening a second account for the same product', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId })
      .expect(400);
  });

  it('lets the member view their own account, but not an outsider', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);

    await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('denies a plain member from recording a transaction', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ type: 'DEPOSIT', amount: 1000 })
      .expect(403);
  });

  it('lets the admin record a deposit', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'DEPOSIT', amount: 1000, narration: 'Opening deposit' })
      .expect(201);
    depositTransactionId = res.body.id;
    expect(res.body.balanceAfter).toBe('1000');
  });

  it('rejects a withdrawal that would breach the minimum balance', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'WITHDRAWAL', amount: 950 })
      .expect(400);
  });

  it('lets the admin record a valid withdrawal', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'WITHDRAWAL', amount: 400 })
      .expect(201);
    expect(res.body.balanceAfter).toBe('600');
  });

  it('lists the account statement for the member, but not an outsider', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body).toHaveLength(2);

    await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions`,
      )
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('generates a receipt with a QR code for a transaction', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/transactions/${depositTransactionId}/receipt`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.account.accountNumber).toBeTruthy();
  });

  it('refuses to accrue interest before any time has passed', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/accrue-interest`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('accrues interest once enough time has passed', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.savingsAccount.update({
      where: { id: accountId },
      data: { openedAt: thirtyDaysAgo },
    });

    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountId}/accrue-interest`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    // 600 balance * 10% annual * 30/365 days ≈ 4.93
    expect(Number(res.body.amount)).toBeCloseTo(4.93, 1);
    expect(res.body.type).toBe('INTEREST');
  });

  it('lists all savings accounts for the cooperative to a treasurer-level role', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/savings/accounts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
  });
});
