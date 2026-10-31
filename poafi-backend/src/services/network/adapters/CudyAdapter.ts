import {
  IRouterAdapter,
  RouterVendor,
  RouterConnectionConfig,
  RouterTestResult,
  ProvisionUserOptions,
  ActiveSession,
} from '../types';

/**
 * Adapter for Cudy Access Points and Routers (OpenWRT / CudyOS based).
 */
export class CudyAdapter implements IRouterAdapter {
  readonly vendor: RouterVendor = 'CUDY';

  constructor(private readonly config: RouterConnectionConfig) {}

  async testConnection(): Promise<RouterTestResult> {
    throw new Error('Cudy live API connection is not implemented. This device has NOT been verified as connected.');
  }

  async provisionUser(_options: ProvisionUserOptions): Promise<boolean> {
    throw new Error('Cudy hotspot voucher provisioning is not implemented yet.');
  }

  async removeUser(_username: string): Promise<boolean> {
    throw new Error('Cudy hotspot user removal is not implemented yet.');
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    throw new Error('Cudy active-session retrieval is not implemented yet.');
  }

  async disconnectSession(_usernameOrId: string): Promise<boolean> {
    throw new Error('Cudy session disconnection is not implemented yet.');
  }}

