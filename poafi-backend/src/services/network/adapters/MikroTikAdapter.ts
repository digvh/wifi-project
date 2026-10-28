import { RouterOSAPI } from 'node-routeros';
import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

export class MikroTikAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'MIKROTIK';

  constructor(private readonly config: RouterConnectionConfig) {}

  private createClient(timeoutSeconds = 8): RouterOSAPI {
    const api = new RouterOSAPI({
      host: this.config.host,
      port: this.config.port || 8728,
      user: this.config.username,
      password: this.config.password,
      timeout: timeoutSeconds,
    });
    // Prevent unhandled error events from crashing the server
    api.on('error', (err) => {
      console.warn(`[MikroTik ${this.config.host}] Background socket warning:`, err.message);
    });
    return api;
  }

  async testConnection(): Promise<RouterTestResult> {
    const api = this.createClient(5);
    try {
      await api.connect();
      const identityRes = await api.write('/system/identity/print');
      const resourceRes = await api.write('/system/resource/print');

      const identity = identityRes[0]?.name || 'MikroTik';
      const resource = resourceRes[0] || {};

      const freeMem = resource['free-memory'] ? Math.round(parseInt(resource['free-memory']) / (1024 * 1024)) : undefined;

      return {
        connected: true,
        vendor: 'MIKROTIK',
        identity,
        version: resource['version'] || 'RouterOS',
        model: resource['board-name'] || resource['platform'] || 'RouterBOARD / CHR',
        uptime: resource['uptime'],
        cpuLoad: resource['cpu-load'] ? parseInt(resource['cpu-load']) : undefined,
        freeMemoryMb: freeMem,
      };
    } catch (error: any) {
      throw new Error(`MikroTik connection failed: ${error.message || 'Unable to connect to RouterOS API'}`);
    } finally {
      await api.close().catch(() => {});
    }
  }

  async provisionUser(options: ProvisionUserOptions): Promise<boolean> {
    const api = this.createClient(10);
    try {
      await api.connect();

      // MikroTik rate-limit format: rx-rate[/tx-rate] (rx = client upload, tx = client download)
      const rateLimitString = `${options.uploadKbps}k/${options.downloadKbps}k`;
      const pass = options.password || options.username;
      const profileName = `poafi-${options.downloadKbps}k-${options.uploadKbps}k`;

      // 1. Ensure Hotspot User Profile exists with speed and 1 shared user
      const allProfiles = await api.write('/ip/hotspot/user/profile/print');
      const hasProfile = Array.isArray(allProfiles) && allProfiles.some((p: any) => p.name === profileName);
      if (!hasProfile) {
        await api.write('/ip/hotspot/user/profile/add', [
          `=name=${profileName}`,
          `=rate-limit=${rateLimitString}`,
          `=shared-users=1`,
        ]);
      }

      // 2. Remove existing user if re-provisioning
      const allUsers = await api.write('/ip/hotspot/user/print');
      if (Array.isArray(allUsers)) {
        const existing = allUsers.filter((u: any) => u.name === options.username);
        for (const u of existing) {
          if (u['.id']) {
            await api.write('/ip/hotspot/user/remove', [`=.id=${u['.id']}`]);
          }
        }
      }

      // 3. Add hotspot user assigned to bandwidth profile
      await api.write('/ip/hotspot/user/add', [
        `=name=${options.username}`,
        `=password=${pass}`,
        `=profile=${profileName}`,
        `=limit-uptime=${options.durationMinutes}m`,
        `=comment=${options.comment || 'PoaFi Voucher'}`,
      ]);

      return true;
    } catch (error: any) {
      console.error('MikroTik provisionUser error:', error);
      throw new Error(`Failed to provision user on MikroTik: ${error.message || error}`);
    } finally {
      await api.close().catch(() => {});
    }
  }

  async removeUser(username: string): Promise<boolean> {
    const api = this.createClient(8);
    try {
      await api.connect();
      const allUsers = await api.write('/ip/hotspot/user/print');
      if (Array.isArray(allUsers)) {
        const existing = allUsers.filter((u: any) => u.name === username);
        for (const u of existing) {
          if (u['.id']) {
            await api.write('/ip/hotspot/user/remove', [`=.id=${u['.id']}`]);
          }
        }
      }
      return true;
    } catch (error: any) {
      throw new Error(`Failed to remove user from MikroTik: ${error.message || error}`);
    } finally {
      await api.close().catch(() => {});
    }
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    const api = this.createClient(8);
    try {
      await api.connect();
      const activeRaw = await api.write('/ip/hotspot/active/print');

      if (!Array.isArray(activeRaw)) return [];

      return activeRaw.map((entry: any) => ({
        id: entry['.id'],
        username: entry['user'] || 'Unknown',
        ipAddress: entry['address'] || '',
        macAddress: entry['mac-address'] || '',
        uptime: entry['uptime'] || '0s',
        bytesIn: entry['bytes-in'] ? parseInt(entry['bytes-in']) : 0,
        bytesOut: entry['bytes-out'] ? parseInt(entry['bytes-out']) : 0,
        sessionTimeLeft: entry['session-time-left'],
      }));
    } catch (error: any) {
      console.error('MikroTik listActiveSessions error:', error);
      return [];
    } finally {
      await api.close().catch(() => {});
    }
  }

  async disconnectSession(usernameOrId: string): Promise<boolean> {
    const api = this.createClient(8);
    try {
      await api.connect();

      let targetId = usernameOrId;
      if (!usernameOrId.startsWith('*')) {
        const allActive = await api.write('/ip/hotspot/active/print');
        if (Array.isArray(allActive)) {
          const match = allActive.find((a: any) => a.user === usernameOrId);
          if (match) {
            targetId = match['.id'];
          }
        }
      }

      if (targetId) {
        await api.write('/ip/hotspot/active/remove', [`=.id=${targetId}`]);
      }

      return true;
    } catch (error: any) {
      throw new Error(`Failed to disconnect session on MikroTik: ${error.message || error}`);
    } finally {
      await api.close().catch(() => {});
    }
  }
}
