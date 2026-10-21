import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Requires a running database (pnpm db:up) with migrations applied.
 * Run: pnpm --filter api test:e2e
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now().toString(36);
  const user = {
    email: `e2e_${suffix}@example.com`,
    fullName: 'E2E User',
    username: `e2e_${suffix}`,
    password: 'password123',
  };

  const cookiesOf = (res: request.Response): string[] => {
    const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: user.email } });
    await app.close();
  });

  it('registers, sets cookies and returns Me', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send(user).expect(201);
    expect(res.body).toMatchObject({ username: user.username, email: user.email, hasPassword: true });
    const cookies = cookiesOf(res).join(';');
    expect(cookies).toContain('access_token=');
    expect(cookies).toContain('refresh_token=');
  });

  it('rejects a taken username with USERNAME_TAKEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...user, email: `other_${suffix}@example.com` })
      .expect(409);
    expect(res.body.code).toBe('USERNAME_TAKEN');
  });

  it('rejects invalid input with VALIDATION_FAILED and field errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...user, email: 'not-an-email', password: '1' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('logs in by username, reads /users/me, refreshes and logs out', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/login')
      .send({ login: user.username, password: user.password })
      .expect(200);
    await agent.get('/api/users/me').expect(200);

    const refreshed = await agent.post('/api/auth/refresh').expect(204);
    expect(cookiesOf(refreshed).join(';')).toContain('refresh_token=');

    await agent.post('/api/auth/logout').expect(204);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: user.email, password: 'wrong-password' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('requires auth for private endpoints', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
