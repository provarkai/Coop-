import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Every non-MEMBER cooperative role should have at least read access to the dashboard,
// savings, loans, and accounting sections, even roles with no specific manage permission
// there (e.g. a SECRETARY has never been able to manage savings, but should still be able
// to see them) -- while write/manage actions stay restricted to the narrower functional
// role lists, and a plain MEMBER still can't view any of it.
describe('Exco-wide read access (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `exco-admin-${suffix}@example.com`;
  const secretaryEmail = `exco-secretary-${suffix}@example.com`;
  const committeeEmail = `exco-committee-${suffix}@example.com`;
  const memberEmail = `exco-member-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `exco-coop-${suffix}`;

  let adminToken: string;
  let secretaryToken: string;
  let committeeToken: string;
  let memberToken: string;
  let cooperativeId: string;

  async function registerAndLogin(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'User' })
      .expect(201);
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

    adminToken = await registerAndLogin(adminEmail);
    secretaryToken = await registerAndLogin(secretaryEmail);
    committeeToken = await registerAndLogin(committeeEmail);
    memberToken = await registerAndLogin(memberEmail);

    const coop = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Exco Read Access Test Cooperative', slug })
      .expect(201);
    cooperativeId = coop.body.id;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: secretaryEmail, role: 'SECRETARY' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: committeeEmail, role: 'COMMITTEE_MEMBER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, secretaryEmail, committeeEmail, memberEmail],
        },
      },
    });
    await app.close();
  });

  it('lets a SECRETARY (no savings-manage permission) view the dashboard, savings, loans, and accounting', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/dashboard`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/savings/accounts`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/accounts`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
  });

  it('lets a COMMITTEE_MEMBER (the least-privileged exco role) view the dashboard too', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/dashboard`)
      .set('Authorization', `Bearer ${committeeToken}`)
      .expect(200);
  });

  it("still denies a SECRETARY from actually managing savings (read access isn't write access)", async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ name: 'Should be denied', code: 'DENY' })
      .expect(403);
  });

  it('still denies a plain MEMBER from viewing the dashboard, savings, loans, or accounting', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/dashboard`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/savings/accounts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/accounting/accounts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
