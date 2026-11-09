import { IRouterAdapter, RouterVendor, RouterConnectionConfig } from './types';
import { MikroTikAdapter } from './adapters/MikroTikAdapter';
import { getVendorIntegration, normalizeRouterVendor } from './integrationRegistry';

export type RouterAdapterBuilder = (config: RouterConnectionConfig) => IRouterAdapter;

/**
 * Runtime registry for vendor drivers.
 *
 * Adding a manufacturer to the catalogue does not register a driver. A driver
 * must be implemented and explicitly registered here before connection or
 * provisioning calls can be made for that manufacturer.
 */
export class RouterAdapterFactory {
  private static readonly adapters = new Map<string, RouterAdapterBuilder>([
    ['MIKROTIK', (config) => new MikroTikAdapter(config)],
  ]);

  static registerAdapter(vendor: string, builder: RouterAdapterBuilder): void {
    const normalizedVendor = normalizeRouterVendor(vendor);
    if (!normalizedVendor || !/^[A-Z0-9_]+$/.test(normalizedVendor)) {
      throw new Error('A valid normalized vendor key is required to register an adapter');
    }
    if (this.adapters.has(normalizedVendor)) {
      throw new Error('A router adapter is already registered for ' + normalizedVendor);
    }
    this.adapters.set(normalizedVendor, builder);
  }

  static hasAdapter(vendor: string): boolean {
    return this.adapters.has(normalizeRouterVendor(vendor));
  }

  static getRegisteredVendors(): string[] {
    return [...this.adapters.keys()].sort();
  }

  static getAdapter(vendor: string | RouterVendor, config: RouterConnectionConfig): IRouterAdapter {
    const normalizedVendor = normalizeRouterVendor(vendor || 'MIKROTIK');
    const builder = this.adapters.get(normalizedVendor);

    if (!builder) {
      const integration = getVendorIntegration(normalizedVendor);
      if (integration) {
        throw new Error(
          integration.label + ' is listed in the device catalogue, but its live PoaFi adapter is not implemented. The device has NOT been connected or verified.',
        );
      }
      throw new Error(
        'No live PoaFi adapter is registered for vendor ' + normalizedVendor + '. The device has NOT been connected or verified.',
      );
    }

    const adapter = builder(config);
    if (normalizeRouterVendor(adapter.vendor) !== normalizedVendor) {
      throw new Error('The registered adapter vendor does not match the requested vendor');
    }
    return adapter;
  }
}
