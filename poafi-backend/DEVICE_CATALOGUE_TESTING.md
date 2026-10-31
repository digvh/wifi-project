# PoaFi network device catalogue — local verification

## Requirements
- Node.js 22 LTS (or a compatible version supported by the lockfiles)
- npm
- PostgreSQL for migration/API checks
- VS Code

## 1. Get the feature branch
Open VS Code, choose **Terminal → New Terminal**, then run:

```bash
git clone https://github.com/digvh/wifi-project.git
cd wifi-project
git fetch origin
git checkout feature/network-device-catalogue
```

If you already cloned the repository, run `git fetch origin` and `git checkout feature/network-device-catalogue` inside that folder.

## 2. Configure the backend
In VS Code, open `poafi-backend`. Create a local `.env` file based on the project's existing environment example (do not commit it). Set `DATABASE_URL` to your local PostgreSQL database and set a strong local `JWT_SECRET`. Use test/local credentials only.

```bash
cd poafi-backend
npm ci
npx prisma validate
npx prisma generate
```

Before applying migrations, make a backup if using a database with data you need. The catalogue migration is additive: it creates `NetworkDeviceModel` and seeds sample entries; it should not remove existing tenant/router/package/voucher/payment rows.

```bash
npx prisma migrate deploy
npm run build
npm run dev
```

The API should run at the port configured in your backend `.env`. Check `GET /api/health` first.

## 3. Start the frontend
Open a second VS Code terminal:

```bash
cd poafi-frontend
npm ci
```

Set the frontend API base URL using the existing project environment convention (check the current `.env.example`/API client before adding a variable). Then run:

```bash
npm run dev
```

Open the local Next.js address printed in the terminal and sign in.

## 4. Test the catalogue in the browser
- Open **Device Catalogue** from the dashboard sidebar.
- Confirm the seeded TP-Link entries appear.
- Search by brand/model (for example, `TP-Link` or `EAP610`).
- Filter by category and coverage band; confirm the exact metre value and coverage disclaimer remain visible.
- Open a source link and verify it points to manufacturer documentation.

## 5. Test role permissions
Use a normal authenticated account and a Platform Admin account. In browser DevTools → Network, or a REST client, call the API with each account's own bearer token:

| Request | Normal signed-in user | Platform Admin |
|---|---:|---:|
| GET `/api/device-catalog` | 200 | 200 |
| POST `/api/device-catalog` with valid model body | 403 | 201 |
| PUT `/api/device-catalog/:id` | 403 | 200 |
| DELETE `/api/device-catalog/:id` | 403 | 200 |

Also test no token: catalogue requests should return 401. Use a disposable test record for create/edit/delete and remove it after verification. Do not use real production data.

## 6. Test validation cases
As Platform Admin, test:
- missing brand/model/category → 400
- unsupported category/environment → 400
- negative or non-integer coverage/client/speed values → 400
- invalid source URL or non-http(s) protocol → 400
- duplicate brand + model → 409
- update/delete unknown ID → 404

## 7. CI checks
Pull request #4 runs GitHub Actions checks for Prisma schema validation/client generation/backend TypeScript compilation and the frontend production build. A green workflow is required before considering the feature verified. The migration still needs to be applied against a disposable PostgreSQL test database to verify the complete migration path.

## Safety notes
- Do not enable live payments for this test.
- Never paste JWTs, passwords, database credentials or provider secrets into chat or commit them.
- Catalogue coverage is a manufacturer-stated maximum, not guaranteed real-world Wi-Fi range.
- Catalogue entries do not imply device provisioning/management support.
