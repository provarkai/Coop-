import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';

// End-to-end walk through the full Kesa module suite (Ajo/Esusu contribution
// engine -> land banking -> property syndication) in one flowing scenario,
// since each module's real trigger condition is the previous module's
// output (confirmed contributions build a trust score high enough to
// reserve a parcel; reaching the parcel price confirms the reservation;
// a confirmed reservation is what starts a syndication).
describe('Kesa module suite (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `kesa-admin-${suffix}@example.com`;
  const coordinatorEmail = `kesa-coordinator-${suffix}@example.com`;
  const memberEmail = `kesa-member-${suffix}@example.com`;
  const landOfficerEmail = `kesa-landofficer-${suffix}@example.com`;
  const outsiderEmail = `kesa-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `kesa-coop-${suffix}`;

  let adminToken: string;
  let coordinatorToken: string;
  let memberToken: string;
  let landOfficerToken: string;
  let outsiderToken: string;
  let cooperativeId: string;
  let groupId: string;
  let parcelId: string;
  let reservationId: string;
  let syndicationId: string;
  let milestoneIds: string[] = [];

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
    coordinatorToken = await registerAndLogin(coordinatorEmail);
    memberToken = await registerAndLogin(memberEmail);
    landOfficerToken = await registerAndLogin(landOfficerEmail);
    outsiderToken = await registerAndLogin(outsiderEmail);

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Kesa Test Cooperative',
        slug,
        initialAdminEmail: adminEmail,
      })
    ).cooperativeId;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: coordinatorEmail, role: 'MEMBER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberEmail, role: 'MEMBER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: landOfficerEmail, role: 'LAND_DESK_OFFICER' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            adminEmail,
            coordinatorEmail,
            memberEmail,
            landOfficerEmail,
            outsiderEmail,
          ],
        },
      },
    });
    await app.close();
  });

  describe('Module 1: Contribution Engine (Ajo/Esusu)', () => {
    it('rejects a non-governance member creating a group', async () => {
      await request(app.getHttpServer())
        .post(`/cooperatives/${cooperativeId}/contribution-groups`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Rogue Group',
          type: 'TARGET',
          coordinatorEmail,
          contributionAmount: 50000,
          frequency: 'MONTHLY',
          targetAmount: 1000000,
        })
        .expect(403);
    });

    it('lets governance create a target contribution group', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${cooperativeId}/contribution-groups`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Land Fund Group',
          type: 'TARGET',
          coordinatorEmail,
          contributionAmount: 50000,
          frequency: 'MONTHLY',
          targetAmount: 1000000,
        })
        .expect(201);
      groupId = res.body.id;
      expect(res.body.type).toBe('TARGET');
    });

    it('lets the coordinator add a member to the group', async () => {
      await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/members`,
        )
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ email: memberEmail })
        .expect(201);
    });

    it("denies an outsider (not in the group) from viewing the group's detail", async () => {
      await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/contribution-groups/${groupId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    let contributionIds: string[] = [];

    it('lets the coordinator record a contribution period for all active members', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/contributions`,
        )
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ dueDate: new Date().toISOString() })
        .expect(201);
      expect(res.body).toHaveLength(2); // coordinator + member
      contributionIds = res.body.map((c: { id: string }) => c.id);
    });

    it('lets the coordinator confirm each contribution', async () => {
      for (const contributionId of contributionIds) {
        await request(app.getHttpServer())
          .patch(
            `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/contributions/${contributionId}/confirm`,
          )
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .expect(200);
      }
    });

    it('computes a group trust score reflecting the confirmed contributions', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/cooperatives/${cooperativeId}/contribution-groups/${groupId}/trust-score`,
        )
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect(res.body.averageScore).toBeGreaterThan(40);
      expect(res.body.rating).toBe('HIGH');
    });
  });

  describe('Module 2: Land Banking', () => {
    it('rejects a plain member creating a land parcel', async () => {
      await request(app.getHttpServer())
        .post(`/cooperatives/${cooperativeId}/land-parcels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ location: 'Rogue Estate', priceNaira: 80000 })
        .expect(403);
    });

    it('lets a LAND_DESK_OFFICER list a parcel under review, hidden from members', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${cooperativeId}/land-parcels`)
        .set('Authorization', `Bearer ${landOfficerToken}`)
        .send({
          location: 'Epe Waterside Estate, Lagos',
          coordinatesMinna: '6.5N 3.9E',
          coordinatesWgs84: '6.5833N 3.9833E',
          priceNaira: 80000,
          sizeSqm: 500,
          titleStatus: 'Certificate of Occupancy verified',
        })
        .expect(201);
      parcelId = res.body.id;
      expect(res.body.status).toBe('UNDER_REVIEW');

      const memberList = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/land-parcels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(
        memberList.body.some((p: { id: string }) => p.id === parcelId),
      ).toBe(false);
    });

    it('refuses to publish a parcel with no verification score', async () => {
      await request(app.getHttpServer())
        .post(`/cooperatives/${cooperativeId}/land-parcels/${parcelId}/publish`)
        .set('Authorization', `Bearer ${landOfficerToken}`)
        .expect(400);
    });

    it('lets the land desk officer set a verification score and publish', async () => {
      await request(app.getHttpServer())
        .patch(`/cooperatives/${cooperativeId}/land-parcels/${parcelId}`)
        .set('Authorization', `Bearer ${landOfficerToken}`)
        .send({ verificationScore: 88 })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/cooperatives/${cooperativeId}/land-parcels/${parcelId}/publish`)
        .set('Authorization', `Bearer ${landOfficerToken}`)
        .expect(201);

      const memberList = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/land-parcels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(
        memberList.body.some((p: { id: string }) => p.id === parcelId),
      ).toBe(true);
    });

    it("lets the group's coordinator reserve the published parcel", async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/land-parcels/${parcelId}/reservations`,
        )
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ groupId })
        .expect(201);
      reservationId = res.body.id;
      expect(res.body.status).toBe('ACTIVE');
    });

    it('lists the reservation under its parcel', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/cooperatives/${cooperativeId}/land-parcels/${parcelId}/reservations`,
        )
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.some((r: { id: string }) => r.id === reservationId)).toBe(
        true,
      );
    });

    it('shows the saved total against the target price on the reservation', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect(Number(res.body.savedTotal)).toBeGreaterThanOrEqual(100000);
    });

    it('confirms the reservation once the group has saved enough', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/cooperatives/${cooperativeId}/reservations/${reservationId}/confirm`,
        )
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect(res.body.status).toBe('CONFIRMED');
    });
  });

  describe('Module 3: Property Syndication', () => {
    it('rejects a plain member initiating a syndication', async () => {
      await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/reservations/${reservationId}/syndication`,
        )
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('lets governance initiate the syndication with default milestones', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/reservations/${reservationId}/syndication`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      syndicationId = res.body.id;
      expect(res.body.status).toBe('ESCROW_PENDING');

      const detail = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/syndications/${syndicationId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect(detail.body.milestones).toHaveLength(3);
      milestoneIds = detail.body.milestones
        .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
        .map((m: { id: string }) => m.id);
    });

    it("denies a group outsider from viewing the syndication's detail", async () => {
      await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/syndications/${syndicationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('funds escrow (a simulated external trustee reference, not a real transfer)', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/cooperatives/${cooperativeId}/syndications/${syndicationId}/fund-escrow`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ escrowPartnerRef: 'TRUSTEE-REF-001', amount: 80000 })
        .expect(200);
      expect(res.body.status).toBe('ESCROW_FUNDED');
    });

    it('verifies and releases each milestone in order, completing the syndication on the last', async () => {
      for (let i = 0; i < milestoneIds.length; i++) {
        const milestoneId = milestoneIds[i];
        await request(app.getHttpServer())
          .patch(
            `/cooperatives/${cooperativeId}/syndications/${syndicationId}/milestones/${milestoneId}/verify`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ proofNotes: 'Field-verified' })
          .expect(200);

        const released = await request(app.getHttpServer())
          .patch(
            `/cooperatives/${cooperativeId}/syndications/${syndicationId}/milestones/${milestoneId}/release`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(released.body.status).toBe('RELEASED');
      }

      const detail = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/syndications/${syndicationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.status).toBe('COMPLETED');

      const parcel = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/land-parcels/${parcelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(parcel.body.status).toBe('SOLD');
    });

    it('records member allocations once completed, and rejects a duplicate', async () => {
      await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/syndications/${syndicationId}/allocations`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ memberEmail: coordinatorEmail, plotRef: 'PLOT-A1' })
        .expect(201);

      await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/syndications/${syndicationId}/allocations`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ memberEmail: coordinatorEmail, plotRef: 'PLOT-A1' })
        .expect(409);

      const detail = await request(app.getHttpServer())
        .get(`/cooperatives/${cooperativeId}/syndications/${syndicationId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
      expect(detail.body.allocations).toHaveLength(1);
      expect(detail.body.allocations[0].plotRef).toBe('PLOT-A1');
    });
  });
});
