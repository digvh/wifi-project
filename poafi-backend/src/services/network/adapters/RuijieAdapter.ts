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
    throw new Error('Ruijie / Reyee live API connection is not implemented. This device has NOT been verified as connected.');
  }

  async provisionUser(_options: ProvisionUserOptions): Promise<boolean> {
    throw new Error('Ruijie / Reyee hotspot voucher provisioning is not implemented yet.');
  }

  async removeUser(_username: string): Promise<boolean> {
    throw new Error('Ruijie / Reyee hotspot user removal is not implemented yet.');
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    throw new Error('Ruijie / Reyee active-session retrieval is not implemented yet.');
  }

  async disconnectSession(_usernameOrId: string): Promise<boolean> {
    throw new Error('Ruijie / Reyee session disconnection is not implemented yet.');
  }}

