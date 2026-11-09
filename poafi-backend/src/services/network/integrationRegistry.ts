import { RouterVendor } from './types';

export type RouterIntegrationStatus = 'IMPLEMENTED' | 'PLANNED';
export type RouterIntegrationCapability =
  | 'CONNECTION_TEST'
  | 'VOUCHER_PROVISIONING'
  | 'USER_REMOVAL'
  | 'ACTIVE_SESSIONS'
  | 'SESSION_DISCONNECT';

export const ROUTER_ENDPOINT_CATEGORIES = ['ROUTER', 'GATEWAY', 'CONTROLLER'] as const;

export interface VendorIntegrationDefinition {
  vendor: RouterVendor;
  label: string;
  status: RouterIntegrationStatus;
  capabilities: RouterIntegrationCapability[];
  defaultPort: number;
  managementTarget: 'DEVICE' | 'CONTROLLER';
  notes: string;
}

/**
 * This is deliberately a truthful implementation registry, not a list of brands
 * that happen to exist in the device catalogue. A catalogue entry does not mean
 * that PoaFi has a working driver for that device.
 */
export const VENDOR_INTEGRATIONS: VendorIntegrationDefinition[] = [
  {
    vendor: 'MIKROTIK',
    label: 'MikroTik RouterOS',
    status: 'IMPLEMENTED',
    capabilities: [
      'CONNECTION_TEST',
      'VOUCHER_PROVISIONING',
      'USER_REMOVAL',
      'ACTIVE_SESSIONS',
      'SESSION_DISCONNECT',
    ],
    defaultPort: 8728,
    managementTarget: 'DEVICE',
    notes: 'Implemented through the RouterOS API. Test on a dedicated router account and private management network.',
  },
  {
    vendor: 'TPLINK_OMADA',
    label: 'TP-Link Omada',
    status: 'PLANNED',
    capabilities: [],
    defaultPort: 8043,
    managementTarget: 'CONTROLLER',
    notes: 'Controller OpenAPI authentication, site discovery, client queries and hotspot provisioning are not implemented yet.',
  },
  {
    vendor: 'RUIJIE',
    label: 'Ruijie / Reyee',
    status: 'PLANNED',
    capabilities: [],
    defaultPort: 443,
    managementTarget: 'CONTROLLER',
    notes: 'Cloud/controller API integration is not implemented. Availability and permissions must be verified per product family.',
  },
  {
    vendor: 'CUDY',
    label: 'Cudy',
    status: 'PLANNED',
    capabilities: [],
    defaultPort: 80,
    managementTarget: 'DEVICE',
    notes: 'No tested Cudy or OpenWrt-based device driver is installed.',
  },
  {
    vendor: 'COMFAST',
    label: 'Comfast',
    status: 'PLANNED',
    capabilities: [],
    defaultPort: 80,
    managementTarget: 'DEVICE',
    notes: 'No tested device API or controller integration is installed.',
  },
  {
    vendor: 'WAVLINK',
    label: 'Wavlink',
    status: 'PLANNED',
    capabilities: [],
    defaultPort: 80,
    managementTarget: 'DEVICE',
    notes: 'No tested device API or controller integration is installed.',
  },
];

const BRAND_ALIASES: Record<string, string[]> = {
  MIKROTIK: ['mikrotik'],
  TPLINK_OMADA: ['tplink', 'tplinkomada'],
  RUIJIE: ['ruijie', 'reyee'],
  CUDY: ['cudy'],
  COMFAST: ['comfast'],
  WAVLINK: ['wavlink'],
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeRouterVendor(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function getVendorIntegration(vendor: string): VendorIntegrationDefinition | undefined {
  const normalized = normalizeRouterVendor(vendor);
  return VENDOR_INTEGRATIONS.find((entry) => entry.vendor === normalized);
}

export function validateRouterEndpointModel(
  vendor: string,
  model: { brand: string; category: string },
): { valid: true } | { valid: false; reason: string } {
  const category = model.category.toUpperCase();
  if (!(ROUTER_ENDPOINT_CATEGORIES as readonly string[]).includes(category)) {
    return {
      valid: false,
      reason: 'This Router record can link only to a Router, Gateway, or Controller model. Access points, switches, extenders and CPE inventory need their own device records.',
    };
  }

  const normalizedVendor = normalizeRouterVendor(vendor);
  const aliases = BRAND_ALIASES[normalizedVendor] || [compact(normalizedVendor)];
  if (!aliases.includes(compact(model.brand))) {
    return {
      valid: false,
      reason: 'The selected catalogue model brand does not match the selected router integration vendor.',
    };
  }

  return { valid: true };
}
