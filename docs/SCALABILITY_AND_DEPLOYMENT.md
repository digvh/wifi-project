# Poafi scalability and deployment plan

This plan is designed for the current Express + TypeScript + Prisma + PostgreSQL API and Next.js frontend. Local development does not require Docker, Redis, replicas, or a load balancer.

## Target architecture

### First production deployment
- Next.js frontend deployed to a Node-capable host or compatible frontend platform.
- One Express API instance.
- Managed PostgreSQL with automated backups, TLS, and restricted network access.
- HTTPS at the hosting edge/reverse proxy.
- Secrets configured in the host's secret manager/environment settings, never committed to Git.
- Health endpoints: `/api/health/live` and `/api/health/ready`.

### Later, when metrics justify it
- Multiple stateless API instances behind a load balancer.
- Managed Redis for shared cache and distributed rate-limit state.
- A dedicated worker process for voucher expiry and other background jobs.
- A durable job queue (for example, BullMQ + Redis) only after selecting retry/idempotency rules.
- PostgreSQL read replicas only when read pressure remains a measured bottleneck after query/index optimization.
- Sharding only when one well-sized PostgreSQL deployment is demonstrably insufficient and simpler options have been exhausted.

## Important current-code considerations

1. **Tenant isolation:** every tenant-owned read and write must constrain by the authenticated tenant ID on the server. Do not trust a tenant ID supplied by the browser.
2. **Background cron:** the voucher cleanup job currently starts inside the API server. Do not run it in every API instance. Set `RUN_VOUCHER_CLEANUP=false` on API instances and run the dedicated worker entry point once, or use a scheduler/leader lock before horizontal scaling.
3. **Rate limiting:** the current in-process limiter is not a shared counter across instances. Before running multiple API instances, configure a shared rate-limit store (Redis or a hosting/platform gateway) and test it.
4. **Caching:** cache only appropriate read-heavy data. Include tenant ID and relevant permissions/context in cache keys; invalidate on writes. Do not use cached data as the authority for payment completion, voucher redemption, or access-control decisions.
5. **PostgreSQL connections:** `DATABASE_POOL_MAX` applies per process. Estimate total possible connections as API instances × pool maximum, plus worker processes and administrative connections. Stay below the database plan's connection limit; use a pooler if appropriate.
6. **Read replicas:** replicas can lag. Read fresh payment state, voucher redemption state, and other consistency-sensitive results from the primary.
7. **Backups:** configure automated backups and periodically test restoring them to a separate database. A backup that has never been restored is unverified.
8. **Secrets:** generate a unique high-entropy JWT secret and a 32-byte credential-encryption key for each environment. Do not use the example placeholders. Do not put secrets in frontend `NEXT_PUBLIC_*` variables.

## Environment variables

Backend:
- `DATABASE_URL`: PostgreSQL connection string, preferably TLS-enabled in production.
- `JWT_SECRET`: long random secret unique to the environment.
- `CREDENTIAL_ENCRYPTION_KEY`: exactly 32 characters/bytes as required by the current crypto implementation; generate and store securely.
- `CORS_ORIGINS`: comma-separated list of exact trusted frontend origins, with no trailing slash.
- `DATABASE_POOL_MAX`: maximum PostgreSQL connections per process.
- `DATABASE_CONNECTION_TIMEOUT_MS`: connection timeout.
- `RUN_VOUCHER_CLEANUP`: enable the in-process cleanup scheduler only for a single worker process; disable on horizontally scaled API instances.

Frontend:
- `NEXT_PUBLIC_API_URL`: public API base URL ending in `/api`, e.g. `https://api.example.com/api`.

## Suggested rollout

### Phase 0 — now, while testing
- Keep one API and one PostgreSQL database.
- Keep local development without Docker.
- Add production configuration examples, health checks, CI build checks, and deployment documentation.
- Review tenant authorization on every route and test cross-tenant access denial.
- Add structured logging and error monitoring without logging passwords, tokens, payment secrets, or voucher plaintext.
- Measure p50/p95/p99 API latency, error rate, query duration, database connections, CPU, memory, and job duration.

### Phase 1 — first hosting
- Deploy API and frontend over HTTPS.
- Use managed PostgreSQL, automated backups, least-privilege DB credentials, and restricted network access.
- Set production secrets in the host's environment/secret manager.
- Set `CORS_ORIGINS` to the exact production frontend origin.
- Keep one voucher cleanup worker. Do not start it in every API replica.
- Configure uptime/health checks and alerts.

### Phase 2 — proven load growth
- Fix slow SQL and missing indexes first; paginate every potentially large list.
- Add Redis only for measured cacheable workloads and shared rate limiting.
- Move slow work to a durable queue and run dedicated workers.
- Add API instances when CPU/memory or throughput is the bottleneck and confirm the database can handle the resulting connection/query load.

### Phase 3 — database pressure
- Add read replicas only if read traffic is the measured bottleneck and stale reads are acceptable for the endpoints routed to replicas.
- Consider partitioning for specific large tables only with evidence and a maintenance plan.
- Consider sharding last; document shard-key choice, migrations, cross-shard queries, reporting, backup/restore, and tenant moves before implementation.

## Release checklist

- [ ] Build passes for backend and frontend in CI.
- [ ] Production environment variables are set; placeholders are rejected/removed.
- [ ] HTTPS and exact CORS origins are configured.
- [ ] PostgreSQL backup and restore procedure tested.
- [ ] Tenant isolation tests cover list, detail, create, update, and delete routes.
- [ ] API and readiness health checks are monitored.
- [ ] Connection budget accounts for all API and worker instances.
- [ ] Exactly one cleanup worker is running until a distributed lock/queue design is in place.
- [ ] Load test results and rollback steps are recorded before scaling infrastructure.
