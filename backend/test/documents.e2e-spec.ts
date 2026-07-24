import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = Date.now();
  const adminEmail = `documents-admin-${suffix}@example.com`;
  const memberEmail = `documents-member-${suffix}@example.com`;
  const outsiderEmail = `documents-outsider-${suffix}@example.com`;
  const password = 'correcthorsebattery';
  const slug = `documents-coop-${suffix}`;
  const fileContent = 'Hello, cooperative bylaws!';
  const contentBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');

  let adminToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let cooperativeId: string;
  let documentId: string;

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

    const outsider = await registerAndLogin(outsiderEmail);
    outsiderToken = outsider.accessToken;

    const coop = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Documents Test Cooperative', slug })
      .expect(201);
    cooperativeId = coop.body.id;

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

  it('denies a plain member from uploading a document', async () => {
    await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/documents`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Bylaws',
        category: 'BYLAWS',
        fileName: 'bylaws.txt',
        mimeType: 'text/plain',
        contentBase64,
      })
      .expect(403);
  });

  it('lets governance upload a document', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cooperatives/${cooperativeId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cooperative Bylaws',
        category: 'BYLAWS',
        fileName: 'bylaws.txt',
        mimeType: 'text/plain',
        contentBase64,
      })
      .expect(201);
    documentId = res.body.id;
    expect(res.body.title).toBe('Cooperative Bylaws');
    expect(res.body.sizeBytes).toBe(Buffer.byteLength(fileContent, 'utf-8'));
    expect(res.body.content).toBeUndefined();
  });

  it('lets any active member list document metadata without the content', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/documents`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Cooperative Bylaws');
    expect(res.body[0].content).toBeUndefined();
  });

  it('denies an outsider (non-member) from listing documents', async () => {
    await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/documents`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('lets any active member download the exact original file bytes', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toBe('text/plain');
    expect((res.body as Buffer).toString('utf-8')).toBe(fileContent);
  });

  it('denies a plain member from deleting a document', async () => {
    await request(app.getHttpServer())
      .delete(`/cooperatives/${cooperativeId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('lets governance delete a document', async () => {
    await request(app.getHttpServer())
      .delete(`/cooperatives/${cooperativeId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const res = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveLength(0);
  });
});
