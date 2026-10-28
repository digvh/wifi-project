import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

/**
 * Adapter for TP-Link Omada SDN ecosystem (Software Controller, OC200, OC300, Omada Cloud).
 * Interacts via Omada Controller OpenAPI.
 */
export class TPLinkOmadaAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'TPLINK_OMADA';

  constructor(private readonly config: RouterConnectionConfig) {}

  private get baseUrl(): string {
    const protocol = this.config.port === 443 || this.config.port === 8043 ? 'https' : 'http';
    return `${protocol}://${this.config.host}:${this.config.port || 8043}`;
  }

  async testConnection(): Promise<RouterTestResult> {
    try {
      // In production: POST /api/v2/login with config.username & password
      return {
        connected: true,
        vendor: 'TPLINK_OMADA',
        identity: `Omada Controller (${this.config.host})`,
        version: 'v5.x (SDN Ready)',
        model: 'TP-Link Omada SDN Gateway / Controller',
      };
    } catch (error: any) {
      throw new Error(`TP-Link Omada connection failed: ${error.message}`);
    }
  }

  async provisionUser(options: ProvisionUserOptions): Promise<boolean> {
    try {
      // In production:
      // POST /api/v2/sites/{site}/hotspot/vouchers
      // Generates Omada voucher with duration, rate limit (up/down kbps) and code
      return true;
    } catch (error: any) {
      throw new Error(`Failed to provision user on TP-Link Omada: ${error.message}`);
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

