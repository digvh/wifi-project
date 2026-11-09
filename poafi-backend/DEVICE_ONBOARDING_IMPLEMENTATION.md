# PoaFi Physical Device Onboarding

## Implemented in this change

- A physical Router can optionally reference a global `NetworkDeviceModel` catalogue entry through `deviceModelId`.
- Deleting a catalogue model leaves the installed Router record intact and clears its optional model reference.
- Router records now include optional installation site, installation address, connection mode, setup status, and installation notes.
- The Super Admin Router page can select an Operator, choose a catalogue model, record installation details, register a physical device, test supported connections, and edit the saved connection details.
- The Operator still sees only routers belonging to their tenant; the existing backend tenant filter remains in place.
- The Super Admin Operators page lists each Operator's login accounts and can delete an individual login without deleting the Operator tenant or its business records.
- The account deletion endpoint is restricted to Platform Admin because the entire tenant-management router is protected by `requireAuth, requirePlatformAdmin`. Platform Admin accounts are rejected by the endpoint.
- Unfinished TP-Link Omada, Ruijie/Reyee, Cudy, Comfast and Wavlink adapters no longer return fake successful connection/provisioning results. They now report that the operation is not implemented. MikroTik retains its real RouterOS API implementation.

## Database migration

Run from `poafi-backend` against a staging database first:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

Migration: `20261031180000_link_routers_to_device_catalogue`.

## Important limitations — not yet production-complete

1. The connection mode field records the intended path (direct, VPN, secure tunnel, or cloud controller). It does not create a VPN or tunnel. Remote sites behind NAT/firewalls still need a secure, reachable management path, preferably a private VPN or authenticated outbound tunnel. Do not expose router management ports directly to the public internet.
2. The current Router model represents a manageable gateway/controller endpoint. An access point may be part of an Omada/Ruijie/Ubiquiti controller-managed site rather than an independently reachable router. The data model and adapters will need controller/site support for those environments.
3. Only MikroTik has a live adapter in the current code. Other listed brands can be recorded but cannot yet be truthfully marked connected or configured by PoaFi.
4. Router registration and connection testing are not the same as full device configuration. A separate, vendor-specific provisioning workflow is still needed for SSIDs, security, VLANs, captive portal, bandwidth policies and firmware-specific options.
5. The new migration and code have not been run against the user's database or local build environment in this change. Run the commands above on staging and review the CI result before deploying.
6. Deleting an Operator login removes that account only. The Operator tenant and its routers/packages/vouchers/payments remain. Deleting the entire Operator is a separate destructive action already present in the dashboard.

## Recommended next engineering phases

- Implement and test a secure remote-access agent/VPN onboarding path.
- Add controller/site entities for controller-managed AP ecosystems.
- Implement each vendor adapter against official APIs and real test hardware.
- Add an append-only audit log for registration, credential changes, connection tests and configuration actions.
- Add integration tests for tenant isolation, Platform Admin onboarding, and safe account deletion.
