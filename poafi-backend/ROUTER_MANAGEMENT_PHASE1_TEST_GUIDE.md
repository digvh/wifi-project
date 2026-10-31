# PoaFi Router Management — Phase 1 Test Guide

This guide tests the router onboarding and management foundation on a local or staging environment. It does not enable live payments and does not create a VPN or remote tunnel.

## What this phase changes

- A successful MikroTik API connection changes the router's connection status to `ONLINE`, but does **not** change setup status to `CONFIGURED`. Reachability is not proof that SSIDs, hotspot, VLANs, captive portal or security policies have been provisioned.
- A failed active-session query is reported as an error. It is no longer returned as an empty session list, because an API failure must not look like zero connected users.
- Other vendor adapters remain explicitly unsupported until their official APIs are implemented and tested against real hardware.

## Safety before testing

1. Use a local development database or a separate staging database. Do not start with production.
2. Back up the database before applying migrations.
3. Use a test MikroTik router or CHR virtual router on a private LAN. Do not expose RouterOS API port 8728 to the public internet.
4. Create a dedicated, least-privilege RouterOS test account. Do not use the router's primary administrator account.
5. Keep credentials in the backend environment/configuration only. Never paste router passwords, encryption keys, JWT secrets or payment secrets into GitHub issues, chat, screenshots or source files.
6. Keep payment provider live mode disabled. These tests do not require payment credentials.

## 1. Prepare the backend

Open a terminal in `poafi-backend`:

```bash
npm ci
```

Check the required environment variables in your local `.env`. In particular, make sure the database connection and credential-encryption key are configured. Do not commit `.env`.

Apply pending migrations to the local/staging database:

```bash
npx prisma migrate deploy
npx prisma generate
```

Compile the backend:

```bash
npm run build
```

Start it:

```bash
npm run dev
```

In another terminal, start the frontend from `poafi-frontend` using the project's documented development command (normally `npm run dev`).

## 2. Sign in as Platform Admin

1. Open the local PoaFi frontend.
2. Sign in with a dedicated test Platform Admin account.
3. Open the Routers page.
4. Select a test Operator/tenant.
5. Choose a device model from the catalogue if a matching model is available.
6. Enter a test device name, private-LAN IP address, RouterOS API port, dedicated username and password.
7. Save the router.

Expected result: the router is saved and appears in the list. The password must never be displayed back in the API response or UI.

## 3. Test a supported MikroTik connection

On a test MikroTik/CHR device, enable the RouterOS API only on the private test network and allow access from the backend host. Confirm that the backend can reach the device IP and port.

In PoaFi, use the router's **Test Connection** action.

Expected success:
- The API responds with device identity and RouterOS information.
- Router connection status becomes `ONLINE`.
- Setup status remains its previous value (normally `PENDING`) until a separate provisioning workflow actually configures and verifies the service.

Expected failure:
- An incorrect password, blocked port or unreachable host returns a clear failure.
- Router status becomes `ERROR` and setup status becomes `NEEDS_ATTENTION`.
- No password or decrypted credential appears in the response.

## 4. Test tenant isolation

1. Create or use two test Operators: Operator A and Operator B.
2. Register a router under Operator A.
3. Sign in as Operator B and open the Routers page.
4. Try to request Operator A's router using its ID through the API.

Expected result: Operator B cannot view, test, edit, disconnect sessions on, or delete Operator A's router. The API should return a forbidden/not-found response according to the route.

## 5. Test unsupported vendor behavior

For a test router record, select TP-Link Omada, Ruijie, Cudy, Comfast or Wavlink only if you are intentionally testing the unsupported path.

Expected result: a connection or provisioning request returns an explicit "not implemented" error. It must not show a successful connection, successful voucher provisioning or an empty active-session list as if the request worked.

Do not use a real production router for this negative test.

## 6. Test active sessions on MikroTik

After the MikroTik API connection works, open the router's sessions view.

Expected result:
- If the API query succeeds and there are no active sessions, PoaFi shows zero sessions.
- If the API query fails (for example, the account lacks permission), PoaFi shows an error. It must not silently show zero sessions.

## 7. Verify database and logs

Check the Router record in the local/staging database:
- `status` reflects the last connection test.
- `setupStatus` is not set to `CONFIGURED` merely because the API is reachable.
- `encryptedPassword` remains encrypted at rest.

Never copy database rows containing credentials into a public issue or support message.

## Not covered yet

This phase does not implement:
- WireGuard, site-to-site VPN, or authenticated outbound reverse tunnel.
- TP-Link Omada Controller OpenAPI authentication and provisioning.
- Ruijie/Reyee, Cudy, Comfast or Wavlink live management APIs.
- Automatic SSID, WPA security, VLAN, captive portal, bandwidth profile or firmware configuration.
- A complete controller/site/access-point inventory model.
- Production audit logging and approval workflow.

These need separate designs and integration tests. A router behind NAT/firewalls should be managed over a private VPN or authenticated outbound tunnel; do not publish its management API directly to the internet.
