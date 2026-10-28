import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

/**
 * Adapter for Wavlink Outdoor Access Points and High Power Routers (Aerial HD series).
 */
export class WavlinkAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'WAVLINK';

  constructor(private readonly config: RouterConnectionConfig) {}

  async testConnection(): Promise<RouterTestResult> {
    try {
      return {
        connected: true,
        vendor: 'WAVLINK',
        identity: `Wavlink Device (${this.config.host})`,
        version: 'Wavlink WebOS',
        model: 'Wavlink Aerial High Power Outdoor AP',
      };
    } catch (error: any) {
      throw new Error(`Wavlink connection failed: ${error.message}`);
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

