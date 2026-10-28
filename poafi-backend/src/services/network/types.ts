export type RouterVendor =
  | 'MIKROTIK'
  | 'TPLINK_OMADA'
  | 'RUIJIE'
  | 'CUDY'
  | 'COMFAST'
  | 'WAVLINK';

export interface RouterConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  extraConfig?: Record<string, any>;
}

export interface RouterTestResult {
  connected: boolean;
  identity: string;
  version?: string;
  vendor: RouterVendor;
  model?: string;
  uptime?: string;
  cpuLoad?: number;
  freeMemoryMb?: number;
}

export interface ProvisionUserOptions {
  username: string;
  password?: string;
  durationMinutes: number;
  downloadKbps: number;
  uploadKbps: number;
  comment?: string;
}

export interface ActiveSession {
  id?: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  sessionTimeLeft?: string;
}

export interface IRouterAdapter {
  readonly vendor: RouterVendor;

  /**
   * Test connection to the router / controller and fetch device status
   */
  testConnection(): Promise<RouterTestResult>;

  /**
   * Provision a hotspot user / voucher with bandwidth and uptime constraints
   */
  provisionUser(options: ProvisionUserOptions): Promise<boolean>;

  /**
   * Remove a user from the router's hotspot database
   */
  removeUser(username: string): Promise<boolean>;

  /**
   * Query currently connected active hotspot sessions
   */
  listActiveSessions(): Promise<ActiveSession[]>;

  /**
   * Disconnect an active user session (kick client)
   */
  disconnectSession(usernameOrId: string): Promise<boolean>;
}

