import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `notif-admin-${suffix}@example.com`;
  const memberEmail = `notif-member-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `notif-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let cooperativeId: string;

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

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Notifications Test Cooperative',
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

  it('denies a plain member from sending an announcement', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/notifications/announcements`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ channel: 'SMS', body: 'Should not work' })
      .expect(403);
  });

  it('lets governance broadcast an announcement to every active member via a simulated channel', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/notifications/announcements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        channel: 'SMS',
        subject: 'Dues reminder',
        body: 'Annual dues are due end of month.',
      })
      .expect(201);

    // admin + member = 2 active memberships, both notified
    expect(res.body).toHaveLength(2);
    expect(
      res.body.every(
        (n: { status: string; channel: string }) =>
          n.status === 'SENT' && n.channel === 'SMS',
      ),
    ).toBe(true);
  });

  it('lets a member view only their own received notifications', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/notifications`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].body).toBe('Annual dues are due end of month.');
  });

  it('denies a plain member from viewing the full cooperative notification log', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/notifications/all`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('lets governance view the full cooperative notification log', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/notifications/all`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveLength(2);
  });
});
