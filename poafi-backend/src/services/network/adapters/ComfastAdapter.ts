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
    throw new Error('Comfast live API connection is not implemented. This device has NOT been verified as connected.');
  }

  async provisionUser(_options: ProvisionUserOptions): Promise<boolean> {
    throw new Error('Comfast hotspot voucher provisioning is not implemented yet.');
  }

  async removeUser(_username: string): Promise<boolean> {
    throw new Error('Comfast hotspot user removal is not implemented yet.');
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    throw new Error('Comfast active-session retrieval is not implemented yet.');
  }

  async disconnectSession(_usernameOrId: string): Promise<boolean> {
    throw new Error('Comfast session disconnection is not implemented yet.');
  }}

