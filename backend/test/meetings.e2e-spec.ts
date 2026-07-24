import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';

describe('Meetings & Governance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `meetings-admin-${suffix}@example.com`;
  const secretaryEmail = `meetings-secretary-${suffix}@example.com`;
  const memberOneEmail = `meetings-member1-${suffix}@example.com`;
  const memberTwoEmail = `meetings-member2-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `meetings-coop-${suffix}`;

  let adminToken: string;
  let secretaryToken: string;
  let memberOneToken: string;
  let memberTwoToken: string;
  let memberOneUserId: string;
  let memberTwoUserId: string;
  let cooperativeId: string;
  let meetingId: string;
  let agendaItemId: string;
  let resolutionId: string;

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

    const secretary = await registerAndLogin(secretaryEmail);
    secretaryToken = secretary.accessToken;

    const memberOne = await registerAndLogin(memberOneEmail);
    memberOneToken = memberOne.accessToken;
    memberOneUserId = memberOne.userId;

    const memberTwo = await registerAndLogin(memberTwoEmail);
    memberTwoToken = memberTwo.accessToken;
    memberTwoUserId = memberTwo.userId;

    cooperativeId = (
      await createCooperativeAsSuperAdmin(app, prisma, {
        name: 'Meetings Test Cooperative',
        slug,
        initialAdminEmail: adminEmail,
      })
    ).cooperativeId;

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: secretaryEmail, role: 'SECRETARY' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberOneEmail, role: 'MEMBER' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberTwoEmail, role: 'MEMBER' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.cooperative.deleteMany({ where: { id: cooperativeId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, secretaryEmail, memberOneEmail, memberTwoEmail],
        },
      },
    });
    await app.close();
  });

  it('denies a plain member from creating a meeting', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({
        title: 'AGM 2026',
        type: 'AGM',
        scheduledAt: '2026-08-15T09:00:00.000Z',
      })
      .expect(403);
  });

  it('lets governance (secretary) create a meeting with an agenda, auto-inviting all active members', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({
        title: 'AGM 2026',
        type: 'AGM',
        scheduledAt: '2026-08-15T09:00:00.000Z',
        location: 'Cooperative Hall',
        agendaItems: [
          { title: 'Approve last year minutes' },
          { title: 'Elect new treasurer', description: 'Nomination and vote' },
        ],
      })
      .expect(201);

    meetingId = res.body.id;
    agendaItemId = res.body.agendaItems[0].id;

    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.agendaItems).toHaveLength(2);
    expect(res.body.agendaItems[0].order).toBe(1);
    expect(res.body.agendaItems[1].order).toBe(2);
    // admin + secretary + 2 members = 4 active memberships, all auto-invited
    expect(res.body.attendances).toHaveLength(4);
    expect(
      res.body.attendances.every(
        (a: { status: string }) => a.status === 'INVITED',
      ),
    ).toBe(true);
  });

  it('lets any active member list and view the meeting', async () => {
    const list = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const detail = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/meetings/${meetingId}`)
      .set('Authorization', `Bearer ${memberTwoToken}`)
      .expect(200);
    expect(detail.body.title).toBe('AGM 2026');
  });

  it('lets a member RSVP for themselves', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/rsvp`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.userId).toBe(memberOneUserId);

    const declined = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/rsvp`)
      .set('Authorization', `Bearer ${memberTwoToken}`)
      .send({ status: 'DECLINED' })
      .expect(201);
    expect(declined.body.status).toBe('DECLINED');
  });

  it('denies a plain member from recording another member attendance', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/attendance/${memberOneUserId}`,
      )
      .set('Authorization', `Bearer ${memberTwoToken}`)
      .send({ status: 'ATTENDED' })
      .expect(403);
  });

  it('lets governance record attendance and lists it', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/attendance/${memberOneUserId}`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ status: 'ATTENDED' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/attendance/${memberTwoUserId}`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ status: 'ABSENT' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/meetings/${meetingId}/attendance`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .expect(200);

    const memberOneRow = list.body.find(
      (a: { userId: string }) => a.userId === memberOneUserId,
    );
    const memberTwoRow = list.body.find(
      (a: { userId: string }) => a.userId === memberTwoUserId,
    );
    expect(memberOneRow.status).toBe('ATTENDED');
    expect(memberTwoRow.status).toBe('ABSENT');
  });

  it('rejects proposing a resolution against an agenda item from another meeting', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ agendaItemId: 'not-a-real-agenda-item', title: 'Bogus' })
      .expect(404);
  });

  it('lets any active member propose a resolution tied to an agenda item', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({
        agendaItemId,
        title: 'Adopt 2026 budget',
        description: 'Ratify the proposed annual budget',
      })
      .expect(201);
    resolutionId = res.body.id;
    expect(res.body.status).toBe('PROPOSED');
  });

  it('lets active members cast one vote each, changeable while open', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ choice: 'FOR' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ choice: 'FOR' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ choice: 'AGAINST' })
      .expect(201);

    // memberTwo votes ABSTAIN then changes mind to AGAINST
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${memberTwoToken}`)
      .send({ choice: 'ABSTAIN' })
      .expect(201);

    const changed = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${memberTwoToken}`)
      .send({ choice: 'AGAINST' })
      .expect(201);
    expect(changed.body.choice).toBe('AGAINST');

    const list = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .expect(200);
    const resolution = list.body.find(
      (r: { id: string }) => r.id === resolutionId,
    );
    expect(resolution.votes).toHaveLength(4);
  });

  it('denies a plain member from closing a resolution', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/close`,
      )
      .set('Authorization', `Bearer ${memberOneToken}`)
      .expect(403);
  });

  it('lets governance close the resolution, tallying FOR (2) vs AGAINST (2) as REJECTED on a tie', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/close`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.closedAt).not.toBeNull();
  });

  it('rejects voting or re-closing once a resolution is closed', async () => {
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ choice: 'FOR' })
      .expect(400);

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${resolutionId}/close`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(400);
  });

  it('passes a resolution when FOR votes outnumber AGAINST votes', async () => {
    const proposed = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ title: 'Approve minutes of last AGM' })
      .expect(201);
    const secondResolutionId = proposed.body.id;

    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${secondResolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ choice: 'FOR' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${secondResolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ choice: 'FOR' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${secondResolutionId}/vote`,
      )
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ choice: 'AGAINST' })
      .expect(201);

    const closed = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${secondResolutionId}/close`,
      )
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    expect(closed.body.status).toBe('PASSED');
  });

  it('lets any active member withdraw their own proposed resolution while open', async () => {
    const proposed = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ title: 'Withdraw me' })
      .expect(201);

    const withdrawn = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meetingId}/resolutions/${proposed.body.id}/withdraw`,
      )
      .set('Authorization', `Bearer ${memberOneToken}`)
      .expect(201);
    expect(withdrawn.body.status).toBe('WITHDRAWN');
  });

  it('denies a plain member from updating the meeting', async () => {
    await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}/meetings/${meetingId}`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ location: 'New Hall' })
      .expect(403);
  });

  it('lets governance update the meeting location', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}/meetings/${meetingId}`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ location: 'New Hall' })
      .expect(200);
    expect(res.body.location).toBe('New Hall');
  });

  it('denies a plain member from recording minutes', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/minutes`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .send({ minutes: 'Should not work' })
      .expect(403);
  });

  it('lets governance record minutes, marking the meeting COMPLETED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings/${meetingId}/minutes`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ minutes: 'Budget ratified; treasurer election deferred.' })
      .expect(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.minutes).toBe(
      'Budget ratified; treasurer election deferred.',
    );
  });

  it('generates a downloadable PDF of the meeting minutes for any active member', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/meetings/${meetingId}/minutes.pdf`)
      .set('Authorization', `Bearer ${memberOneToken}`)
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

  it('auto-notifies every invited member by (simulated) email when a meeting is created', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/notifications`)
      .set('Authorization', `Bearer ${memberOneToken}`)
      .expect(200);

    const invite = res.body.find((n: { subject: string | null }) =>
      n.subject?.includes('AGM 2026'),
    );
    expect(invite).toBeDefined();
    expect(invite.channel).toBe('EMAIL');
    expect(invite.status).toBe('SENT');
  });
});
