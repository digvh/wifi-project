# PoaFi Vendor Integration — Account Handover

Repository: https://github.com/digvh/wifi-project

## Start from this branch

`feature/vendor-neutral-device-integration-foundation`

Current intended base: `feature/secure-router-management-phase1`

Draft PR: https://github.com/digvh/wifi-project/pull/6

Do not start from `main`, do not overwrite another branch, and do not merge PR #5 or PR #6 without reviewing their dependency order and CI first.

## Audit result

The code is not yet a universal multi-vendor router/device platform.

- MikroTik RouterOS is the only implemented live adapter in the current code.
- TP-Link Omada, Ruijie/Reyee, Cudy, Comfast and Wavlink are inventory/catalogue entries only; no live driver exists for them.
- The Omada Software Controller being installed on a host computer is not a hardware simulator. With no physical Omada devices adopted, only controller/UI and supported API authentication/discovery work can be explored; actual AP/gateway provisioning and client sessions cannot be validated.
- The current Router record describes a gateway/router/controller endpoint. It is not a full instance model for APs, switches, wireless CPE, mesh nodes and extenders.
- DIRECT, VPN, SECURE_TUNNEL and CLOUD_CONTROLLER are currently connection-path metadata. No VPN/tunnel agent exists.
- Do not claim SSID, VLAN, captive portal, hotspot, or Wi-Fi configuration is supported across vendors.

## Work on the foundation branch

- Added a vendor integration registry and runtime adapter factory.
- Added authenticated `GET /api/routers/integration-capabilities` that returns driver availability and capabilities.
- Added validation for vendor/model brand compatibility and Router/Gateway/Controller categories in the current router registration path.
- Prevented general router edit requests from setting ONLINE/ERROR or CONFIGURED status; changed endpoints invalidate previous connection state.
- UI now shows catalogue vendors separately from live driver availability and disables Test Connection/Sessions for vendors without a driver.
- Enforced tenant ownership when assigning a router to a package.
- Voucher redemption now uses the package-selected router, atomically claims a voucher before provisioning, and releases the claim if the request catches an error.
- Expiry cleanup now selects the router assigned to a package instead of an arbitrary online router.
- Added registry unit tests and CI execution.
- Added detailed audit at `poafi-backend/VENDOR_INTEGRATION_AUDIT.md`.

## Important remaining limitations / follow-up

1. Finish CI after latest frontend typing correction. The first run passed backend Prisma validation, integration tests and TypeScript compilation but failed frontend build on a brand-array type; the fix is committed. Confirm the newest run is green before merge.
2. A process crash after a voucher enters REDEEMING can leave it in that state. Add a timestamp/lease and safe stale-claim recovery, plus compensation/reconciliation for the case where router provisioning succeeds but DB activation fails.
3. Implement a separate controller integration entity/model. Omada credentials (Client ID/Secret), controller URL, authentication mode/token lifecycle, controller identity, site mapping and tenant mapping do not belong in a plain router device record. Store secrets encrypted server-side only.
4. Integrate Omada OpenAPI using the installed controller's official API docs/version; first perform read-only auth, list sites, adopted devices and clients. Then test writes only when an actual compatible Omada router/AP exists.
5. Add proper managed-device inventory: Controller, Gateway, Router, AP, Switch, CPE, Mesh node and relationships such as controller/site/device.
6. Add vendor drivers one at a time against exact hardware models and firmware. A brand name does not imply API compatibility. Prioritize based on actual hardware and documented APIs.
7. Design secure remote management for devices behind NAT: private VPN or authenticated outbound tunnel/agent. Do not expose device management ports to the public internet. Review SSRF/egress controls for user-supplied host/IP fields.
8. Add full integration tests for multi-tenant isolation, voucher concurrency/recovery, controller tenant/site boundaries, and physical device provisioning.
9. No payment live mode changes were made. Keep live payments disabled for these network integration tests.

## Credentials and safety

Never commit `.env`, controller Client Secrets, device passwords, JWT secrets or encryption keys. Never send secrets into chat or GitHub issues. Keep integration secrets in backend-only encrypted configuration. Begin with read-only controller permissions. Use a staging database and dedicated test devices/accounts.

## Current support matrix

| Platform | Connection test | Voucher provisioning | Active sessions | State |
|---|---:|---:|---:|---|
| MikroTik RouterOS | Yes | Yes | Yes | Implemented adapter; requires device test |
| TP-Link Omada | No | No | No | Planned; no hardware test |
| Ruijie/Reyee | No | No | No | Planned |
| Cudy | No | No | No | Planned |
| Comfast | No | No | No | Planned |
| Wavlink | No | No | No | Planned |

This is a foundation for extensibility, not a claim of universal connectivity.
