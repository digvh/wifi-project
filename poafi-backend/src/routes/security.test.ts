import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { SESSION_COOKIE_NAME, passwordVersion } from '../utils/auth';
import { encryptSecret } from '../utils/crypto';
import { WireGuardService } from '../services/network/WireGuardService';
import enrollmentRoutes from './enrollment';
import packageRoutes from './packages';
import routerRoutes from './routers';
import tenantRoutes from './tenants';
import speedtestRoutes from './speedtest';
import cronRoutes from './cron';

const TEST_APP = express();
TEST_APP.use(express.json());
TEST_APP.use('/api/enroll', enrollmentRoutes);
TEST_APP.use('/api/packages', packageRoutes);
TEST_APP.use('/api/routers', routerRoutes);
TEST_APP.use('/api/tenants', tenantRoutes);
TEST_APP.use('/api/speedtest', speedtestRoutes);
TEST_APP.use('/api/internal/cron', cronRoutes);

function startTestServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const srv = http.createServer(TEST_APP);
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number };
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((done) => srv.close(() => done())),
      });
    });
  });
}

function stubMethod(target: any, key: string, impl: (...args: any[]) => any): () => void {
  const original = target[key];
  target[key] = impl;
  return () => {
    target[key] = original;
  };
}

test('Enrollment tokens reject malformed, expired, and replayed requests', async () => {
  const validToken = 'a'.repeat(48);
  const expiredToken = 'b'.repeat(48);
  let consumed = false;

  const restoreFind = stubMethod(prisma.router, 'findUnique', async (args: any) => {
    const token = args?.where?.enrollmentToken;
    if (token === validToken && !consumed) {
      return {
        id: 'router-1',
        enrollmentToken: validToken,
        enrollmentExpiresAt: new Date(Date.now() + 60_000),
      };
    }
    if (token === expiredToken) {
      return {
        id: 'router-2',
        enrollmentToken: expiredToken,
        enrollmentExpiresAt: new Date(Date.now() - 60_000),
      };
    }
    return null;
  });

  const restoreUpdate = stubMethod(prisma.router, 'update', async () => {
    consumed = true;
    return { id: 'router-1', setupStatus: 'DISCOVERED' };
  });

  const srv = await startTestServer();
  try {
    const badRes = await fetch(`${srv.baseUrl}/api/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Enrollment-Token': 'short' },
      body: JSON.stringify({ model: 'hEX', serial: '123', identity: 'R1', version: '7.14' }),
    });
    assert.equal(badRes.status, 401);

    const expPost = await fetch(`${srv.baseUrl}/api/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Enrollment-Token': expiredToken },
      body: JSON.stringify({ model: 'hEX', serial: '123', identity: 'R1', version: '7.14' }),
    });
    assert.equal(expPost.status, 401);

    const expGet = await fetch(`${srv.baseUrl}/api/enroll/script/${expiredToken}`);
    assert.equal(expGet.status, 401);

    const okRes = await fetch(`${srv.baseUrl}/api/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Enrollment-Token': validToken },
      body: JSON.stringify({ model: 'hEX S', serial: 'SN-1', identity: 'Site-1', version: '7.15' }),
    });
    assert.equal(okRes.status, 200);
    const okBody = (await okRes.json()) as { ok: boolean };
    assert.equal(okBody.ok, true);

    const replayRes = await fetch(`${srv.baseUrl}/api/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Enrollment-Token': validToken },
      body: JSON.stringify({ model: 'hEX S', serial: 'SN-1', identity: 'Site-1', version: '7.15' }),
    });
    assert.equal(replayRes.status, 401);
  } finally {
    restoreFind();
    restoreUpdate();
    await srv.close();
  }
});

