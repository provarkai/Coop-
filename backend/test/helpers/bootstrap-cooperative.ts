import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

const SUPER_ADMIN_PASSWORD = 'correcthorsebattery';

// Cooperative creation is SUPER_ADMIN-only: the platform team creates a
// cooperative on a regulator's request, it isn't self-service. Tests
// bootstrap a throwaway SUPER_ADMIN (promoted directly via Prisma, the way
// production does it out-of-band) to create the cooperative with an
// already-registered `initialAdminEmail`, then hand back its id -- callers
// keep using their own already-registered admin's token for everything else,
// exactly as before this restriction existed.
export async function loginAsFreshSuperAdmin(
  app: INestApplication<App>,
  prisma: PrismaService,
): Promise<{ token: string; email: string }> {
  const superAdminEmail = `super-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: superAdminEmail,
      password: SUPER_ADMIN_PASSWORD,
      firstName: 'Super',
      lastName: 'Admin',
    })
    .expect(201);

  await prisma.user.update({
    where: { email: superAdminEmail },
    data: { role: 'SUPER_ADMIN' },
  });

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: superAdminEmail, password: SUPER_ADMIN_PASSWORD })
    .expect(200);

  return { token: login.body.accessToken as string, email: superAdminEmail };
}

export async function createCooperativeAsSuperAdmin(
  app: INestApplication<App>,
  prisma: PrismaService,
  opts: {
    name: string;
    slug: string;
    initialAdminEmail: string;
    state?: string;
    regulatorEmail?: string;
  },
): Promise<{ cooperativeId: string; superAdminEmail: string }> {
  const superAdmin = await loginAsFreshSuperAdmin(app, prisma);

  const res = await request(app.getHttpServer())
    .post('/cooperatives')
    .set('Authorization', `Bearer ${superAdmin.token}`)
    .send({
      name: opts.name,
      slug: opts.slug,
      state: opts.state ?? 'Lagos',
      initialAdminEmail: opts.initialAdminEmail,
      ...(opts.regulatorEmail ? { regulatorEmail: opts.regulatorEmail } : {}),
    })
    .expect(201);

  return {
    cooperativeId: res.body.id as string,
    superAdminEmail: superAdmin.email,
  };
}
