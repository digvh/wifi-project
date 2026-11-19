import http from 'node:http';
import https from 'node:https';
import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

export interface OmadaDiscoveredSite {
  id: string;
  name: string;
}

export interface OmadaDiscoveredDevice {
  mac: string;
  name: string;
  model: string;
  type: string;
  ip?: string;
  status?: number;
}

export interface OmadaDiscoveryResult {
  omadacId: string;
  controllerVer: string;
  controllerType?: string;
  sites: OmadaDiscoveredSite[];
  devices: OmadaDiscoveredDevice[];
  suggestedName: string;
  primaryModel?: string;
}

export interface OmadaPortalSetupOptions {
  portalUrl: string;
  portalName?: string;
  authType?: number;
  walledGardenDomains?: string[];
  siteId?: string;
  radiusServerHost?: string;
  radiusSecret?: string;
}

export interface OmadaPortalSetupResult {
  ok: boolean;
  siteId: string;
  portalName: string;
  portalUrl: string;
  walledGardenDomains: string[];
  endpointUsed: string;
  action: 'created' | 'updated';
}

interface OmadaSession {
  omadacId: string;
  controllerVer: string;
  controllerType?: string;
  token: string;
  cookies: string[];
}

/**
 * Adapter for TP-Link Omada SDN ecosystem (Software Controller v5+, OC200, OC300).
 * Uses the Omada SDN Controller REST API (`/api/info` + `/{omadacId}/api/v2/...`).
 */
