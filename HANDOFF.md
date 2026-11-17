# PoaFi Handoff: remaining work and how to finish it

Written for a less powerful model (or a new session). Read "Rules" first, then take ONE task at a time.

## Current state (verified 2026-11-17)
- Backend `poafi-backend` (Express + TS + Prisma 7 + PostgreSQL) and frontend `poafi-frontend` (Next.js 16): both pass `tsc --noEmit`.
- Unit tests (`npm test` + `integrationRegistry.test.ts`): 11/11 pass.
- Completed & verified:
  - Operator registration with own password, admin approval, operator self-delete, admin delete operator (with immediate JWT invalidation — Task 20).
  - Admin operator dropdowns across Routers, Packages, and Device Setup.
  - Physical-handover request flow with S/N, MAC, linked router, "Register this device" 2-click prefill/linking (Tasks 4, 5), and operator status banners on Dashboard + Device Setup (Task 7).
  - MikroTik Quick Setup auto-enrollment (token, phone-home, auto-fill, confirm).
  - TP-Link Omada SDN adapter (`TPLinkOmadaAdapter` + registered in `RouterAdapterFactory`) and `POST /api/routers/discover/omada` auto-fill in Routers page (Task 9 — unit tested with mock controller; still test against your real OC200/OC300/Software Controller).
  - Payment router provisioning retry/recovery job (Task 15), HMAC-SHA256 webhook signature verification failing closed when unconfigured (Task 18), Beem Africa SMS / Payout OTP integration failing closed in prod (Task 17).
  - CORS origins via `CORS_ORIGIN` / `PUBLIC_APP_URL` env (Task 19), login rate-limiting already active (Task 21).
  - Dashboard monthly revenue + per-site online router summary (Task 24), Cudy/Comfast/Wavlink clearly labeled `RADIUS / AP only` (Task 12).
  - FreeRADIUS Docker Compose + `rlm_rest` config & guide in `freeradius/` (Task 13).
- NOT committed to git yet. Commit before starting hardware tests or branch merges.

## Rules (do not break these)
1. Never run `prisma migrate`. Change DB with a temporary `.js` script using `pg` `Pool` and `ALTER TABLE ... IF NOT EXISTS`, delete the script after, then `node ./node_modules/prisma/build/index.js generate`.
2. PowerShell: use `;` not `&&`. No `npx`. Use `node ./node_modules/typescript/bin/tsc --noEmit` and `node ./node_modules/tsx/dist/cli.mjs src/server.ts`. Never use inline `node -e` (quoting breaks); write a file.
3. Express handlers must be `res.status(x).json(...); return;` (tsconfig `noImplicitReturns`).
4. Newer Prisma models/fields may be missing from types: use `(prisma as any)` or `as any` casts.
5. Never return `encryptedPassword`, `wgPrivateKey`, `passwordHash` in API responses.
6. Frontend calls go through `apiFetch` from `@/lib/api`. UI text is bilingual Swahili / English. Money is TZS.
7. Free port 4000 before restarting the backend (`Get-NetTCPConnection -LocalPort 4000`, then `Stop-Process`).
8. After every task: backend tsc, frontend tsc, then an end-to-end test with a temporary script. Delete the script.

## Remaining work, by priority

### P0: Needs the owner (no code can replace these)
| # | Task | Why |
|---|------|-----|
| 1 | Set `PUBLIC_API_URL` in `poafi-backend/.env` (public HTTPS URL), plus `WG_SERVER_ENDPOINT`, `WG_SERVER_PUBLIC_KEY`, `WG_SERVER_IP` | The router script cannot phone home without them |
| 2 | Test Quick Setup on one real MikroTik (RouterOS 7) | Only simulated so far. Router-side script syntax is untested on hardware |
| 3 | Rotate secrets: DB password, `CREDENTIAL_ENCRYPTION_KEY`, `JWT_SECRET`, admin password | They were pasted into chat/logs. Changing the encryption key requires re-encrypting stored router passwords |

### P1: Finish what is half-built
| # | Task | Files | Done when |
|---|------|-------|-----------|
| 4 | Show serial, MAC, courier note on device-setup request cards | `poafi-frontend/src/app/(dashboard)/device-setup/page.tsx` | Admin sees serial/MAC on each card |
| 5 | "Register this device" button on a request: opens Routers page with operator pre-selected and name/vendor prefilled; on router create, link `routerId` back to the request and set status CONFIGURED | `device-setup/page.tsx`, `routers/page.tsx`, `routes/deviceSetup.ts` | Admin goes request → router in 2 clicks, no retyping |
| 6 | Automate adding the WireGuard peer on the PoaFi server (today the admin pastes it by hand) | `services/network/WireGuardService.ts`, new admin-only route | Confirm returns connection.ok=true without manual server step. Run `wg set` via a small root helper, never from the web process directly |
| 7 | Operator notification when status changes (email/SMS or in-app banner) | `routes/deviceSetup.ts`, dashboard | Operator sees "Your router was shipped" |
| 8 | Clean DB/schema drift: `DeviceSetupRequest` had legacy columns (`setupMode`, `supportMethod`, `modelName`, `siteName`, ...). Decide to drop them or map them | DB + `schema.prisma` | Schema file matches `information_schema` exactly |

