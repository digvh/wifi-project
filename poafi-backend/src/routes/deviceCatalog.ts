import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';

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

export function getCoverageBand(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters <= 100) return '0-100m';
  if (meters <= 300) return '101-300m';
  if (meters <= 500) return '301-500m';
  return 'Above 500m';
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
        ...(brand ? { brand: { equals: brand, mode: 'insensitive' } } : {}),
        ...(category ? { category } : {}),
        ...(search ? { OR: [
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { subcategory: { contains: search, mode: 'insensitive' } },
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

export default router;
