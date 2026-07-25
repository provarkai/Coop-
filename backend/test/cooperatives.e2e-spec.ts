import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createCooperativeAsSuperAdmin,
  loginAsFreshSuperAdmin,
} from './helpers/bootstrap-cooperative';

describe('Cooperatives (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `coop-admin-${suffix}@example.com`;
  const memberEmail = `coop-member-${suffix}@example.com`;
  const outsiderEmail = `coop-outsider-${suffix}@example.com`;
  const bulkExistingEmail = `coop-bulk-existing-${suffix}@example.com`;
  const bulkNewEmail = `coop-bulk-new-${suffix}@example.com`;
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

    await registerAndLogin(bulkExistingEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            adminEmail,
            memberEmail,
            outsiderEmail,
            bulkExistingEmail,
            bulkNewEmail,
          ],
        },
      },
    });
    await app.close();
  });

  it('rejects cooperative creation from a non-SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Rejected Cooperative',
        slug: `rejected-${suffix}`,
        state: 'Lagos',
        initialAdminEmail: adminEmail,
      })
      .expect(403);
  });

  it('creates a cooperative as SUPER_ADMIN and makes initialAdminEmail its COOPERATIVE_ADMIN', async () => {
    const { cooperativeId: id } = await createCooperativeAsSuperAdmin(
      app,
      prisma,
      { name: 'Test Cooperative', slug, initialAdminEmail: adminEmail },
    );
    cooperativeId = id;

    const members = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(members.body).toHaveLength(1);
    expect(members.body[0].role).toBe('COOPERATIVE_ADMIN');
  });

  it('rejects a duplicate slug', async () => {
    const superAdmin = await loginAsFreshSuperAdmin(app, prisma);
    await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        name: 'Another Cooperative',
        slug,
        state: 'Lagos',
        initialAdminEmail: adminEmail,
      })
      .expect(409);
  });

  it('denies access to non-members', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets a non-member preview only the cooperative name and slug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/preview`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200);

    expect(res.body).toEqual({
      id: cooperativeId,
      name: 'Test Cooperative',
      slug,
    });
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
    expect(res.body.logo).toBeUndefined();
  });

  it('lets the admin upload a logo, which any member can then fetch', async () => {
    const contentBase64 = Buffer.from('fake-png-bytes').toString('base64');
    await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}/logo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mimeType: 'image/png', contentBase64 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/logo`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.from(res.body).toString()).toBe('fake-png-bytes');
  });

  it('rejects a non-governance member from uploading a logo', async () => {
    const contentBase64 = Buffer.from('rogue-bytes').toString('base64');
    await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}/logo`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ mimeType: 'image/png', contentBase64 })
      .expect(403);
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

  it('bulk-imports members from CSV: creates new accounts, links existing users, and reports per-row errors', async () => {
    const csvContent = [
      'firstName,lastName,email,role,category',
      `Brand,New,${bulkNewEmail},MEMBER,ORDINARY`,
      `Already,Registered,${bulkExistingEmail},TREASURER,ORDINARY`,
      `Already,AMember,${memberEmail},MEMBER,ORDINARY`,
      'Missing,Email,,MEMBER,ORDINARY',
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/bulk-import`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csvContent })
      .expect(201);

    expect(res.body.imported).toBe(2);
    expect(res.body.skipped).toBe(2);
    expect(res.body.errors).toHaveLength(2);
    expect(
      res.body.errors.find((e: { email: string }) => e.email === memberEmail)
        .message,
    ).toMatch(/already a member/i);
    expect(
      res.body.errors.find((e: { email: string }) => e.email === '(missing)')
        .message,
    ).toMatch(/invalid email/i);

    const newUser = await prisma.user.findUnique({
      where: { email: bulkNewEmail },
    });
    expect(newUser).not.toBeNull();
    const newMembership = await prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: newUser!.id } },
    });
    expect(newMembership?.membershipNumber).toEqual(expect.any(String));

    const existingUser = await prisma.user.findUnique({
      where: { email: bulkExistingEmail },
    });
    const existingMembership = await prisma.cooperativeMembership.findUnique({
      where: {
        cooperativeId_userId: { cooperativeId, userId: existingUser!.id },
      },
    });
    expect(existingMembership?.role).toBe('TREASURER');
  });

  it('rejects bulk import from a non-governance member', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/bulk-import`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ csvContent: 'firstName,lastName,email\nA,B,x@example.com' })
      .expect(403);
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

  it('refuses to let the sole cooperative admin demote or remove themselves', async () => {
    const soloEmail = `solo-admin-${suffix}@example.com`;
    const solo = await registerAndLogin(soloEmail);
    const soloSlug = `solo-coop-${suffix}`;
    const { cooperativeId: soloCoopId } = await createCooperativeAsSuperAdmin(
      app,
      prisma,
      {
        name: 'Solo Cooperative',
        slug: soloSlug,
        initialAdminEmail: soloEmail,
      },
    );

    await request(app.getHttpServer())
      .patch(`/cooperatives/${soloCoopId}/members/${solo.userId}`)
      .set('Authorization', `Bearer ${solo.accessToken}`)
      .send({ role: 'MEMBER' })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/cooperatives/${soloCoopId}/members/${solo.userId}`)
      .set('Authorization', `Bearer ${solo.accessToken}`)
      .expect(400);

    await registerAndLogin(`second-admin-${suffix}@example.com`);
    await request(app.getHttpServer())
      .post(`/cooperatives/${soloCoopId}/members`)
      .set('Authorization', `Bearer ${solo.accessToken}`)
      .send({
        email: `second-admin-${suffix}@example.com`,
        role: 'COOPERATIVE_ADMIN',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/cooperatives/${soloCoopId}/members/${solo.userId}`)
      .set('Authorization', `Bearer ${solo.accessToken}`)
      .send({ role: 'MEMBER' })
      .expect(200);

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            `solo-admin-${suffix}@example.com`,
            `second-admin-${suffix}@example.com`,
          ],
        },
      },
    });
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
