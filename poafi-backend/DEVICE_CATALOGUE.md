# PoaFi Network Device Catalogue

## Purpose

The catalogue describes network equipment independently from the router-management adapters. It lets operators browse devices by category, model and advertised coverage without claiming that every listed device can already be configured by PoaFi.

## Categories

- Routers: home, business, enterprise and multi-WAN
- Access points: indoor, outdoor, ceiling-mounted and wall-mounted
- Wireless CPE: point-to-point, point-to-multipoint and long-range client equipment
- Mesh systems: indoor and outdoor
- Switches: managed, unmanaged and PoE
- Range extenders: repeaters and extenders
- Gateways: hotspot, security and enterprise
- Controllers: hardware, software and cloud

## Coverage bands

The API derives a band from the exact advertised maximum coverage stored in metres:

- 0-100m
- 101-300m
- 301-500m
- Above 500m
- Not specified

The exact value remains available as `coverageMeters`. A range is never inferred when the manufacturer has not published one. Published maximums are not guaranteed coverage; walls, interference, antenna orientation, mounting, transmit power and client capabilities affect real-world results.

## Initial verified sample models

The first migration seeds four TP-Link outdoor access points: EAP110-Outdoor, EAP225-Outdoor, EAP610-Outdoor and EAP650-Outdoor. TP-Link's outdoor Wi-Fi comparison publishes maximum ranges of 200m for EAP110-Outdoor and up to 300m on 5 GHz / 200m on 2.4 GHz for EAP225-Outdoor, EAP610-Outdoor and EAP650-Outdoor. See the [manufacturer comparison](https://www.tp-link.com/uk/business-networking/solution/outdoor-wifi/).

This is an initial verified sample, not a claim that the catalogue already contains every model or every brand. Additional MikroTik, Ruijie/Reyee, Cudy, Comfast, Wavlink, Ubiquiti, Cambium, Grandstream and other models should be added only after checking the exact model and hardware revision against manufacturer documentation.

## API

All routes require the existing bearer-token authentication.

- `GET /api/device-catalog` — list catalogue records
- `GET /api/device-catalog?category=ACCESS_POINT` — filter by category
- `GET /api/device-catalog?brand=TP-Link` — filter by brand
- `GET /api/device-catalog?search=EAP610` — search brand, model and subcategory
- `GET /api/device-catalog?coverageBand=101-300m` — filter by derived coverage band
- `GET /api/device-catalog/categories` — list supported categories

## Database deployment

From `poafi-backend`, apply the additive migration with:

```bash
npx prisma migrate deploy
npx prisma generate
```

The migration creates a new catalogue table and sample records. It does not update or delete existing tenants, routers, packages, vouchers or payments.

## Important integration boundary

A catalogue record is product information only. It does not make the device manageable by PoaFi. Actual hotspot provisioning, voucher creation, bandwidth enforcement, session listing and disconnection require a tested integration adapter for the exact device family, firmware and controller/API. The existing router integration work remains separate.
