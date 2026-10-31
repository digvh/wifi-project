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
    throw new Error('TP-Link Omada live API connection is not implemented. This device has NOT been verified as connected.');
  }

  async provisionUser(_options: ProvisionUserOptions): Promise<boolean> {
    throw new Error('TP-Link Omada hotspot voucher provisioning is not implemented yet.');
  }

  async removeUser(_username: string): Promise<boolean> {
    throw new Error('TP-Link Omada hotspot user removal is not implemented yet.');
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    throw new Error('TP-Link Omada active-session retrieval is not implemented yet.');
  }

  async disconnectSession(_usernameOrId: string): Promise<boolean> {
    throw new Error('TP-Link Omada session disconnection is not implemented yet.');
  }}

