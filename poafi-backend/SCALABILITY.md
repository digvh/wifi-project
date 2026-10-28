# PoaFi scalability and deployment notes

This repository is prepared for gradual scaling; it is not proof that production load, Redis, durable queues, or multiple instances have been tested.

## Current lightweight preparation

- GET /api/health/live is a liveness check and does not depend on PostgreSQL.
- GET /api/health/ready performs SELECT 1 and returns 503 when PostgreSQL is unavailable.
- GET /api/metrics emits per-process Prometheus text metrics when METRICS_TOKEN is configured. Scrape it only over a private network. Counters reset on restart and are not aggregated across instances.
- PostgreSQL pool size and timeouts are environment-configurable. Calculate the combined maximum connections for all API and worker instances before increasing them.
- API graceful shutdown stops accepting requests and closes Prisma/PostgreSQL connections.
- Voucher cleanup can run in the API for single-instance development, or as a separate process in hosting. Set RUN_VOUCHER_CLEANUP_IN_API=false for API instances and run npm run worker:vouchers as one separately managed worker. Do not run multiple cleanup workers until the job uses a distributed claim/lock; the current in-process guard is not cross-instance coordination.

## Environment variables

Set NODE_ENV=production, a strong JWT_SECRET, the existing CREDENTIAL_ENCRYPTION_KEY, DATABASE_URL, exact comma-separated trusted origins in CORS_ORIGINS, and a separate random METRICS_TOKEN. Do not commit .env or provider credentials. Keep the credential encryption key unchanged if existing database fields were encrypted with it; rotate only with a migration that re-encrypts stored values. Changing JWT_SECRET invalidates current tokens.

Generate secrets locally with Node:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

## Suggested deployment shape for first hosted release

1. One Next.js frontend deployment with HTTPS.
2. One Express API instance and one managed PostgreSQL database with automated backups/PITR where available.
3. Initially run voucher cleanup as one worker process; separate it from API instances using RUN_VOUCHER_CLEANUP_IN_API=false.
4. Use a managed Redis service later for shared rate-limit state and selected cacheable reads. Keep Redis optional for local development.
5. Use a durable queue for retryable SMS, payment follow-up, and router provisioning only after idempotency, retries, dead-letter handling and job monitoring are designed. Do not treat an in-memory queue as durable.
6. Add API instances only after measurements justify them. Use a shared rate-limit store before horizontally scaling. Use a database connection pooler if the hosting/database provider recommends one.
7. Consider read replicas only when measured read load is a bottleneck and the application can tolerate replication lag. Tenant sharding/partitioning is a later decision based on actual database growth and isolation requirements.

## Required before production

- Verify payment webhooks cryptographically using the provider's documented mechanism, validate transaction amount/currency/reference, and remove or strictly gate simulation endpoints.
- Make payment fulfillment and voucher redemption transactionally idempotent under concurrent requests.
- Audit tenant authorization on every endpoint and ensure status polling cannot disclose voucher codes based only on a payment ID.
- Replace placeholder non-MikroTik adapters and the console-only SMS sender with tested integrations or clearly mark them unsupported.
- Add automated tests for auth, cross-tenant access, payment callbacks, duplicate callbacks, voucher redemption, expiry and router failures.
- Run Prisma validation, backend/frontend builds, migration checks and load tests against a disposable staging environment. Do not load-test a live payment system or your small local PC.
- Confirm backups and perform a restore test; set alerts for 5xx rate, latency, database connection saturation, worker failures, payment callback failures and router provisioning failures.

## Local verification

From poafi-backend:
npm ci
npx prisma validate
npm run typecheck
npm run build

These commands have not been run by this change. Test with a disposable/test database and existing local environment before merging or deploying.
