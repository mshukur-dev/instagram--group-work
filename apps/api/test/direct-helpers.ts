import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** Shared setup for direct / calls / realtime e2e suites. */
export type TestUser = { id: string; username: string; agent: ReturnType<typeof request.agent> };

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // rawBody: LiveKit webhooks are verified against the raw body (same as main.ts)
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Registers a user with a unique name; the agent keeps the auth cookies. */
export async function registerUser(app: INestApplication, prefix: string): Promise<TestUser> {
  const name = `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post('/api/auth/register')
    .send({
      email: `${name}@example.com`,
      fullName: `E2E ${prefix}`,
      username: name,
      password: 'password123',
    })
    .expect(201);
  return { id: res.body.id as string, username: name, agent };
}

/** Deletes the users and every conversation they were in. */
export async function cleanupUsers(prisma: PrismaService, users: TestUser[]): Promise<void> {
  const ids = users.map((u) => u.id);
  await prisma.conversation.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
