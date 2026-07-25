import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Federation/apex layer for unions of cooperatives (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const superAdminEmail = `union-super-${suffix}@example.com`;
  const unionAdminEmail = `union-admin-${suffix}@example.com`;
  const outsiderEmail = `union-outsider-${suffix}@example.com`;
  const coopAdminAEmail = `union-coopadmin-a-${suffix}@example.com`;
  const coopAdminBEmail = `union-coopadmin-b-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const unionSlug = `test-union-${suffix}`;
  const slugA = `union-coop-a-${suffix}`;
  const slugB = `union-coop-b-${suffix}`;

  let superAdminToken: string;
  let unionAdminToken: string;
  let unionAdminUserId: string;
  let outsiderToken: string;
  let coopAdminAToken: string;
  let unionId: string;
  let cooperativeAId: string;
  let cooperativeBId: string;
  let assignmentId: string;

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
    await prisma.user.update({
      where: { id: superAdmin.userId },
      data: { role: Role.SUPER_ADMIN },
    });
    superAdminToken = await login(superAdminEmail);

    const unionAdmin = await registerAndLogin(unionAdminEmail);
    unionAdminUserId = unionAdmin.userId;

    outsiderToken = (await registerAndLogin(outsiderEmail)).accessToken;
    coopAdminAToken = (await registerAndLogin(coopAdminAEmail)).accessToken;
    await registerAndLogin(coopAdminBEmail);

    const coopA = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Union Coop A',
        slug: slugA,
        state: 'Lagos',
        initialAdminEmail: coopAdminAEmail,
      })
      .expect(201);
    cooperativeAId = coopA.body.id;

    const coopB = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Union Coop B',
        slug: slugB,
        state: 'Ogun',
        initialAdminEmail: coopAdminBEmail,
      })
      .expect(201);
    cooperativeBId = coopB.body.id;
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({
      where: { id: { in: [cooperativeAId, cooperativeBId] } },
    });
    await prisma.union.deleteMany({ where: { id: unionId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            superAdminEmail,
            unionAdminEmail,
            outsiderEmail,
            coopAdminAEmail,
            coopAdminBEmail,
          ],
        },
      },
    });
    await app.close();
  });

  it('denies a non-SUPER_ADMIN from creating a union', async () => {
    await request(app.getHttpServer())
      .post('/unions')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Test Union', slug: unionSlug })
      .expect(403);
  });

  it('lets a SUPER_ADMIN create a union', async () => {
    const res = await request(app.getHttpServer())
      .post('/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Test Union', slug: unionSlug, description: 'A test apex body' })
      .expect(201);
    expect(res.body.slug).toBe(unionSlug);
    unionId = res.body.id;
  });

  it('rejects creating a second union with the same slug', async () => {
    await request(app.getHttpServer())
      .post('/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Duplicate', slug: unionSlug })
      .expect(409);
  });

  it('denies an outsider (no union role) from viewing the union', async () => {
    await request(app.getHttpServer())
      .get(`/unions/${unionId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets a SUPER_ADMIN attach cooperatives to the union', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/unions/${unionId}/cooperatives/${cooperativeAId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(res.body.id).toBe(cooperativeAId);

    await request(app.getHttpServer())
      .patch(`/unions/${unionId}/cooperatives/${cooperativeBId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
  });

  it('rejects attaching a cooperative that already belongs to a union', async () => {
    await request(app.getHttpServer())
      .patch(`/unions/${unionId}/cooperatives/${cooperativeAId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(400);
  });

  it('denies a cooperative admin (not a union role) from assigning union admins', async () => {
    await request(app.getHttpServer())
      .post(`/unions/${unionId}/assignments`)
      .set('Authorization', `Bearer ${coopAdminAToken}`)
      .send({ email: unionAdminEmail })
      .expect(403);
  });

  it('rejects assigning a user without the UNION_ADMIN platform role', async () => {
    await request(app.getHttpServer())
      .post(`/unions/${unionId}/assignments`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: unionAdminEmail })
      .expect(400);
  });

  it('lets a SUPER_ADMIN promote a user to UNION_ADMIN and assign them to the union', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${unionAdminUserId}/role`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ role: 'UNION_ADMIN' })
      .expect(200);
    unionAdminToken = await login(unionAdminEmail);

    const res = await request(app.getHttpServer())
      .post(`/unions/${unionId}/assignments`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: unionAdminEmail })
      .expect(201);
    assignmentId = res.body.id;
  });

  it('rejects assigning the same union admin twice', async () => {
    await request(app.getHttpServer())
      .post(`/unions/${unionId}/assignments`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: unionAdminEmail })
      .expect(409);
  });

  it('lets the assigned union admin view the union and its member cooperatives', async () => {
    const res = await request(app.getHttpServer())
      .get(`/unions/${unionId}`)
      .set('Authorization', `Bearer ${unionAdminToken}`)
      .expect(200);
    expect(res.body.cooperatives).toHaveLength(2);
    expect(
      res.body.cooperatives.some((c: { id: string }) => c.id === cooperativeAId),
    ).toBe(true);
    expect(
      res.body.cooperatives.some((c: { id: string }) => c.id === cooperativeBId),
    ).toBe(true);
  });

  it("lists only the union admin's own assigned unions from GET /unions", async () => {
    const res = await request(app.getHttpServer())
      .get('/unions')
      .set('Authorization', `Bearer ${unionAdminToken}`)
      .expect(200);
    expect(res.body.some((u: { id: string }) => u.id === unionId)).toBe(true);
  });

  it('rolls up member counts across both member cooperatives on the dashboard', async () => {
    // Each cooperative already has one active member (its COOPERATIVE_ADMIN,
    // added automatically at creation via initialAdminEmail), so the rollup
    // across both member cooperatives should already be at least 2.
    const dashboard = await request(app.getHttpServer())
      .get(`/unions/${unionId}/dashboard`)
      .set('Authorization', `Bearer ${unionAdminToken}`)
      .expect(200);
    expect(dashboard.body.cooperativeCount).toBe(2);
    expect(dashboard.body.activeMembers).toBeGreaterThanOrEqual(2);
    expect(dashboard.body.cooperatives).toHaveLength(2);
  });

  it('denies an unassigned union admin from viewing the dashboard', async () => {
    const otherUnionAdminEmail = `union-other-admin-${suffix}@example.com`;
    const other = await registerAndLogin(otherUnionAdminEmail);
    await prisma.user.update({
      where: { id: other.userId },
      data: { role: Role.UNION_ADMIN },
    });
    const otherToken = await login(otherUnionAdminEmail);

    await request(app.getHttpServer())
      .get(`/unions/${unionId}/dashboard`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await prisma.user.deleteMany({ where: { email: otherUnionAdminEmail } });
  });

  it('lets a SUPER_ADMIN detach a cooperative from the union', async () => {
    await request(app.getHttpServer())
      .delete(`/unions/${unionId}/cooperatives/${cooperativeBId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const dashboard = await request(app.getHttpServer())
      .get(`/unions/${unionId}/dashboard`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(dashboard.body.cooperativeCount).toBe(1);
  });

  it('lets a SUPER_ADMIN unassign a union admin', async () => {
    await request(app.getHttpServer())
      .delete(`/unions/${unionId}/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/unions/${unionId}`)
      .set('Authorization', `Bearer ${unionAdminToken}`)
      .expect(403);
  });
});
