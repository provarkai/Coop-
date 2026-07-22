import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cooperatives (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `coop-admin-${suffix}@example.com`;
  const memberEmail = `coop-member-${suffix}@example.com`;
  const outsiderEmail = `coop-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `test-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberUserId: string;
  let cooperativeId: string;
  let branchId: string;
  let committeeId: string;

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail, outsiderEmail] } },
    });
    await app.close();
  });

  it('creates a cooperative and makes the creator its COOPERATIVE_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Cooperative', slug })
      .expect(201);

    cooperativeId = res.body.id;
    expect(res.body.slug).toBe(slug);

    const members = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(members.body).toHaveLength(1);
    expect(members.body[0].role).toBe('COOPERATIVE_ADMIN');
  });

  it('rejects a duplicate slug', async () => {
    await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Another Cooperative', slug })
      .expect(409);
  });

  it('denies access to non-members', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('only shows a user their own cooperatives', async () => {
    const res = await request(app.getHttpServer())
      .get('/cooperatives')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('lets the admin update cooperative settings', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bylaws: 'Members must attend the AGM',
        financialYearStartMonth: 4,
      })
      .expect(200);

    expect(res.body.bylaws).toBe('Members must attend the AGM');
    expect(res.body.financialYearStartMonth).toBe(4);
  });

  it('creates a branch as admin and rejects a duplicate name', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/branches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Head Office', isHeadOffice: true })
      .expect(201);
    branchId = res.body.id;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/branches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Head Office' })
      .expect(409);
  });

  it('rejects branch creation from a non-member', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/branches`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Rogue Branch' })
      .expect(403);
  });

  it('adds an existing platform user as a cooperative member with a given role', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'TREASURER' })
      .expect(201);

    expect(res.body.role).toBe('TREASURER');
    expect(res.body.userId).toBe(memberUserId);
  });

  it('rejects adding the same member twice', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(409);
  });

  it('lets a newly added member read the cooperative, but not manage it', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/branches`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Another Branch' })
      .expect(403);
  });

  it('creates a committee and adds the member to it', async () => {
    const committee = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/committees`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Finance Committee', description: 'Oversees budgets' })
      .expect(201);
    committeeId = committee.body.id;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/committees/${committeeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, title: 'Chair' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/committees`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body[0].members).toHaveLength(1);
    expect(list.body[0].members[0].title).toBe('Chair');
  });

  it('refuses to add a non-cooperative-member to a committee', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/committees/${committeeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: outsiderEmail, title: 'Member' })
      .expect(400);
  });

  it("updates a member's role and then removes their membership", async () => {
    await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'CHAIRMAN' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/cooperatives/${cooperativeId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('deletes a branch', async () => {
    await request(app.getHttpServer())
      .delete(`/cooperatives/${cooperativeId}/branches/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const branches = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/branches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(branches.body).toEqual([]);
  });
});
