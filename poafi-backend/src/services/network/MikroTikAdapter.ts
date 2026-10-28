export * from './adapters/MikroTikAdapter';
import { MikroTikAdapter as BaseMikroTikAdapter } from './adapters/MikroTikAdapter';
import { RouterConnectionConfig } from './types';

export class MikroTikAdapter extends BaseMikroTikAdapter {
  static async testConnection(config: RouterConnectionConfig) {
    const adapter = new BaseMikroTikAdapter(config);
    return adapter.testConnection();
  }

  static async provisionUser(
    config: RouterConnectionConfig,
    voucherCode: string,
    durationMinutes: number,
    downloadKbps: number,
    uploadKbps: number
  ) {
    const adapter = new BaseMikroTikAdapter(config);
    return adapter.provisionUser({
      username: voucherCode,
      durationMinutes,
      downloadKbps,
      uploadKbps,
    });
  }
}
