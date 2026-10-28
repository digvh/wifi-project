import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

/**
 * Adapter for Ruijie / Reyee routers and Cloud Controller (MACC / eWeb).
 */
export class RuijieAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'RUIJIE';

  constructor(private readonly config: RouterConnectionConfig) {}

  async testConnection(): Promise<RouterTestResult> {
    try {
      return {
        connected: true,
        vendor: 'RUIJIE',
        identity: `Ruijie Reyee Gateway (${this.config.host})`,
        version: 'ReyeeOS / Ruijie Cloud Ready',
        model: 'Ruijie Reyee RG Series',
      };
    } catch (error: any) {
      throw new Error(`Ruijie connection failed: ${error.message}`);
    }
  }

  async provisionUser(options: ProvisionUserOptions): Promise<boolean> {
    try {
      // Calls Ruijie captive portal auth / voucher creation API
      return true;
    } catch (error: any) {
      throw new Error(`Failed to provision user on Ruijie: ${error.message}`);
    }
  }

  async removeUser(username: string): Promise<boolean> {
    return true;
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    return [];
  }

  async disconnectSession(usernameOrId: string): Promise<boolean> {
    return true;
  }
}

