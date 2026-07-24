import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';

describe('Member management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `mm-admin-${suffix}@example.com`;
  const applicantEmail = `mm-applicant-${suffix}@example.com`;
  const guarantorEmail = `mm-guarantor-${suffix}@example.com`;
  const outsiderEmail = `mm-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `mm-coop-${suffix}`;

  let adminToken: string;
  let applicantToken: string;
  let guarantorToken: string;
  let outsiderToken: string;
  let applicantId: string;
  let cooperativeId: string;
  let guarantorRequestId: string;
  let beneficiaryId: string;

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

    adminToken = (await registerAndLogin(adminEmail)).accessToken;

    const applicant = await registerAndLogin(applicantEmail);
    applicantToken = applicant.accessToken;
    applicantId = applicant.userId;

    guarantorToken = (await registerAndLogin(guarantorEmail)).accessToken;
    outsiderToken = (await registerAndLogin(outsiderEmail)).accessToken;

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Member Management Coop',
        slug,
        initialAdminEmail: adminEmail,
      })
    ).cooperativeId;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: guarantorEmail })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, applicantEmail, guarantorEmail, outsiderEmail],
        },
      },
    });
    await app.close();
  });

  it('lets a user apply to join a cooperative as PENDING', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/apply`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({})
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.membershipNumber).toBeNull();
  });

  it('rejects a second application from the same user', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/apply`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({})
      .expect(409);
  });

  it('denies a pending applicant read access to the cooperative', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(403);
  });

  it('rejects approval attempts from a non-governance member', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${applicantId}/approve`)
      .set('Authorization', `Bearer ${guarantorToken}`)
      .expect(403);
  });

  it('approves the application, assigning a membership number', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${applicantId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.membershipNumber).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
  });

  it('refuses to approve an already-active membership', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${applicantId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it("returns the member's digital membership card with a QR code", async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members/${applicantId}/card`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);

    expect(res.body.membershipNumber).toEqual(expect.any(String));
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("denies an outsider access to another member's card", async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members/${applicantId}/card`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('generates a downloadable PDF version of the membership card', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/members/${applicantId}/card.pdf`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('lets the member nominate a guarantor, who must confirm before it counts', async () => {
    const nomination = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${applicantId}/guarantors`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ email: guarantorEmail })
      .expect(201);
    guarantorRequestId = nomination.body.id;
    expect(nomination.body.status).toBe('PENDING');

    await request(app.getHttpServer())
      .patch(
        `/cooperatives/${cooperativeId}/guarantors/${guarantorRequestId}/respond`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(403);

    const responded = await request(app.getHttpServer())
      .patch(
        `/cooperatives/${cooperativeId}/guarantors/${guarantorRequestId}/respond`,
      )
      .set('Authorization', `Bearer ${guarantorToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(responded.body.status).toBe('APPROVED');
  });

  it('refuses self-guarantee and a non-member guarantor', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${applicantId}/guarantors`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ email: applicantEmail })
      .expect(400);

    // outsiderEmail belongs to a real user, but not a member of this cooperative
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${applicantId}/guarantors`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ email: outsiderEmail })
      .expect(403);
  });

  it('adds and lists a beneficiary, restricted to the member and governance roles', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${applicantId}/beneficiaries`,
      )
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ fullName: 'Jane Doe', relationship: 'Spouse' })
      .expect(201);
    beneficiaryId = res.body.id;

    await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/members/${applicantId}/beneficiaries`,
      )
      .set('Authorization', `Bearer ${guarantorToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get(
        `/cooperatives/${cooperativeId}/members/${applicantId}/beneficiaries`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('updates and removes a beneficiary', async () => {
    await request(app.getHttpServer())
      .patch(
        `/cooperatives/${cooperativeId}/members/${applicantId}/beneficiaries/${beneficiaryId}`,
      )
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ phone: '08000000000' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(
        `/cooperatives/${cooperativeId}/members/${applicantId}/beneficiaries/${beneficiaryId}`,
      )
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(204);
  });

  it('lets governance/auditor roles view the audit log, but not ordinary members', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/audit-logs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const actions = res.body.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['membership.applied', 'membership.approved']),
    );

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/audit-logs`)
      .set('Authorization', `Bearer ${guarantorToken}`)
      .expect(403);
  });

  it('lets a user view and update their own KYC profile', async () => {
    const updated = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        phone: '08012345678',
        bvn: '12345678901',
        dateOfBirth: '1990-01-01',
      })
      .expect(200);

    expect(updated.body.phone).toBe('08012345678');
    expect(updated.body.bvn).toBe('12345678901');
    expect(updated.body.passwordHash).toBeUndefined();

    const fetched = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);
    expect(fetched.body.phone).toBe('08012345678');
  });

  it('rejects a pending application and records it in the audit log', async () => {
    const rejectee = await registerAndLogin(
      `mm-rejectee-${suffix}@example.com`,
    );
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/apply`)
      .set('Authorization', `Bearer ${rejectee.accessToken}`)
      .send({})
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members/${rejectee.userId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(rejected.body.status).toBe('REJECTED');

    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set('Authorization', `Bearer ${rejectee.accessToken}`)
      .expect(403);

    await prisma.user.delete({ where: { id: rejectee.userId } });
  });
});
