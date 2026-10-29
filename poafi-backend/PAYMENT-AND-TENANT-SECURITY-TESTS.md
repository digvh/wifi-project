# Payment security and tenant-isolation test plan

Run only against a disposable local/test database with synthetic tenants, users, packages, vouchers, and payments. Never use real customer or payment-provider data.

## Safety changes currently on this branch

- Payment simulation endpoint now requires a valid authenticated PLATFORM_ADMIN token and returns 404 in production.
- Payment webhooks fail closed because official AzamPay signature verification is not implemented yet. This intentionally blocks webhook-based fulfillment until the documented provider verification scheme is implemented and tested.
- These changes have not yet been verified by a local build or automated test run.

## Tenant isolation test fixtures

Create two active tenants (Tenant A and Tenant B), one TENANT_OWNER user for each tenant, and at least one router, package, voucher, payment and payment configuration per tenant. Also create a PLATFORM_ADMIN user. Keep the IDs and tokens in local shell variables; do not commit them.

## Expected authorization results

| Test | Tenant A token | Tenant B token | Platform admin |
|---|---|---|---|
| GET /api/routers | only A routers | only B routers | admin-scoped result |
| GET /api/packages | only A packages | only B packages | admin-scoped result |
| GET /api/vouchers | only A vouchers | only B vouchers | admin-scoped result |
| GET /api/payments | only A payments | only B payments | admin-scoped result |
| POST /api/vouchers/generate using B package ID | must not create | must not create for A | follow intended admin policy |
| POST /api/payments/config with B tenant ID | 403 | allowed for B | allowed |
| Access tenant administration endpoints | 403 | 403 | allowed |
| Access protected endpoint without token | 401 | 401 | 401 |

Use two different tenants for every cross-tenant test. Verify both response contents and database state; a 404/403 response alone is insufficient if a mutation happened before the response.

## Payment security tests

1. POST /api/payments/:id/simulate-confirm without a token: expect 401.
2. Repeat with a TENANT_OWNER token: expect 403.
3. Repeat with PLATFORM_ADMIN in development/test only: simulation may work for a disposable pending payment.
4. In NODE_ENV=production, simulation must return 404 even with PLATFORM_ADMIN token.
5. POST /api/payments/webhook with a fake SUCCESS body and no signature: expect rejection and no payment/voucher state change.
6. Repeat with a fake signature: expect rejection and no payment/voucher state change until official signature verification is implemented.
7. GET /api/payments/:id/status with an unknown/random ID: expect 404.
8. Verify status polling does not reveal voucher codes to a caller who has no proof of possession/authorization. Current implementation still returns voucher codes to anyone who knows a payment ID and needs a separate fix before production.

## Additional high-priority gaps to resolve

- Payment fulfillment is not concurrency-safe yet: voucher creation and payment SUCCESS update are separate operations. Implement a database transaction/conditional claim and test duplicate simultaneous callbacks before enabling webhooks.
- Validate provider transaction ID, amount, currency, tenant, and reference against the pending payment after authenticating the callback.
- Add a payment-status capability token (store only its hash) or another safe customer proof before returning voucher codes from public polling. Do not rely solely on a payment UUID.
- Ensure every tenant-owned resource lookup checks both resource ID and tenantId in the same query/authorization path. Audit router update/delete, package update/delete, stats, voucher batches, payment configuration, and any status or portal routes.
- Add automated tests with a test framework (e.g. Vitest/Jest + Supertest) and a dedicated test database before considering the checks complete.

## Verification commands

From poafi-backend:
```bash
npm run typecheck
npm run build
```

These are compile checks only. Execute the scenarios above against a disposable test database and record actual HTTP status codes and database effects before marking security tests passed.