### P2: More router brands (one brand per task)
Only MikroTik works. The other adapters in `services/network/adapters/` throw "not implemented". Register each in `RouterAdapterFactory.ts` only after it works on real hardware or a real controller.
| # | Brand | Approach | Done when |
|---|-------|----------|-----------|
| 9 | TP-Link Omada | Omada Controller Open API: auth token, list sites/devices, hotspot/voucher. Add "discover from controller" button that fills the router form | `testConnection` works against a real controller |
| 10 | Ubiquiti UniFi | Missing from `integrationRegistry.ts` and has no adapter file (the Routers dropdown already lists it). Add registry entry and adapter (UniFi Network API) | Same |
| 11 | Ruijie / Reyee | Ruijie Cloud Open API | Same |
| 12 | Cudy, Comfast, Wavlink | Most have no usable API. Support them as access points behind a MikroTik/Omada gateway or via RADIUS only. Do not claim live integration | UI labels them "RADIUS / AP only" |

### P3: RADIUS (partially built)
- Exists: `routes/radius.ts` (`/authorize`, `/accounting`, client CRUD, secret rotation, sessions).
- Missing: an actual FreeRADIUS server (rlm_rest pointing at `/api/radius/*`), `RADIUS_ENABLED=true`, `RADIUS_REST_SHARED_SECRET`.
- Task 13: write a Docker/compose or install guide for FreeRADIUS + rlm_rest. Task 14: test with `radtest` and a real hotspot login.

### P4: Money safety (must finish before live payments)
| # | Task | Notes |
|---|------|-------|
| 15 | Payment success and router provisioning can become inconsistent | Add a retry/recovery job: paid but not provisioned → retry until success, log failures. File: `routes/payments.ts`, `services/payment/PaymentService.ts` |
| 16 | Keep `ALLOW_PAYMENT_SIMULATION=false` in production; test AzamPay in sandbox then live | `.env` |
| 17 | Verify payout OTP is real (SMS), not a stub | `routes/payouts.ts`. Not verified |
| 18 | Verify webhook signature checks on every payment callback | `routes/payments.ts`. Not verified |

### P5: Security and quality
| # | Task |
|---|------|
| 19 | CORS origins are hard-coded to localhost in `server.ts`; read from env for production |
| 20 | After operator self-delete or admin delete, the old JWT stays valid until it expires (7 days). Make `requireAuth` confirm the user still exists, or keep a revocation list. Not verified, test it |
| 21 | Rate-limit `/api/auth/login`. Not verified |
| 22 | Add automated tests: enrollment (wrong/reused/expired token), tenant cascade delete, operator isolation (A cannot read B). Only `integrationRegistry.test.ts` exists |
| 23 | Remove `as any` Prisma workarounds if the adapter typing issue is fixed |

### P6: Operator dashboard and go-live
| # | Task |
|---|------|
| 24 | Check dashboard shows: revenue today/month, active customers, payments, router status, per site. Fill gaps in `routes/stats.ts` and `dashboard/page.tsx` |
| 25 | Deployment: host, HTTPS, PostgreSQL backups, process manager, WireGuard server, env files, domain for `PUBLIC_API_URL` |
| 26 | Git: commit, then reconcile with the GitHub branch `feature/operator-admin-device-setup-workflow` / `feature/vendor-neutral-device-integration-foundation` before merging. Never overwrite remote work blindly |

## Suggested order
`0 commit` → P0 (owner) → 4, 5 → 6 → 15, 18, 20 (money and auth safety) → 24 → 9 (Omada) → 13, 14 (RADIUS) → 10, 11 → 22, 25, 26.

## How to work with a smaller model
- Give it ONE numbered task plus the "Rules" section. Never "finish everything".
- Ask it to read the listed files first and state its plan before editing.
- Acceptance check every task: both `tsc` pass, plus a temporary end-to-end script that prints pass/fail. Reject "done" without that output.
- Keep edits small (one file or one endpoint at a time). For large UI files, add a section; do not rewrite the file.
- Hard tasks (6 WireGuard automation, 15 payment recovery, 20 token revocation, 9 Omada) are worth switching back to the stronger model.
- Safe for a smaller model: 4, 5, 7, 19, 21, 24, 22, and the docs in 13.
