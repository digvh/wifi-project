import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

export const DEVICE_CATEGORIES = [
  { value: 'ROUTER', label: 'Routers', subcategories: ['Home', 'Business', 'Enterprise', 'Multi-WAN'] },
  { value: 'ACCESS_POINT', label: 'Access Points', subcategories: ['Indoor', 'Outdoor', 'Ceiling-mounted', 'Wall-mounted'] },
  { value: 'WIRELESS_CPE', label: 'Wireless CPE', subcategories: ['Point-to-point', 'Point-to-multipoint', 'Long-range client'] },
  { value: 'MESH_SYSTEM', label: 'Mesh Systems', subcategories: ['Indoor mesh', 'Outdoor mesh'] },
  { value: 'SWITCH', label: 'Network Switches', subcategories: ['Managed', 'Unmanaged', 'PoE'] },
  { value: 'RANGE_EXTENDER', label: 'Range Extenders', subcategories: ['Repeater', 'Extender'] },
  { value: 'GATEWAY', label: 'Gateways', subcategories: ['Hotspot', 'Security', 'Enterprise'] },
  { value: 'CONTROLLER', label: 'Network Controllers', subcategories: ['Hardware', 'Software', 'Cloud'] },
] as const;

const CATEGORY_VALUES = DEVICE_CATEGORIES.map(category => category.value) as readonly string[];
const ENVIRONMENTS = ['INDOOR', 'OUTDOOR', 'BOTH'];

export function getCoverageBand(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters <= 100) return '0-100m';
  if (meters <= 300) return '101-300m';
  if (meters <= 500) return '301-500m';
  return 'Above 500m';
}

function validateDeviceInput(body: any, partial = false): { data?: Record<string, unknown>; error?: string } {
  const allowed = [
    'brand', 'model', 'category', 'subcategory', 'environment', 'coverageMeters',
    'coverageNote', 'frequencyBands', 'wifiStandard', 'maxClients', 'maxSpeedMbps',
    'antenna', 'poe', 'ipRating', 'managementPlatform', 'hotspotSupport', 'notes', 'sourceUrl',
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  if (!partial || body.brand !== undefined) {
    if (typeof body.brand !== 'string' || !body.brand.trim() || body.brand.trim().length > 80) {
      return { error: 'Brand is required and must be 80 characters or fewer' };
    }
    data.brand = body.brand.trim();
  }
  if (!partial || body.model !== undefined) {
    if (typeof body.model !== 'string' || !body.model.trim() || body.model.trim().length > 120) {
      return { error: 'Model is required and must be 120 characters or fewer' };
    }
    data.model = body.model.trim();
  }
  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string' || !CATEGORY_VALUES.includes(body.category)) {
      return { error: 'Choose a valid device category' };
    }
  }
  if (body.environment !== undefined) {
    if (typeof body.environment !== 'string' || !ENVIRONMENTS.includes(body.environment)) {
      return { error: 'Environment must be INDOOR, OUTDOOR, or BOTH' };
    }
  }
  for (const key of ['coverageMeters', 'maxClients', 'maxSpeedMbps']) {
    if (body[key] !== undefined && body[key] !== null) {
      if (!Number.isInteger(body[key]) || body[key] < 0 || body[key] > 10000000) {
        return { error: key + ' must be a non-negative whole number' };
      }
    }
  }
  if (body.frequencyBands !== undefined && (!Array.isArray(body.frequencyBands) ||
      body.frequencyBands.length > 10 ||
      body.frequencyBands.some((band: unknown) => typeof band !== 'string' || band.length > 40))) {
    return { error: 'frequencyBands must be an array of up to 10 short strings' };
  }
  if (body.hotspotSupport !== undefined && typeof body.hotspotSupport !== 'boolean') {
    return { error: 'hotspotSupport must be true or false' };
  }
  for (const key of ['subcategory', 'coverageNote', 'wifiStandard', 'antenna', 'poe', 'ipRating', 'managementPlatform', 'notes']) {
    if (body[key] !== undefined && body[key] !== null &&
        (typeof body[key] !== 'string' || body[key].length > 2000)) {
      return { error: key + ' must be text of 2000 characters or fewer' };
    }
  }
  if (body.sourceUrl !== undefined && body.sourceUrl !== null && body.sourceUrl !== '') {
    try {
      const url = new URL(body.sourceUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol');
    } catch {
      return { error: 'sourceUrl must be a valid http or https URL' };
    }
  }
  return { data };
}

router.get('/categories', (_req, res) => res.json({ categories: DEVICE_CATEGORIES }));

router.get('/', async (req, res) => {
  try {
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const coverageBand = typeof req.query.coverageBand === 'string' ? req.query.coverageBand : undefined;

    const devices = await prisma.networkDeviceModel.findMany({
      where: {
        ...(brand ? { brand: { equals: brand, mode: 'insensitive' as const } } : {}),
        ...(category ? { category } : {}),
        ...(search ? { OR: [
          { brand: { contains: search, mode: 'insensitive' as const } },
          { model: { contains: search, mode: 'insensitive' as const } },
          { subcategory: { contains: search, mode: 'insensitive' as const } },
        ] } : {}),
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    });
    const results = devices
      .map(device => ({ ...device, coverageBand: getCoverageBand(device.coverageMeters) }))
      .filter(device => !coverageBand || device.coverageBand === coverageBand);

    res.json({
      devices: results,
      categories: DEVICE_CATEGORIES,
      coverageBands: ['0-100m', '101-300m', '301-500m', 'Above 500m', 'Not specified'],
      note: 'Coverage is an advertised maximum where available, not a guaranteed Wi-Fi radius.',
    });
  } catch {
    res.status(500).json({ error: 'Failed to load network device catalogue' });
  }
});

// Catalogue write access is restricted to the platform administrator.
router.post('/', requirePlatformAdmin, async (req, res) => {
  const validation = validateDeviceInput(req.body);
  if (validation.error || !validation.data) {
    res.status(400).json({ error: validation.error || 'Invalid device model data' });
    return;
  }
  try {
    const device = await prisma.networkDeviceModel.create({
      data: validation.data as any,
    });
    res.status(201).json({ message: 'Device model added', device: { ...device, coverageBand: getCoverageBand(device.coverageMeters) } });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'That brand and model already exists in the catalogue' });
      return;
    }
    res.status(500).json({ error: 'Failed to add device model' });
  }
});

router.put('/:id', requirePlatformAdmin, async (req, res) => {
  const validation = validateDeviceInput(req.body, true);
  if (validation.error || !validation.data || Object.keys(validation.data).length === 0) {
    res.status(400).json({ error: validation.error || 'Provide at least one valid field to update' });
    return;
  }
  try {
    const existing = await prisma.networkDeviceModel.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Device model not found' });
      return;
    }
    const device = await prisma.networkDeviceModel.update({
      where: { id: req.params.id },
      data: validation.data as any,
    });
    res.json({ message: 'Device model updated', device: { ...device, coverageBand: getCoverageBand(device.coverageMeters) } });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'That brand and model already exists in the catalogue' });
      return;
    }
    res.status(500).json({ error: 'Failed to update device model' });
  }
});

router.delete('/:id', requirePlatformAdmin, async (req, res) => {
  try {
    const existing = await prisma.networkDeviceModel.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Device model not found' });
      return;
    }
    await prisma.networkDeviceModel.delete({ where: { id: req.params.id } });
    res.json({ message: 'Device model deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete device model' });
  }
});

export default router;
