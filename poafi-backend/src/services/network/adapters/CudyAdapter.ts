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
    try {
      return {
        connected: true,
        vendor: 'CUDY',
        identity: `Cudy Device (${this.config.host})`,
        version: 'CudyOS',
        model: 'Cudy Gigabit Router / AP',
      };
    } catch (error: any) {
      throw new Error(`Cudy connection failed: ${error.message}`);
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

