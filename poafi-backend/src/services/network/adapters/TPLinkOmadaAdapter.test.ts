import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { TPLinkOmadaAdapter } from './TPLinkOmadaAdapter';
import { RouterAdapterFactory } from '../RouterAdapterFactory';

interface MockState {
  users: Array<{ id: string; userName: string; rateLimit: any }>;
  portals: Array<any>;
  clients: Array<{ id: string; mac: string; ip: string; authUser: string; trafficDown: number; trafficUp: number; authorized: boolean }>;
  kickedMacs: string[];
}

function createMockOmadaServer(state: MockState): Promise<{ port: number; close: () => Promise<void> }> {
  const omadacId = 'omada-cid-001';
  const csrfToken = 'csrf-secret-xyz';

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = req.url || '/';
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET' && url === '/api/info') {
        res.end(JSON.stringify({ errorCode: 0, result: { omadacId, controllerVer: '5.14.20', type: 'OC200' } }));
        return;
      }

      if (req.method === 'POST' && url === `/${omadacId}/api/v2/login`) {
        const body = JSON.parse(raw || '{}');
        if (body.username !== 'admin' || body.password !== 'pass123') {
          res.statusCode = 401;
          res.end(JSON.stringify({ errorCode: -44105, msg: 'Invalid credentials' }));
          return;
        }
        res.setHeader('Set-Cookie', 'TPOMADA_SESSIONID=sess-abc; Path=/; HttpOnly');
        res.end(JSON.stringify({ errorCode: 0, result: { token: csrfToken } }));
        return;
      }

      if (req.headers['csrf-token'] !== csrfToken || !String(req.headers.cookie || '').includes('TPOMADA_SESSIONID=sess-abc')) {
        res.statusCode = 401;
        res.end(JSON.stringify({ errorCode: -44106, msg: 'Missing session' }));
        return;
      }

      if (req.method === 'POST' && url === `/${omadacId}/api/v2/logout`) {
        res.end(JSON.stringify({ errorCode: 0 }));
        return;
      }

      if (req.method === 'GET' && url.startsWith(`/${omadacId}/api/v2/sites?`)) {
        res.end(JSON.stringify({ errorCode: 0, result: { data: [{ id: 'site-1', name: 'Kariakoo Plaza' }] } }));
        return;
      }

      if (req.method === 'GET' && url.startsWith(`/${omadacId}/api/v2/sites/site-1/devices`)) {
        res.end(JSON.stringify({
          errorCode: 0,
          result: {
            data: [
              { mac: 'AA-BB-CC-DD-EE-01', name: 'Main ER605', model: 'ER605 v2', type: 'gateway', ip: '192.168.0.1', status: 14, download: 1500000, upload: 400000 },
              { mac: 'AA-BB-CC-DD-EE-02', name: 'Lobby EAP', model: 'EAP610', type: 'ap', ip: '192.168.0.2', status: 14 },
            ],
          },
        }));
        return;
      }

      if (req.method === 'POST' && url === `/${omadacId}/api/v2/sites/site-1/setting/hotspot/localUsers`) {
        const body = JSON.parse(raw || '{}');
        state.users.push({ id: `u-${state.users.length + 1}`, userName: body.userName, rateLimit: body.rateLimit });
        res.end(JSON.stringify({ errorCode: 0, result: { id: `u-${state.users.length}` } }));
        return;
      }

      if (req.method === 'GET' && url.startsWith(`/${omadacId}/api/v2/sites/site-1/setting/hotspot/localUsers`)) {
        res.end(JSON.stringify({ errorCode: 0, result: { data: state.users } }));
        return;
      }

      if (req.method === 'DELETE' && url.startsWith(`/${omadacId}/api/v2/sites/site-1/setting/hotspot/localUsers/`)) {
        const id = url.split('/').pop();
        state.users = state.users.filter((u) => u.id !== id);
        res.end(JSON.stringify({ errorCode: 0 }));
        return;
      }

      if (req.method === 'GET' && url.startsWith(`/${omadacId}/api/v2/sites/site-1/clients`)) {
        res.end(JSON.stringify({ errorCode: 0, result: { data: state.clients } }));
        return;
      }

      if (req.method === 'POST' && url.endsWith('/unauthorize')) {
        const parts = url.split('/');
        const mac = decodeURIComponent(parts[parts.length - 2]);
        state.kickedMacs.push(mac);
        res.end(JSON.stringify({ errorCode: 0 }));
        return;
      }

      if (req.method === 'GET' && url.startsWith(`/${omadacId}/api/v2/sites/site-1/setting/portals`)) {
        res.end(JSON.stringify({ errorCode: 0, result: { data: state.portals } }));
        return;
      }

      if (req.method === 'POST' && url === `/${omadacId}/api/v2/sites/site-1/setting/portals`) {
        const body = JSON.parse(raw || '{}');
        const created = { id: `portal-${state.portals.length + 1}`, ...body };
        state.portals.push(created);
        res.end(JSON.stringify({ errorCode: 0, result: created }));
        return;
      }

      if (req.method === 'PATCH' && url.startsWith(`/${omadacId}/api/v2/sites/site-1/setting/portals/`)) {
        const id = decodeURIComponent(url.split('/').pop() || '');
        const body = JSON.parse(raw || '{}');
        state.portals = state.portals.map((p) => (p.id === id ? { ...p, ...body } : p));
        res.end(JSON.stringify({ errorCode: 0, result: body }));
        return;
      }

      if (req.method === 'POST' && url === `/${omadacId}/api/v2/sites/site-1/setting/portal/freePolicy`) {
        res.end(JSON.stringify({ errorCode: 0 }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ errorCode: -1, msg: `Unhandled ${req.method} ${url}` }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

test('TPLinkOmadaAdapter connects, discovers devices, manages hotspot users and disconnects clients', async () => {
  const state: MockState = {
    users: [],
    portals: [],
    clients: [
      { id: 'c-1', mac: '11-22-33-44-55-66', ip: '10.0.0.25', authUser: 'AB12CD34', trafficDown: 1024, trafficUp: 512, authorized: true },
    ],
    kickedMacs: [],
  };
  const srv = await createMockOmadaServer(state);

  try {
    const adapter = RouterAdapterFactory.getAdapter('TPLINK_OMADA', {
      host: '127.0.0.1',
      port: srv.port,
      username: 'admin',
      password: 'pass123',
      extraConfig: { protocol: 'http' },
    }) as TPLinkOmadaAdapter;

    const testRes = await adapter.testConnection();
    assert.equal(testRes.connected, true);
    assert.equal(testRes.vendor, 'TPLINK_OMADA');
    assert.equal(testRes.version, '5.14.20');
    assert.equal(testRes.model, 'ER605 v2');
    assert.equal(testRes.identity, 'Kariakoo Plaza - Main ER605');

    const discovery = await adapter.discoverController();
    assert.equal(discovery.sites.length, 1);
    assert.equal(discovery.devices.length, 2);

    await adapter.provisionUser({
      username: 'AB12CD34',
      durationMinutes: 60,
      downloadKbps: 5000,
      uploadKbps: 2000,
    });
    assert.equal(state.users.length, 1);
    assert.equal(state.users[0].userName, 'AB12CD34');
    assert.equal(state.users[0].rateLimit.downLimit, 5000);

    const sessions = await adapter.listActiveSessions();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].username, 'AB12CD34');
    assert.equal(sessions[0].macAddress, '11-22-33-44-55-66');

    await adapter.disconnectSession('AB12CD34');
    assert.deepEqual(state.kickedMacs, ['11-22-33-44-55-66']);

    await adapter.removeUser('AB12CD34');
    assert.equal(state.users.length, 0);

    const createdPortal = await adapter.configureHotspotPortal({
      portalUrl: 'https://app.poafi.co.tz/portal?tenant=tanga',
      walledGardenDomains: ['pay.custom.tz'],
    });
    assert.equal(createdPortal.ok, true);
    assert.equal(createdPortal.action, 'created');
    assert.equal(createdPortal.siteId, 'site-1');
    assert.ok(createdPortal.walledGardenDomains.includes('app.poafi.co.tz'));
    assert.ok(createdPortal.walledGardenDomains.includes('pay.custom.tz'));
    assert.equal(state.portals.length, 1);

    const updatedPortal = await adapter.configureHotspotPortal({
      portalUrl: 'https://app.poafi.co.tz/portal?tenant=arusha',
    });
    assert.equal(updatedPortal.action, 'updated');
    assert.equal(state.portals.length, 1);
    assert.equal(state.portals[0].landingUrl, 'https://app.poafi.co.tz/portal?tenant=arusha');

    const wan = await adapter.measureWanStats();
    assert.equal(wan.wanInterface, 'WAN (ER605 v2)');
    assert.equal(wan.rxMbps, 12);
    assert.equal(wan.txMbps, 3.2);
    assert.equal(wan.deviceCount, 2);
    assert.equal(wan.activeClients, 1);
  } finally {
    await srv.close();
  }
});
