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


## Operator-first RADIUS onboarding (new phase)

A common integration route has now been added so an Operator can select a vendor/model and register a RADIUS-capable hotspot gateway/controller without waiting for a native vendor API driver.

Branch: `feature/operator-radius-hotspot-onboarding`

### Added
- Operator navigation page: `/network-setup`.
- Vendor/model capture for MikroTik, TP-Link Omada, Ruijie/Reyee, Ubiquiti/UniFi, Grandstream, Cudy, Comfast, Wavlink and generic RADIUS equipment.
- Tenant-scoped RADIUS NAS registry with random per-device shared secrets encrypted at rest; the secret is shown only at creation/rotation.
- FreeRADIUS 3 container under `poafi-radius/`, using dynamic client discovery through the private PoaFi backend API.
- RADIUS PAP voucher authorization and accounting Start/Interim-Update/Stop endpoint handlers.
- Access-Accept includes Session-Timeout and WISPr upload/download bandwidth attributes (bits per second), plus Filter-Id for NAS products that use local profile mappings.
- RADIUS vouchers are left UNUSED after payment/batch generation and start their countdown only on the first successful NAS authentication.
- Payment portal now distinguishes a RADIUS voucher that still needs to be entered on the Wi-Fi login page from a native adapter connection.

### Deploy (staging only)
1. Set `RADIUS_ENABLED=true`, `RADIUS_SERVER_HOST`, and a private random `RADIUS_REST_SHARED_SECRET` of at least 32 characters in backend env.
2. Set the same REST bridge secret and private backend URL in `poafi-radius/.env` (start from `.env.radius.example`).
3. Build and start `docker compose --env-file .env -f compose.yml up --build -d` from `poafi-radius/`.
4. Expose UDP 1812 (authentication) and 1813 (accounting) only to intended NAS devices. Prefer a private VPN; RADIUS over ordinary UDP is not transport encryption.
5. Migrate and generate Prisma client in backend, then open `/network-setup` and register the static IPv4 source address seen by the RADIUS server.
6. Configure the device's built-in captive portal to use RADIUS PAP and accounting Start/Interim-Update/Stop. Use the one-time secret displayed by PoaFi.
7. Create a test package and disposable voucher. Login through the device's own hotspot page and verify the voucher becomes ACTIVE and accounting updates appear.

### Critical compatibility boundaries
- This is a generic RADIUS path only for device models/firmware that support external RADIUS PAP captive-portal authentication and accounting.
- It does not install or configure SSIDs, VLANs, radio settings, captive portal redirects, device controller adoption, or remote VPN tunnels.
- WISPr bandwidth attributes are standard but not universal. If a NAS does not enforce them, the Operator must map PoaFi's Filter-Id to a local bandwidth profile. Exact support must be checked against the model and firmware.
- Session-Timeout requires the NAS to enforce its received value. RADIUS CoA/Disconnect-Message is not implemented in this phase.
- RADIUS client registry v1 requires a fixed IPv4 source address visible to the RADIUS server. Multiple devices behind one NAT IP share one NAS identity in this version; do not register the same address to different Operators.
- RADIUS PAP is not 802.1X/EAP. No CHAP/MS-CHAP/EAP support is claimed.
- The current code and service have not been physically tested against any vendor's hardware. Treat PR/CI success as software validation only, not proof of hardware compatibility.
- Live payments remain disabled.

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
