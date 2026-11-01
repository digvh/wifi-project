# PoaFi Vendor and Device Integration Audit

Audit branch: \`feature/vendor-neutral-device-integration-foundation\`

## Executive finding

PoaFi is **not yet a universal multi-vendor network-management platform**. The device catalogue can describe equipment from multiple manufacturers, but catalogue support is not the same as a working connection driver.

At this audit:
- MikroTik RouterOS is the only live adapter registered in the backend.
- TP-Link Omada, Ruijie/Reyee, Cudy, Comfast and Wavlink are known vendor choices but have no live adapter registered.
- A router connection record can currently represent a device endpoint or a controller endpoint, but it is not a complete inventory model for access points, switches, CPEs and mesh nodes.
- The connection-mode field records a selected path. It does not create a VPN, tunnel, cloud account or controller connection.
- Omada Controller API credentials and authentication are not yet used by PoaFi. Registering an Omada application in the controller does not make PoaFi integration complete.

## Changes started in this phase

1. Introduce a vendor adapter registry so new vendor drivers can be registered without expanding a hard-coded switch statement.
2. Publish an authenticated integration-capabilities endpoint that distinguishes implemented drivers from planned integrations.
3. Validate that the selected device model belongs to the selected vendor and is a Router, Gateway or Controller endpoint. An AP or switch must not be represented as a router merely because it appears in the catalogue.
4. Prevent clients from setting router connection status or setup status through the general edit endpoint. Status must be produced by server-side tests; configured status must require a future verified provisioning workflow.
5. Validate package-to-router ownership, route vouchers to their package-selected router, and claim a voucher atomically before provisioning so two clients cannot redeem the same voucher concurrently.
6. Make expiry cleanup use the router assigned to each package rather than selecting an arbitrary online router for the tenant.

## Current capability matrix

| Vendor | Connection test | Voucher provisioning | Sessions | Status |
|---|---:|---:|---:|---|
| MikroTik RouterOS | Yes | Yes | Yes | Implemented |
| TP-Link Omada | No | No | No | Planned — controller integration |
| Ruijie / Reyee | No | No | No | Planned — API/controller verification needed |
| Cudy | No | No | No | Planned — model/firmware API verification needed |
| Comfast | No | No | No | Planned — model/firmware API verification needed |
| Wavlink | No | No | No | Planned — model/firmware API verification needed |

Do not describe any planned integration as connected or supported.

## Why “any vendor” needs vendor-specific work

There is no universal management API that every router, access point, switch and controller implements. Vendors expose different APIs, authentication methods, firmware capabilities, controller models and license requirements. Some equipment is managed directly; other equipment is adopted by a controller. Some consumer devices expose no supported third-party management API at all.

The adapter registry is an extension point, not a compatibility guarantee. A new driver must be implemented against the manufacturer's official API and tested against the exact supported model/firmware.

## Recommended architecture phases

### Phase A — Integration foundation
- Vendor driver registry and capability reporting.
- Model/vendor/category validation.
- Server-owned connection and configuration statuses.
- Tenant-aware router/package assignment.
- Idempotent and concurrency-safe voucher lifecycle.

### Phase B — Omada controller integration
- Store controller integration configuration separately from an individual AP/router record.
- Encrypt client secrets and store them only in the backend.
- Implement the exact authentication and token lifecycle for the installed Omada Controller version.
- Read controller identity, sites, adopted device inventory and clients first.
- Add read-only tests before enabling any write operations.
- Add explicit controller-site-to-PoaFi-tenant mapping and audit logging.
- Implement hotspot/voucher operations only after verifying the controller API and suitable hardware.

### Phase C — Additional vendors
Prioritize one integration at a time (for example Ruijie/Reyee, UniFi, Grandstream or OpenWrt-compatible platforms). Each needs:
- official API and support/licensing confirmation;
- supported model and firmware matrix;
- connection and authentication tests;
- read-only inventory/client tests;
- provisioning, disconnect and removal tests;
- a real-device integration test suite.

### Phase D — Network device inventory and remote access
- Separate Controller, Gateway, Access Point, Switch and CPE instances from the current Router record.
- Model controller-managed sites and controller-to-device relationships.
- Add a secure VPN or authenticated outbound agent/tunnel for remote sites. Do not expose management ports directly to the public internet.
- Add append-only audit events and operator approval for disruptive configuration changes.

## Not claimed or enabled

- No universal vendor connectivity.
- No Omada API calls.
- No VPN or secure tunnel implementation.
- No SSID, VLAN, captive portal or wireless configuration across vendors.
- No physical-device tests beyond the existing MikroTik adapter.
- No live payment mode changes.
