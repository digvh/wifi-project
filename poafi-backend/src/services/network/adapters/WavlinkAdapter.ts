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
    throw new Error('Wavlink live API connection is not implemented. This device has NOT been verified as connected.');
  }

  async provisionUser(_options: ProvisionUserOptions): Promise<boolean> {
    throw new Error('Wavlink hotspot voucher provisioning is not implemented yet.');
  }

  async removeUser(_username: string): Promise<boolean> {
    throw new Error('Wavlink hotspot user removal is not implemented yet.');
  }

  async listActiveSessions(): Promise<ActiveSession[]> {
    throw new Error('Wavlink active-session retrieval is not implemented yet.');
  }

  async disconnectSession(_usernameOrId: string): Promise<boolean> {
    throw new Error('Wavlink session disconnection is not implemented yet.');
  }}

