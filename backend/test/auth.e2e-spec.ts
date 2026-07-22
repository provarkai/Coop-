import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authenticator } from 'otplib';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = `test-${Date.now()}@example.com`;
  const password = 'correcthorsebattery';

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'User' })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('MEMBER');
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'User' })
      .expect(409);
  });

  it('rejects login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong' })
      .expect(401);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the current user for /auth/me with a valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email);
  });

  it('enforces RBAC: a MEMBER cannot hit an admin-only route', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .get('/auth/admin-only')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('rotates refresh tokens and invalidates the previous one', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('resets a forgotten password via the logged reset link and revokes existing sessions', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);

    const logged = logSpy.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.includes('Password reset link'));
    logSpy.mockRestore();
    expect(logged).toBeDefined();

    const token = new URL(
      logged!.split(': ').slice(1).join(': '),
    ).searchParams.get('token')!;

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'irrelevant123' })
      .expect(400);

    const newPassword = 'brandNewPassword123';
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('supports enabling MFA and requires a valid TOTP code on subsequent logins', async () => {
    const newPassword = 'brandNewPassword123';
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
    const accessToken = login.body.accessToken;

    const setup = await request(app.getHttpServer())
      .post('/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const secret = setup.body.secret;

    await request(app.getHttpServer())
      .post('/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: authenticator.generate(secret) })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(401);

    const mfaLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: newPassword,
        mfaCode: authenticator.generate(secret),
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/mfa/disable')
      .set('Authorization', `Bearer ${mfaLogin.body.accessToken}`)
      .send({ code: authenticator.generate(secret) })
      .expect(200);
  });
});
