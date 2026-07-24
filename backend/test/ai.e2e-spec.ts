import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createCooperativeAsSuperAdmin } from './helpers/bootstrap-cooperative';
import { AiClientService } from '../src/ai/ai-client.service';

const MOCK_ANSWER = 'MOCK AI RESPONSE';
const chatMock = jest.fn().mockResolvedValue(MOCK_ANSWER);

describe('AI Features (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `ai-admin-${suffix}@example.com`;
  const memberEmail = `ai-member-${suffix}@example.com`;
  const outsiderEmail = `ai-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `ai-coop-${suffix}`;

  let adminToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberUserId: string;
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
    })
      .overrideProvider(AiClientService)
      .useValue({ chat: chatMock })
      .compile();

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
        name: 'AI Test Cooperative',
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

  it('denies an outsider from asking the assistant', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/ai/assistant`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ question: 'What is my savings balance?' })
      .expect(403);
  });

  it('lets any active member ask the assistant (self-scoped)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/ai/assistant`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ question: 'What is my savings balance?' })
      .expect(201);
    expect(res.body.answer).toBe(MOCK_ANSWER);
  });

  it("includes the cooperative-wide dashboard in governance's context, but not a plain member's", async () => {
    chatMock.mockClear();
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/ai/assistant`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'How many active members do we have?' })
      .expect(201);
    const adminSystemPrompt = chatMock.mock.calls[0][0][0].content as string;
    expect(adminSystemPrompt).toContain(
      'this member\'s own data plus the cooperative-wide dashboard',
    );
    expect(adminSystemPrompt).toContain(
      '--- Cooperative-wide dashboard (visible to you because your role has dashboard access) ---',
    );
    expect(adminSystemPrompt).toContain('Active members: 2');
    expect(adminSystemPrompt).toMatch(/Cash balance: 0\.00/);

    chatMock.mockClear();
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/ai/assistant`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ question: 'How many active members do we have?' })
      .expect(201);
    const memberSystemPrompt = chatMock.mock.calls[0][0][0].content as string;
    expect(memberSystemPrompt).toContain("this specific member's own data");
    expect(memberSystemPrompt).not.toContain('Cooperative-wide dashboard');
    expect(memberSystemPrompt).not.toContain('Active members:');
  });

  it('lets governance summarize a meeting, persisting the AI summary', async () => {
    const meeting = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'AGM',
        type: 'AGM',
        scheduledAt: '2026-08-15T09:00:00.000Z',
      })
      .expect(201);

    const summarize = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meeting.body.id}/summarize`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(summarize.body.aiSummary).toBe(MOCK_ANSWER);

    const detail = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/meetings/${meeting.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.aiSummary).toBe(MOCK_ANSWER);
  });

  it('denies a plain member from summarizing a meeting', async () => {
    const meeting = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/meetings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Board',
        type: 'BOARD',
        scheduledAt: '2026-08-16T09:00:00.000Z',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/meetings/${meeting.body.id}/summarize`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('computes an exact deterministic loan risk score with an AI narrative', async () => {
    const loanProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Quick Loan',
        code: 'QL',
        interestRatePercent: 12,
        maxAmount: 6000,
        maxTermMonths: 6,
        requiredGuarantors: 0,
      })
      .expect(201);

    // Member just joined (tenure < 90 days), has no savings, and requests the
    // product's max amount -> expect all three deterministic risk factors:
    // loanToSavings > 5 (-30), tenure < 90 days (-15), at product max (-10) = 45
    const loan = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ productId: loanProduct.body.id, principal: 6000, termMonths: 6 })
      .expect(201);

    const risk = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loan.body.id}/risk-score`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(risk.body.score).toBe(45);
    expect(risk.body.rating).toBe('HIGH');
    expect(risk.body.factors).toHaveLength(3);
    expect(risk.body.narrative).toBe(MOCK_ANSWER);
  });

  it('denies a plain member from viewing a loan risk score', async () => {
    const loanProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loan-products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Another Loan',
        code: 'AL',
        maxAmount: 1000,
        maxTermMonths: 3,
        requiredGuarantors: 0,
      })
      .expect(201);
    const loan = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/loans`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ productId: loanProduct.body.id, principal: 500, termMonths: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/loans/${loan.body.id}/risk-score`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('flags a large transaction and a rapid deposit/withdrawal round-trip', async () => {
    const savingsProduct = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/savings/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ordinary', code: 'ORD' })
      .expect(201);

    const accountA = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${memberUserId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: savingsProduct.body.id })
      .expect(201);

    // 5 tiny deposits pull the average down, then one large deposit that's
    // clearly more than 5x that average
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(
          `/cooperatives/${cooperativeId}/savings/accounts/${accountA.body.id}/transactions`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'DEPOSIT', amount: 1 })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountA.body.id}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'DEPOSIT', amount: 2000 })
      .expect(201);

    // A second account: deposit then withdraw the same amount right away
    const secondMember = await registerAndLogin(
      `ai-member2-${suffix}@example.com`,
    );
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `ai-member2-${suffix}@example.com`, role: 'MEMBER' })
      .expect(201);
    const accountB = await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/members/${secondMember.userId}/savings/accounts`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: savingsProduct.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountB.body.id}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'DEPOSIT', amount: 500 })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/cooperatives/${cooperativeId}/savings/accounts/${accountB.body.id}/transactions`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'WITHDRAWAL', amount: 500 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/fraud-alerts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      res.body.some(
        (f: { type: string; accountNumber: string }) =>
          f.type === 'LARGE_TRANSACTION' &&
          f.accountNumber === accountA.body.accountNumber,
      ),
    ).toBe(true);
    expect(
      res.body.some(
        (f: { type: string; accountNumber: string }) =>
          f.type === 'RAPID_ROUND_TRIP' &&
          f.accountNumber === accountB.body.accountNumber,
      ),
    ).toBe(true);

    await prisma.user.deleteMany({
      where: { email: `ai-member2-${suffix}@example.com` },
    });
  });

  it('denies a plain member from viewing fraud alerts', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/fraud-alerts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
