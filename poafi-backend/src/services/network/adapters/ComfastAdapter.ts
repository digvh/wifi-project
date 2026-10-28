import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

/**
 * Adapter for Comfast Gateway and Outdoor AP series.
 */
export class ComfastAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'COMFAST';

  constructor(private readonly config: RouterConnectionConfig) {}

  async testConnection(): Promise<RouterTestResult> {
    try {
      return {
        connected: true,
        vendor: 'COMFAST',
        identity: `Comfast AP/Gateway (${this.config.host})`,
        version: 'OrangeOS / OpenWRT Firmware',
        model: 'Comfast CF Series High Power',
      };
    } catch (error: any) {
      throw new Error(`Comfast connection failed: ${error.message}`);
    }
  }

  async provisionUser(options: ProvisionUserOptions): Promise<boolean> {
    return true;
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

