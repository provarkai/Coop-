import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Regulatory compliance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const superAdminEmail = `compliance-super-${suffix}@example.com`;
  const regulatorEmail = `compliance-regulator-${suffix}@example.com`;
  const coopAdminEmail = `compliance-coopadmin-${suffix}@example.com`;
  const outsiderEmail = `compliance-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `compliance-coop-${suffix}`;

  let superAdminToken: string;
  let regulatorToken: string;
  let regulatorUserId: string;
  let coopAdminToken: string;
  let outsiderToken: string;
  let cooperativeId: string;
  let filingId: string;

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

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
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

    const superAdmin = await registerAndLogin(superAdminEmail);
    // Bootstrapping: no admin exists yet to grant the role via the API, so
    // the very first SUPER_ADMIN is set directly, same as in production.
    await prisma.user.update({
      where: { id: superAdmin.userId },
      data: { role: Role.SUPER_ADMIN },
    });
    superAdminToken = await login(superAdminEmail);

    const regulator = await registerAndLogin(regulatorEmail);
    regulatorUserId = regulator.userId;

    coopAdminToken = (await registerAndLogin(coopAdminEmail)).accessToken;
    outsiderToken = (await registerAndLogin(outsiderEmail)).accessToken;

    const coop = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Compliance Coop',
        slug,
        state: 'Lagos',
        initialAdminEmail: coopAdminEmail,
      })
      .expect(201);
    cooperativeId = coop.body.id;
  });

  afterAll(async () => {
    // Delete the cooperative first: it cascades to ComplianceFiling, which
    // otherwise blocks deleting the users referenced by submittedByUserId.
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [superAdminEmail, regulatorEmail, coopAdminEmail, outsiderEmail],
        },
      },
    });
    await app.close();
  });

  it('rejects a non-admin listing platform users or changing roles', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/users/${regulatorUserId}/role`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ role: 'REGULATOR' })
      .expect(403);
  });

  it('lets a SUPER_ADMIN list users and promote one to REGULATOR', async () => {
    const list = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(
      list.body.some((u: { email: string }) => u.email === regulatorEmail),
    ).toBe(true);

    const promoted = await request(app.getHttpServer())
      .patch(`/users/${regulatorUserId}/role`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ role: 'REGULATOR' })
      .expect(200);
    expect(promoted.body.role).toBe('REGULATOR');

    // JWTs embed the role at issue time, so the promoted user needs a fresh
    // token before the new role takes effect.
    regulatorToken = await login(regulatorEmail);
  });

  it('denies compliance oversight routes to non-regulators', async () => {
    await request(app.getHttpServer())
      .get('/compliance/cooperatives')
      .set('Authorization', `Bearer ${coopAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/compliance/filings')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('denies a regulator access to a cooperative they are not yet assigned to', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(403);
  });

  it('lets a SUPER_ADMIN assign the regulator to the cooperative (by location)', async () => {
    await request(app.getHttpServer())
      .post('/compliance/assignments')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ cooperativeId, regulatorEmail })
      .expect(201);

    // A non-SUPER_ADMIN, even a regulator, cannot assign themselves.
    await request(app.getHttpServer())
      .post('/compliance/assignments')
      .set('Authorization', `Bearer ${regulatorToken}`)
      .send({ cooperativeId, regulatorEmail })
      .expect(403);
  });

  it('lets an assigned regulator view the cooperative without being a member', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(200);
  });

  it("lets an assigned regulator view the cooperative's financial standing and meetings", async () => {
    await request(app.getHttpServer())
      .get(`/compliance/cooperatives/${cooperativeId}/financial-standing`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/compliance/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(200);
  });

  it('denies an unassigned regulator access to this cooperative', async () => {
    const otherRegulatorEmail = `compliance-other-regulator-${suffix}@example.com`;
    const other = await registerAndLogin(otherRegulatorEmail);
    await prisma.user.update({
      where: { id: other.userId },
      data: { role: Role.REGULATOR },
    });
    const otherRegulatorToken = await login(otherRegulatorEmail);

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${otherRegulatorToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/compliance/cooperatives/${cooperativeId}/financial-standing`)
      .set('Authorization', `Bearer ${otherRegulatorToken}`)
      .expect(403);

    // Unlike cooperative-scoped routes, the cross-tenant /compliance/cooperatives
    // list simply omits cooperatives the regulator isn't assigned to.
    const list = await request(app.getHttpServer())
      .get('/compliance/cooperatives')
      .set('Authorization', `Bearer ${otherRegulatorToken}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === cooperativeId)).toBe(
      false,
    );

    await prisma.user.deleteMany({ where: { email: otherRegulatorEmail } });
  });

  it('lets governance submit a compliance filing, visible to cooperative members', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/compliance-filings`)
      .set('Authorization', `Bearer ${coopAdminToken}`)
      .send({
        type: 'ANNUAL_RETURN',
        period: 'FY2025',
        title: '2025 Annual Return',
      })
      .expect(201);
    filingId = res.body.id;
    expect(res.body.status).toBe('SUBMITTED');

    const list = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/compliance-filings`)
      .set('Authorization', `Bearer ${coopAdminToken}`)
      .expect(200);
    expect(list.body.some((f: { id: string }) => f.id === filingId)).toBe(true);
  });

  it('rejects filing submission from a non-governance member', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/compliance-filings`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .send({ type: 'OTHER', period: 'x', title: 'x' })
      .expect(403);
  });

  it('lets a regulator see the filing cross-tenant and review it', async () => {
    const cooperatives = await request(app.getHttpServer())
      .get('/compliance/cooperatives')
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(200);
    expect(
      cooperatives.body.some((c: { id: string }) => c.id === cooperativeId),
    ).toBe(true);

    const filings = await request(app.getHttpServer())
      .get('/compliance/filings')
      .query({ status: 'SUBMITTED' })
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(200);
    expect(filings.body.some((f: { id: string }) => f.id === filingId)).toBe(
      true,
    );

    const detail = await request(app.getHttpServer())
      .get(`/compliance/filings/${filingId}`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .expect(200);
    expect(detail.body.cooperative.slug).toBe(slug);

    const reviewed = await request(app.getHttpServer())
      .patch(`/compliance/filings/${filingId}/review`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .send({ status: 'APPROVED', reviewNotes: 'Looks good' })
      .expect(200);
    expect(reviewed.body.status).toBe('APPROVED');
  });

  it('refuses to review an already-reviewed filing', async () => {
    await request(app.getHttpServer())
      .patch(`/compliance/filings/${filingId}/review`)
      .set('Authorization', `Bearer ${regulatorToken}`)
      .send({ status: 'REJECTED' })
      .expect(400);
  });

  it('records the filing lifecycle in the cooperative audit log', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/audit-logs`)
      .set('Authorization', `Bearer ${coopAdminToken}`)
      .expect(200);

    const actions = res.body.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'compliance.filing_submitted',
        'compliance.filing_reviewed',
      ]),
    );
  });
});
