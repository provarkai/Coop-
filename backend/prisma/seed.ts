import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const DEMO_SLUG = 'ncms-demo';
const DEMO_ADMIN_EMAIL = 'demo-admin@ncms.example';
const DEMO_PASSWORD = 'DemoPass123!';

/**
 * Idempotent pilot-rollout seed: creates one demo cooperative with an admin
 * account so a fresh deployment has somewhere to log in and explore rather
 * than an empty database. Deliberately does not seed savings/loan/meeting
 * activity -- that goes through real service-layer logic (auto-posting,
 * schedule generation, etc.) best exercised through the actual API/UI
 * rather than duplicated here.
 */
async function main() {
  const existing = await prisma.cooperative.findUnique({
    where: { slug: DEMO_SLUG },
  });
  if (existing) {
    console.log(`Demo cooperative "${DEMO_SLUG}" already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      firstName: 'Demo',
      lastName: 'Admin',
      role: Role.MEMBER,
    },
  });

  const cooperative = await prisma.cooperative.create({
    data: {
      name: 'NCMS Demo Cooperative',
      slug: DEMO_SLUG,
      registrationNumber: 'DEMO-0001',
      email: 'contact@ncms-demo.example',
      bylaws:
        'This is a demo cooperative pre-loaded for evaluation purposes. ' +
        'Explore savings, loans, meetings, documents, reports, and AI features ' +
        'by adding members and products through the UI.',
      memberships: {
        create: {
          userId: admin.id,
          role: Role.COOPERATIVE_ADMIN,
        },
      },
    },
  });

  console.log('Seeded demo cooperative:');
  console.log(`  Cooperative: ${cooperative.name} (${cooperative.slug})`);
  console.log(`  Admin login: ${DEMO_ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