test('Tenant isolation, session passwordVersion, deleted user, CSRF, and admin guards are enforced', async () => {
  const operatorA = {
    id: 'user-a',
    email: 'a@poafi.co.tz',
    role: 'TENANT_OPERATOR',
    tenantId: 'tenant-a',
    passwordHash: 'hash-a-current',
    tenant: { isActive: true },
  };
  let userExists = true;

  const restoreUserFind = stubMethod(prisma.user, 'findUnique', async (args: any) => {
    if (args?.where?.id === 'user-a' && userExists) return operatorA;
    return null;
  });

  const restorePkgFind = stubMethod(prisma.package, 'findUnique', async (args: any) => {
    if (args?.where?.id === 'pkg-b') {
      return { id: 'pkg-b', tenantId: 'tenant-b', name: 'B Package' };
    }
    return null;
  });

  const restoreRouterFind = stubMethod(prisma.router, 'findUnique', async (args: any) => {
    if (args?.where?.id === 'router-b') {
      return {
        id: 'router-b',
        tenantId: 'tenant-b',
        vendor: 'TPLINK_OMADA',
        host: '10.0.0.1',
        apiPort: 8043,
        username: 'admin',
        encryptedPassword: 'enc',
      };
    }
    return null;
  });

  const validToken = jwt.sign(
    {
      userId: operatorA.id,
      role: operatorA.role,
      tenantId: operatorA.tenantId,
      pv: passwordVersion(operatorA.passwordHash),
    },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const stalePvToken = jwt.sign(
    {
      userId: operatorA.id,
      role: operatorA.role,
      tenantId: operatorA.tenantId,
      pv: passwordVersion('old-password-hash'),
    },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const srv = await startTestServer();
  try {
    const noCsrfRes = await fetch(`${srv.baseUrl}/api/packages/pkg-b`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    assert.equal(noCsrfRes.status, 403);

    const crossPkgRes = await fetch(`${srv.baseUrl}/api/packages/pkg-b`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'PoaFi-Web',
        Cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    assert.equal(crossPkgRes.status, 403);

    const crossRouterDel = await fetch(`${srv.baseUrl}/api/routers/router-b`, {
      method: 'DELETE',
      headers: {
        'X-Requested-With': 'PoaFi-Web',
        Cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
    });
    assert.equal(crossRouterDel.status, 403);

    const crossOmadaRes = await fetch(`${srv.baseUrl}/api/routers/router-b/omada-portal-setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'PoaFi-Web',
        Cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(crossOmadaRes.status, 403);

    const crossWanRes = await fetch(`${srv.baseUrl}/api/speedtest/router/router-b/wan`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
    });
    assert.equal(crossWanRes.status, 403);

    const tenantDelRes = await fetch(`${srv.baseUrl}/api/tenants/tenant-b`, {
      method: 'DELETE',
      headers: {
        'X-Requested-With': 'PoaFi-Web',
        Cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
      },
    });
    assert.equal(tenantDelRes.status, 403);

    const staleRes = await fetch(`${srv.baseUrl}/api/speedtest/ping`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${stalePvToken}` },
    });
    assert.equal(staleRes.status, 401);

    userExists = false;
    const deletedRes = await fetch(`${srv.baseUrl}/api/speedtest/ping`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${validToken}` },
    });
    assert.equal(deletedRes.status, 401);
  } finally {
    restoreUserFind();
    restorePkgFind();
    restoreRouterFind();
    await srv.close();
  }
});

test('Shared hosting HTTPS Cloud Sync and cPanel Cron endpoint enforce secrets and sync RouterOS scripts', async () => {
  const routerSecret = 'router-api-secret-key-12345';
  const encryptedRouterSecret = encryptSecret(routerSecret);
  let routerStatus = 'PENDING';

  const restoreRouterFind = stubMethod(prisma.router, 'findUnique', async (args: any) => {
    if (args?.where?.id === 'router-sh-1') {
      return {
        id: 'router-sh-1',
        tenantId: 'tenant-a',
        vendor: 'MIKROTIK',
        host: '10.8.0.2',
        apiPort: 8728,
        username: 'poafi-cloud',
        encryptedPassword: encryptedRouterSecret,
        status: routerStatus,
        setupStatus: 'CONFIRMED',
      };
    }
    return null;
  });

  const restoreRouterUpdate = stubMethod(prisma.router, 'update', async (args: any) => {
    routerStatus = args?.data?.status || routerStatus;
    return { id: 'router-sh-1', status: routerStatus, setupStatus: args?.data?.setupStatus };
  });

  const restoreVoucherUpdateMany = stubMethod(prisma.voucher, 'updateMany', async () => ({ count: 0 }));

  const restoreVoucherFindMany = stubMethod(prisma.voucher, 'findMany', async (args: any) => {
    if (args?.where?.status === 'EXPIRED') {
      return [
        {
          id: 'v-exp-1',
          encryptedCode: encryptSecret('EXPIRED99'),
          status: 'EXPIRED',
        },
      ];
    }
    return [
      {
        id: 'v-act-1',
        encryptedCode: encryptSecret('ACTIVE11'),
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        package: {
          id: 'pkg-12345678',
          durationMinutes: 60,
          uploadKbps: 1000,
          downloadKbps: 3000,
        },
      },
    ];
  });

  const restorePaymentFindMany = stubMethod(prisma.payment, 'findMany', async () => []);

  const prevCronSecret = env.CRON_SECRET;
  (env as any).CRON_SECRET = 'shared_hosting_cron_secret_token_32chars';

  const srv = await startTestServer();
  try {
    // 1. Verify MikroTik script generation in Shared Hosting mode (no WG_SERVER_ENDPOINT)
    const script = WireGuardService.generateMikroTikScript(
      '10.8.0.2',
      'pub',
      'priv',
      'router-sh-1',
      routerSecret,
      { callbackUrl: 'https://poafi.co.tz/api/enroll', token: 'a'.repeat(48) },
      { rosVersion: '7', enableHotspot: true },
    );
    assert.ok(script.includes('poafi-cloud-sync'), 'Script should install 15s HTTPS Cloud Sync scheduler');
    assert.ok(!script.includes('YOUR_POAFI_SERVER_WG_PUBLIC_KEY'), 'Script must not emit invalid WG peer key on shared hosting');

    // 2. HTTPS Cloud Sync rejects wrong key
    const badSync = await fetch(`${srv.baseUrl}/api/enroll/sync/router-sh-1?key=wrong-key`);
    assert.equal(badSync.status, 401);

    // 3. HTTPS Cloud Sync accepts valid key, marks router ONLINE, and outputs active & expired voucher commands
    const okSync = await fetch(`${srv.baseUrl}/api/enroll/sync/router-sh-1`, {
      headers: { 'X-Router-Key': routerSecret },
    });
    assert.equal(okSync.status, 200);
    assert.equal(routerStatus, 'ONLINE');
    const rsc = await okSync.text();
    assert.ok(rsc.includes('ACTIVE11'), 'Sync script should provision active voucher');
    assert.ok(rsc.includes('EXPIRED99'), 'Sync script should remove expired voucher');

    // 4. cPanel Cron endpoint rejects invalid secret and succeeds with valid secret
    const badCron = await fetch(`${srv.baseUrl}/api/internal/cron/run`, {
      headers: { 'X-Cron-Secret': 'wrong' },
    });
    assert.equal(badCron.status, 401);

    const okCron = await fetch(`${srv.baseUrl}/api/internal/cron/run`, {
      headers: { 'X-Cron-Secret': 'shared_hosting_cron_secret_token_32chars' },
    });
    assert.equal(okCron.status, 200);
    const cronBody = (await okCron.json()) as { ok: boolean };
    assert.equal(cronBody.ok, true);
  } finally {
    (env as any).CRON_SECRET = prevCronSecret;
    restoreRouterFind();
    restoreRouterUpdate();
    restoreVoucherUpdateMany();
    restoreVoucherFindMany();
    restorePaymentFindMany();
    await srv.close();
  }
});
