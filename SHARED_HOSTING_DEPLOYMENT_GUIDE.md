# PoaFi Shared Hosting Deployment Guide (cPanel / DirectAdmin / LiteSpeed)

PoaFi is configured to run on **Shared Hosting** (such as cPanel with **Setup Node.js App / Phusion Passenger**) without requiring an expensive VPS or a WireGuard VPN server.

---

## Why PoaFi Works on Shared Hosting (No VPS Needed)

1. **Static Frontend Export (`poafi-frontend/out`)**:
   - Next.js is configured with `output: "export"`, compiling the entire UI into lightweight static HTML/CSS/JS files with an Apache/LiteSpeed `.htaccess` router.
   - Zero Node.js RAM is wasted on Next.js SSR processes.
2. **Single cPanel Node.js App Entry Point (`poafi-backend/app.js`)**:
   - Compatible with cPanel's **Setup Node.js App** (Phusion Passenger).
   - Can serve **both** the `/api/*` backend and the static frontend from a single Node.js application, or run on `api.yourdomain.co.tz` while `public_html` serves the static frontend.
3. **cPanel Cron Job Support (`/api/internal/cron/run`)**:
   - Shared hosts put idle Node.js processes to sleep. Setting `BACKGROUND_JOBS=false` delegates voucher expiry, orphan recovery, and payment provisioning retries to a standard **cPanel Cron Job**.
4. **Pure Node.js / Zero-WASM Database Setup (`prisma/poafi-schema.sql` & `npm run db:init`)**:
   - Prisma CLI (`prisma migrate`) often crashes on CloudLinux shared hosting due to WebAssembly LVE memory limits.
   - You can either import `poafi-backend/prisma/poafi-schema.sql` directly in **cPanel → phpPgAdmin**, or run `npm run db:init` (which uses pure `pg` with ~30 MB RAM).
5. **Outbound HTTPS Cloud Sync for MikroTik Routers (`/api/enroll/sync/:routerId`)**:
   - Shared hosts do not allow running a WireGuard VPN server (`UDP 51820`) and often block outbound `TCP 8728`.
   - When `WG_SERVER_ENDPOINT` is left blank, PoaFi's 1-line MikroTik Quick Setup installs a 15-second MikroTik scheduler (`poafi-cloud-sync`) that polls your shared host over **standard HTTPS (port 443)** to sync vouchers, bandwidth profiles, heartbeats, and session disconnects—even when the router is behind a 4G SIM card or ISP NAT!

---

## Step 1: Build the Project Locally

Before uploading to your shared host, build the production files on your computer:

```powershell
node build-shared-host.js
```

This creates:
- `poafi-backend/dist/` — Compiled backend JavaScript
- `poafi-frontend/out/` — Static frontend files + `.htaccess`
- `poafi-backend/public/` — Copy of the static frontend bundled inside the backend

---

## Step 2: Set Up PostgreSQL Database

You have two options for PostgreSQL on shared hosting:

### Option A: cPanel Built-in PostgreSQL
1. In cPanel, open **PostgreSQL Databases**.
2. Create a database (e.g. `cpaneluser_poafi`) and a user with password, then add the user to the database.
3. Open **phpPgAdmin** in cPanel, select your database, and import `poafi-backend/prisma/poafi-schema.sql` (or run `npm run db:init` in Step 4).

### Option B: Free External Cloud PostgreSQL (if your shared host only has MySQL)
If your shared hosting plan only includes MySQL, create a free PostgreSQL database on **Neon.tech**, **Supabase**, or **Aiven**:
1. Copy the PostgreSQL connection string (`postgresql://user:pass@host/dbname?sslmode=require`).
2. Set `DATABASE_URL` and `DB_SSL=true` in `poafi-backend/.env`.

---

## Step 3: Choose Your Shared Hosting Layout

### Layout 1: Single Domain (`https://yourdomain.co.tz`) — Easiest
One cPanel Node.js App serves both the website and `/api/*`:
1. Upload the `poafi-backend` folder to `/home/cpaneluser/poafi-backend` (exclude `node_modules`).
2. In cPanel → **Setup Node.js App** → **Create Application**:
   - **Node.js version**: `20.x` (or `18.x` / `22.x`)
   - **Application mode**: `Production`
   - **Application root**: `poafi-backend`
   - **Application URL**: `yourdomain.co.tz`
   - **Application startup file**: `app.js`
3. Alternatively, you can also copy the contents of `poafi-frontend/out/` into `public_html/` so Apache/LiteSpeed serves static assets directly.

### Layout 2: Main Domain + API Subdomain (`yourdomain.co.tz` + `api.yourdomain.co.tz`)
1. If using a separate API subdomain, set `NEXT_PUBLIC_API_URL=https://api.yourdomain.co.tz/api` in `poafi-frontend/.env.production` before running `node build-shared-host.js`.
2. Upload the contents of `poafi-frontend/out/` (including `.htaccess`) to `public_html/`.
3. In cPanel → **Setup Node.js App**, point **Application URL** to `api.yourdomain.co.tz`, **Application root** to `poafi-backend`, and **Application startup file** to `app.js`.

---

## Step 4: Configure Environment Variables (`poafi-backend/.env`)

Create `.env` inside `poafi-backend/` (or enter these in cPanel's Node.js App environment variables):

```env
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://DB_USER:DB_PASS@localhost:5432/DB_NAME?schema=public"
JWT_SECRET="GENERATE_64_BYTE_HEX_SECRET"
CREDENTIAL_ENCRYPTION_KEY="EXACTLY_32_CHARACTERS_SECRET_KEY"

ALLOW_PAYMENT_SIMULATION=false

# If using Single Domain:
PUBLIC_APP_URL="https://yourdomain.co.tz"
PUBLIC_API_URL="https://yourdomain.co.tz"
CORS_ORIGIN="https://yourdomain.co.tz"

# Shared Hosting Settings:
TRUST_PROXY=1
BACKGROUND_JOBS=false
CRON_SECRET="GENERATE_MIN_32_CHARS_RANDOM_CRON_SECRET"
DB_POOL_MAX=5
DB_SSL=false
COOKIE_SAME_SITE=lax

# Leave WireGuard blank on Shared Hosting (uses HTTPS Cloud Sync automatically):
WG_SERVER_ENDPOINT=""
WG_SERVER_PUBLIC_KEY=""
```

Then in cPanel's Node.js App page:
1. Click **Run NPM Install**.
2. Open the cPanel Terminal (or Run JS Script) and initialize the database tables + default admin account:
   ```bash
   npm run db:init
   ```
3. Click **Restart** on the Node.js App.

---

## Step 5: Add the cPanel Cron Job

In cPanel → **Cron Jobs**, add a cron job running **Once Per Minute (`* * * * *`)**:

```bash
curl -fsS -H "X-Cron-Secret: YOUR_CRON_SECRET" https://yourdomain.co.tz/api/internal/cron/run > /dev/null
```

This keeps expired vouchers cleaned up, releases stuck voucher redemptions, and retries any deferred payment provisions automatically.