export class TPLinkOmadaAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'TPLINK_OMADA';

  constructor(private readonly config: RouterConnectionConfig) {}

  private get protocol(): 'http' | 'https' {
    if (this.config.extraConfig?.protocol === 'http') return 'http';
    if (this.config.extraConfig?.protocol === 'https') return 'https';
    return this.config.port === 80 || this.config.port === 8088 ? 'http' : 'https';
  }

  private get effectivePort(): number {
    return this.config.port || (this.protocol === 'https' ? 8043 : 8088);
  }

  private rawRequest(
    method: string,
    path: string,
    body?: unknown,
    session?: Pick<OmadaSession, 'token' | 'cookies'>,
  ): Promise<{ status: number; json: any; setCookies: string[] }> {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (payload !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = String(Buffer.byteLength(payload));
      }
      if (session?.token) {
        headers['Csrf-Token'] = session.token;
      }
      if (session?.cookies?.length) {
        headers.Cookie = session.cookies.join('; ');
      }

      const allowSelfSigned =
        this.config.extraConfig?.allowSelfSigned !== undefined
          ? Boolean(this.config.extraConfig.allowSelfSigned)
          : this.effectivePort !== 443;

      const options: https.RequestOptions = {
        hostname: this.config.host,
        port: this.effectivePort,
        path,
        method,
        headers,
        timeout: 8000,
        ...(this.protocol === 'https' ? { rejectUnauthorized: !allowSelfSigned } : {}),
      };

      const client = this.protocol === 'https' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const rawSetCookie = res.headers['set-cookie'] || [];
          const setCookies = rawSetCookie
            .map((c) => c.split(';')[0]?.trim())
            .filter(Boolean);
          let parsed: any = {};
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 500, json: parsed, setCookies });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Omada Controller timed out (${this.config.host}:${this.effectivePort})`));
      });
      req.on('error', (err) => {
        reject(new Error(`Omada connection failed: ${err.message}`));
      });

      if (payload !== undefined) req.write(payload);
      req.end();
    });
  }

  private async login(): Promise<OmadaSession> {
    const infoRes = await this.rawRequest('GET', '/api/info');
    if (infoRes.status >= 400 || !infoRes.json?.result?.omadacId) {
      throw new Error(
        `Unable to read Omada controller info from ${this.config.host}:${this.effectivePort} (HTTP ${infoRes.status})`,
      );
    }

    const { omadacId, controllerVer, type: controllerType } = infoRes.json.result;
    const loginRes = await this.rawRequest('POST', `/${omadacId}/api/v2/login`, {
      username: this.config.username,
      password: this.config.password,
    });

    if (loginRes.status >= 400 || loginRes.json?.errorCode !== 0 || !loginRes.json?.result?.token) {
      const msg = loginRes.json?.msg || `HTTP ${loginRes.status}`;
      throw new Error(`Omada authentication failed: ${msg}`);
    }

    return {
      omadacId,
      controllerVer: String(controllerVer || 'Omada SDN'),
      controllerType,
      token: String(loginRes.json.result.token),
      cookies: loginRes.setCookies,
    };
  }

  private async logout(session: OmadaSession): Promise<void> {
    await this.rawRequest('POST', `/${session.omadacId}/api/v2/logout`, {}, session).catch(() => {});
  }

  private async listSites(session: OmadaSession): Promise<OmadaDiscoveredSite[]> {
    const res = await this.rawRequest(
      'GET',
      `/${session.omadacId}/api/v2/sites?currentPage=1&currentPageSize=50`,
      undefined,
      session,
    );
    if (res.status >= 400 || res.json?.errorCode !== 0) {
      throw new Error(`Omada sites lookup failed: ${res.json?.msg || `HTTP ${res.status}`}`);
    }
    const rows = res.json?.result?.data || res.json?.result || [];
    return Array.isArray(rows)
      ? rows.map((s: any) => ({ id: String(s.id || s.key || 'Default'), name: String(s.name || 'Default') }))
      : [];
  }

  private async resolveSiteId(session: OmadaSession): Promise<string> {
    const configuredSite = this.config.extraConfig?.siteId;
    if (typeof configuredSite === 'string' && configuredSite.trim()) {
      return configuredSite.trim();
    }
    const sites = await this.listSites(session);
    const desiredName = this.config.extraConfig?.siteName;
    if (typeof desiredName === 'string' && desiredName.trim()) {
      const matched = sites.find((s) => s.name.toLowerCase() === desiredName.trim().toLowerCase());
      if (matched) return matched.id;
    }
    return sites[0]?.id || 'Default';
  }

  private async listSiteDevices(session: OmadaSession, siteId: string): Promise<OmadaDiscoveredDevice[]> {
    const res = await this.rawRequest(
      'GET',
      `/${session.omadacId}/api/v2/sites/${encodeURIComponent(siteId)}/devices?currentPage=1&currentPageSize=50`,
      undefined,
      session,
    );
    if (res.status >= 400 || res.json?.errorCode !== 0) {
      return [];
    }
    const rows = res.json?.result?.data || res.json?.result || [];
    return Array.isArray(rows)
      ? rows.map((d: any) => ({
          mac: String(d.mac || ''),
          name: String(d.name || d.model || d.mac || 'Omada Device'),
          model: String(d.model || d.showModel || 'Omada'),
          type: String(d.type || 'ap'),
          ip: d.ip ? String(d.ip) : undefined,
          status: typeof d.status === 'number' ? d.status : undefined,
        }))
      : [];
  }

  /**
   * Discover Omada controller info, sites, and adopted devices so PoaFi can auto-fill router forms.
   */
  async discoverController(): Promise<OmadaDiscoveryResult> {
    const session = await this.login();
    try {
      const sites = await this.listSites(session);
      const primarySite = sites[0]?.id || 'Default';
      const devices = await this.listSiteDevices(session, primarySite);
      const gateway = devices.find((d) => d.type.toLowerCase().includes('gateway')) || devices[0];
      const suggestedName = gateway
        ? `${sites[0]?.name || 'Omada'} - ${gateway.name}`
        : `${sites[0]?.name || 'Omada'} Controller`;

      return {
        omadacId: session.omadacId,
        controllerVer: session.controllerVer,
        controllerType: session.controllerType,
        sites,
        devices,
        suggestedName,
        primaryModel: gateway?.model,
      };
    } finally {
      await this.logout(session);
    }
  }

  async testConnection(): Promise<RouterTestResult> {
    const discovery = await this.discoverController();
    return {
      connected: true,
      vendor: 'TPLINK_OMADA',
      identity: discovery.suggestedName,
      version: discovery.controllerVer,
      model: discovery.primaryModel || discovery.controllerType || 'Omada SDN Controller',
    };
  }

  async provisionUser(options: ProvisionUserOptions): Promise<boolean> {
    const session = await this.login();
    try {
      const siteId = await this.resolveSiteId(session);
      const password = options.password || options.username;
      const body = {
        userName: options.username,
        password,
        enable: true,
        expirationType: 1, // by duration
        durationType: 0, // minutes
        duration: Math.max(1, Math.round(options.durationMinutes)),
        trafficLimitEnable: false,
        rateLimit: {
          enable: true,
          upEnable: true,
          upLimit: options.uploadKbps,
          downEnable: true,
          downLimit: options.downloadKbps,
        },
        note: options.comment || 'PoaFi Voucher',
      };

      const encodedSite = encodeURIComponent(siteId);
      const primaryPath = `/${session.omadacId}/api/v2/sites/${encodedSite}/setting/hotspot/localUsers`;
      let res = await this.rawRequest('POST', primaryPath, body, session);

      if (res.status === 404) {
        res = await this.rawRequest(
          'POST',
          `/${session.omadacId}/api/v2/sites/${encodedSite}/hotspot/localusers`,
          body,
          session,
        );
      }

      if (res.status >= 400 || (res.json?.errorCode !== undefined && res.json.errorCode !== 0)) {
        throw new Error(res.json?.msg || `HTTP ${res.status}`);
      }
      return true;
    } catch (error: any) {
      throw new Error(`Failed to provision user on TP-Link Omada: ${error.message || error}`);
    } finally {
      await this.logout(session);
    }
  }

  async removeUser(username: string): Promise<boolean> {
    const session = await this.login();
    try {
      const siteId = await this.resolveSiteId(session);
      const encodedSite = encodeURIComponent(siteId);
      const basePath = `/${session.omadacId}/api/v2/sites/${encodedSite}/setting/hotspot/localUsers`;

      const listRes = await this.rawRequest(
        'GET',
        `${basePath}?currentPage=1&currentPageSize=100&searchKey=${encodeURIComponent(username)}`,
        undefined,
        session,
      );
      if (listRes.status >= 400 || listRes.json?.errorCode !== 0) {
        return false;
      }

      const users = listRes.json?.result?.data || listRes.json?.result || [];
      const matches = Array.isArray(users)
        ? users.filter((u: any) => String(u.userName || u.name || '').toLowerCase() === username.toLowerCase())
        : [];

      for (const u of matches) {
        if (u.id) {
          await this.rawRequest('DELETE', `${basePath}/${encodeURIComponent(String(u.id))}`, undefined, session);
        }
      }
      return true;
    } catch (error: any) {
      throw new Error(`Failed to remove user on TP-Link Omada: ${error.message || error}`);
    } finally {
      await this.logout(session);
    }
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    const session = await this.login();
    try {
      const siteId = await this.resolveSiteId(session);
      const encodedSite = encodeURIComponent(siteId);
      const res = await this.rawRequest(
        'GET',
        `/${session.omadacId}/api/v2/sites/${encodedSite}/clients?currentPage=1&currentPageSize=100&filters.active=true`,
        undefined,
        session,
      );
      if (res.status >= 400 || res.json?.errorCode !== 0) {
        throw new Error(res.json?.msg || `HTTP ${res.status}`);
      }

      const rows = res.json?.result?.data || res.json?.result || [];
      if (!Array.isArray(rows)) return [];

      return rows
        .filter((c: any) => c.authorized !== false)
        .map((c: any) => ({
          id: String(c.id || c.mac || ''),
          username: String(c.authUser || c.name || c.mac || 'guest'),
          ipAddress: String(c.ip || ''),
          macAddress: String(c.mac || ''),
          uptime: String(c.uptime ?? c.connectSec ?? '0s'),
          bytesIn: Number(c.trafficDown || 0),
          bytesOut: Number(c.trafficUp || 0),
        }));
    } catch (error: any) {
      throw new Error(`Failed to list Omada active sessions: ${error.message || error}`);
    } finally {
      await this.logout(session);
    }
  }

  async disconnectSession(usernameOrId: string): Promise<boolean> {
    const session = await this.login();
    try {
      const siteId = await this.resolveSiteId(session);
      const encodedSite = encodeURIComponent(siteId);

      const listRes = await this.rawRequest(
        'GET',
        `/${session.omadacId}/api/v2/sites/${encodedSite}/clients?currentPage=1&currentPageSize=100&filters.active=true`,
        undefined,
        session,
      );
      const rows = listRes.json?.result?.data || listRes.json?.result || [];
      const needle = usernameOrId.toLowerCase();
      const targets = Array.isArray(rows)
        ? rows.filter((c: any) =>
            [c.mac, c.id, c.authUser, c.name].some((val) => val && String(val).toLowerCase() === needle),
          )
        : [];

      const macsToKick = targets.length > 0 ? targets.map((t: any) => String(t.mac)) : [usernameOrId];
      for (const mac of macsToKick) {
        if (!mac) continue;
        const encodedMac = encodeURIComponent(mac);
        const kickRes = await this.rawRequest(
          'POST',
          `/${session.omadacId}/api/v2/sites/${encodedSite}/cmd/clients/${encodedMac}/unauthorize`,
          {},
          session,
        );
        if (kickRes.status === 404) {
          await this.rawRequest(
            'POST',
            `/${session.omadacId}/api/v2/sites/${encodedSite}/cmd/clients/${encodedMac}/disconnect`,
            {},
            session,
          );
        }
      }
      return true;
    } catch (error: any) {
      throw new Error(`Failed to disconnect Omada client: ${error.message || error}`);
    } finally {
      await this.logout(session);
    }
  }

  /**
   * One-click configuration of the Omada Captive Portal + Pre-Authentication
   * (Walled Garden) rules via the Omada SDN Controller v5+ REST API.
   */
  async configureHotspotPortal(options: OmadaPortalSetupOptions): Promise<OmadaPortalSetupResult> {
    const portalName = (options.portalName || 'PoaFi Hotspot').trim().slice(0, 64);
    let portalHostname: string | null = null;
    try {
      portalHostname = new URL(options.portalUrl).hostname;
    } catch {
      throw new Error('Invalid Portal URL supplied for Omada configuration');
    }

    const walledGardenDomains = Array.from(
      new Set(
        [
          ...(options.walledGardenDomains || []),
          portalHostname,
          'poafi.co.tz',
          '*.poafi.co.tz',
          'azampay.co.tz',
          '*.azampay.co.tz',
        ].filter((d): d is string => Boolean(d && d !== 'localhost' && d !== '127.0.0.1')),
      ),
    );

    const session = await this.login();
    try {
      const siteId = options.siteId?.trim() || (await this.resolveSiteId(session));
      const encodedSite = encodeURIComponent(siteId);

      // 1. Inspect existing portals on this Omada site (v5+ uses /setting/portals, fallback /setting/portal)
      let listPath = `/${session.omadacId}/api/v2/sites/${encodedSite}/setting/portals`;
      let listRes = await this.rawRequest(
        'GET',
        `${listPath}?currentPage=1&currentPageSize=50`,
        undefined,
        session,
      );

      if (listRes.status === 404) {
        listPath = `/${session.omadacId}/api/v2/sites/${encodedSite}/setting/portal`;
        listRes = await this.rawRequest('GET', listPath, undefined, session);
      }

      if (listRes.status >= 400 || (listRes.json?.errorCode !== undefined && listRes.json.errorCode !== 0)) {
        throw new Error(listRes.json?.msg || `Omada portal lookup failed (HTTP ${listRes.status})`);
      }

      const rawResult = listRes.json?.result?.data || listRes.json?.result || [];
      const existingPortals: any[] = Array.isArray(rawResult)
        ? rawResult
        : rawResult && typeof rawResult === 'object' && rawResult.id
          ? [rawResult]
          : [];

      const matchedPortal = existingPortals.find(
        (p: any) =>
          String(p.name || '').toLowerCase() === portalName.toLowerCase() ||
          String(p.name || '').toLowerCase().includes('poafi'),
      );

      const portalPayload: Record<string, any> = {
        ...(matchedPortal || {}),
        name: portalName,
        enable: true,
        authType: options.authType ?? matchedPortal?.authType ?? 11,
        landingPage: 2,
        landingUrl: options.portalUrl,
        externalUrl: options.portalUrl,
        redirectUrl: options.portalUrl,
        freeAuthRule: {
          ...(matchedPortal?.freeAuthRule || {}),
          enable: true,
          preAuthAccess: true,
          domainList: walledGardenDomains,
        },
        preAuthAccess: {
          ...(matchedPortal?.preAuthAccess || {}),
          enable: true,
          domainList: walledGardenDomains,
        },
        walledGarden: {
          enable: true,
          domains: walledGardenDomains,
        },
      };

      let saveRes;
      let endpointUsed = listPath;
      let action: 'created' | 'updated';

      if (matchedPortal?.id) {
        action = 'updated';
        endpointUsed = `${listPath}/${encodeURIComponent(String(matchedPortal.id))}`;
        saveRes = await this.rawRequest('PATCH', endpointUsed, portalPayload, session);
        if (saveRes.status === 404 || saveRes.status === 405) {
          saveRes = await this.rawRequest('PUT', endpointUsed, portalPayload, session);
        }
      } else {
        action = 'created';
        saveRes = await this.rawRequest('POST', listPath, portalPayload, session);
        if (saveRes.status === 405 && !listPath.endsWith('portals')) {
          action = 'updated';
          saveRes = await this.rawRequest('PATCH', listPath, portalPayload, session);
        }
      }

      if (saveRes.status >= 400 || (saveRes.json?.errorCode !== undefined && saveRes.json.errorCode !== 0)) {
        throw new Error(saveRes.json?.msg || `HTTP ${saveRes.status}`);
      }

      // 2. Best-effort push to dedicated pre-auth/walled-garden policy endpoint if present
      if (walledGardenDomains.length > 0) {
        await this.rawRequest(
          'POST',
          `/${session.omadacId}/api/v2/sites/${encodedSite}/setting/portal/freePolicy`,
          { enable: true, domainList: walledGardenDomains },
          session,
        ).catch(() => {});
      }

      // 3. Optional RADIUS profile sync if RADIUS host + secret supplied
      if (options.radiusServerHost && options.radiusSecret) {
        await this.rawRequest(
          'POST',
          `/${session.omadacId}/api/v2/sites/${encodedSite}/setting/radius`,
          {
            name: 'PoaFi RADIUS',
            authServerIp: options.radiusServerHost,
            authPort: 1812,
            authKey: options.radiusSecret,
            acctEnable: true,
            acctServerIp: options.radiusServerHost,
            acctPort: 1813,
            acctKey: options.radiusSecret,
          },
          session,
        ).catch(() => {});
      }

      return {
        ok: true,
        siteId,
        portalName,
        portalUrl: options.portalUrl,
        walledGardenDomains,
        endpointUsed,
        action,
      };
    } catch (error: any) {
      throw new Error(`Failed to configure Omada Portal & Walled Garden: ${error.message || error}`);
    } finally {
      await this.logout(session);
    }
  }

  /**
   * Reads live WAN / site throughput (Mbps), device count, and active client count
   * from the TP-Link Omada SDN Controller API.
   */
  async measureWanStats(): Promise<{
    wanInterface: string;
    rxMbps: number;
    txMbps: number;
    pingMs: number | null;
    packetLossPct: number | null;
    activeClients: number;
    deviceCount: number;
    controllerVer: string;
  }> {
    const t0 = Date.now();
    const session = await this.login();
    const controllerRttMs = Math.max(1, Date.now() - t0);

    try {
      const siteId = await this.resolveSiteId(session);
      const encodedSite = encodeURIComponent(siteId);

      const [devRes, clientsRes] = await Promise.all([
        this.rawRequest(
          'GET',
          `/${session.omadacId}/api/v2/sites/${encodedSite}/devices?currentPage=1&currentPageSize=50`,
          undefined,
          session,
        ),
        this.rawRequest(
          'GET',
          `/${session.omadacId}/api/v2/sites/${encodedSite}/clients?currentPage=1&currentPageSize=100&filters.active=true`,
          undefined,
          session,
        ).catch(() => ({ status: 200, json: { errorCode: 0, result: { data: [] } } })),
      ]);

      const rawDevices = devRes.json?.result?.data || devRes.json?.result || [];
      const devices: any[] = Array.isArray(rawDevices) ? rawDevices : [];
      const gateway = devices.find((d) => String(d.type || '').toLowerCase().includes('gateway'));

      const rawClients = clientsRes.json?.result?.data || clientsRes.json?.result || [];
      const clients: any[] = Array.isArray(rawClients) ? rawClients : [];
      const totalClients = Number(clientsRes.json?.result?.totalRows ?? clients.length);

      let rxBps = 0;
      let txBps = 0;

      if (gateway) {
        // Omada gateway telemetry (supports bytes/sec or bps field variants across v5 releases)
        const gwDown = Number(gateway.download ?? gateway.rxRate ?? gateway.downLoadRate ?? 0);
        const gwUp = Number(gateway.upload ?? gateway.txRate ?? gateway.upLoadRate ?? 0);
        // Omada `download`/`upload` in devices list are typically bytes/sec; convert to bits/sec
        rxBps = gwDown > 0 ? gwDown * 8 : 0;
        txBps = gwUp > 0 ? gwUp * 8 : 0;

        if (rxBps === 0 && txBps === 0 && Array.isArray(gateway.wanPortStats)) {
          for (const wp of gateway.wanPortStats) {
            rxBps += Number(wp.rxRate || 0) * 8;
            txBps += Number(wp.txRate || 0) * 8;
          }
        }
      }

      if (rxBps === 0 && txBps === 0) {
        // Fallback: sum active client rates (bytes/sec -> bits/sec)
        for (const c of clients) {
          rxBps += Number(c.trafficDownRate ?? c.downPacketRate ?? c.rxRate ?? 0) * 8;
          txBps += Number(c.trafficUpRate ?? c.upPacketRate ?? c.txRate ?? 0) * 8;
        }
      }

      const rxMbps = Number((rxBps / 1_000_000).toFixed(2));
      const txMbps = Number((txBps / 1_000_000).toFixed(2));
      const labelTarget = gateway
        ? `WAN (${gateway.model || gateway.name || 'Omada Gateway'})`
        : `${devices[0]?.model || 'Omada EAP'} (${devices.length} dev)`;

      const gwLatency = gateway?.latency !== undefined && Number.isFinite(Number(gateway.latency))
        ? Number(gateway.latency)
        : controllerRttMs;

      return {
        wanInterface: labelTarget,
        rxMbps,
        txMbps,
        pingMs: gwLatency,
        packetLossPct: 0,
        activeClients: Number.isFinite(totalClients) ? totalClients : clients.length,
        deviceCount: devices.length,
        controllerVer: session.controllerVer,
      };
    } catch (error: any) {
      throw new Error(`Failed to measure Omada WAN telemetry: ${error.message || error}`);
    } finally {
      await this.logout(session);
    }
  }
}
