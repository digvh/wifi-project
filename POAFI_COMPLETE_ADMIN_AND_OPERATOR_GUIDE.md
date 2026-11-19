# PoaFi Complete Admin & Operator Handbook (Beginner to Pro Guide)

Welcome to **PoaFi** — the Multi-Tenant Wi-Fi Hotspot Billing, Voucher & Network Management Platform.
This guide is written in simple, step-by-step language so a **new Super Admin** can run the entire platform, help **Wi-Fi Operators** configure any router brand, and understand every feature in the system.

---

## Table of Contents
1. [Understanding the Three Roles in PoaFi](#1-understanding-the-three-roles-in-poafi)
2. [The Two Ways to Configure & Authenticate Devices (Native API/Cloud Sync vs. RADIUS)](#2-the-two-ways-to-configure--authenticate-devices-native-apicloud-sync-vs-radius)
3. [The Two Onboarding Workflows (Self-Setup vs. Physical Handover to Admin)](#3-the-two-onboarding-workflows-self-setup-vs-physical-handover-to-admin)
4. [Step-by-Step Router Setup Guide for ALL Brands](#4-step-by-step-router-setup-guide-for-all-brands)
   - [4.1 MikroTik (RouterOS v7 & v6)](#41-mikrotik-routeros-v7--v6--full-auto-setup)
   - [4.2 TP-Link Omada (OC200 / OC300 / Software Controller & EAPs)](#42-tp-link-omada-oc200--oc300--software-controller)
   - [4.3 Cudy, Comfast & Wavlink (Access Point / RADIUS Mode)](#43-cudy-comfast--wavlink-access-point--radius-mode)
   - [4.4 Ubiquiti UniFi & Ruijie / Reyee](#44-ubiquiti-unifi--ruijie--reyee)
5. [Complete Feature-by-Feature Guide (Admin vs. Operator)](#5-complete-feature-by-feature-guide-admin-vs-operator)
   - [5.1 Operator Registration, Applications & Tenants](#51-operator-registration-applications--tenants)
   - [5.2 Sites (Hotspot Locations)](#52-sites-hotspot-locations)
   - [5.3 Device Catalogue & Physical Device Setup Requests](#53-device-catalogue--physical-device-setup-requests)
   - [5.4 Wi-Fi Packages & Promotional Offers (Free Trials)](#54-wi-fi-packages--promotional-offers-free-trials)
   - [5.5 Vouchers (Batch Generation, Printing & Auto-Expiry)](#55-vouchers-batch-generation-printing--auto-expiry)
   - [5.6 Payment Gateways & Monthly Multi-Site Subscriptions](#56-payment-gateways--monthly-multi-site-subscriptions)
   - [5.7 System Billing & Mobile Money Transactions](#57-system-billing--mobile-money-transactions)
   - [5.8 Earnings, Payout Methods (SMS OTP) & Withdrawals](#58-earnings-payout-methods-sms-otp--withdrawals)
   - [5.9 RADIUS Server (NAS Clients & Live Accounting)](#59-radius-server-nas-clients--live-accounting)
   - [5.10 Speedtest, Portal Branding & Account Settings](#510-speedtest-portal-branding--account-settings)
6. [Beginner Troubleshooting Checklist for Admins](#6-beginner-troubleshooting-checklist-for-admins)

---

## 1. Understanding the Three Roles in PoaFi

| Role | Who They Are | What They Can Do |
| :--- | :--- | :--- |
| **1. Super Admin (`PLATFORM_ADMIN`)** | You (the platform owner & technical support team). | • Approve or reject new Operator applications.<br>• View and manage **all** operators, sites, routers, packages, and payments using the **Operator Dropdown** at the top of pages.<br>• Receive and configure routers sent by operators (**Device Setup**).<br>• Earn revenue from **PoaFi Pay commissions** and **Monthly Operator Subscriptions**.<br>• Approve and send operator withdrawal payouts. |
| **2. Wi-Fi Operator (`TENANT_OWNER`)** | Business owners running Wi-Fi hotspots (cafes, hostels, bus terminals, estates, rural ISPs). | • Manage only their own sites, routers, packages, and vouchers.<br>• Choose how customers pay (**Mobile Money + Voucher**, **Mobile Money Only**, or **Voucher Only**).<br>• Use **PoaFi Pay** for free per month, or buy a **Monthly Subscription** to use their own payment gateway (0% commission).<br>• Withdraw collected earnings to M-Pesa, Tigo Pesa / Mixx by Yas, Airtel, Halopesa, CRDB, or NMB. |
| **3. Wi-Fi Customer** | People connecting their phone or laptop to the Wi-Fi hotspot. | • Connect to the Wi-Fi network and automatically see the **PoaFi Captive Portal** (`/portal?tenant=slug`).<br>• Claim a **First-Time Free Trial**, pay via **Mobile Money USSD Push**, or enter a **printed Voucher Code** to get online immediately. |

---

## 2. The Two Ways to Configure & Authenticate Devices (Native API/Cloud Sync vs. RADIUS)

PoaFi gives you **two architectural ways** to connect routers and authenticate Wi-Fi customers. As an Admin, here is how to know which one to use:

### Way 1: Native Direct API / HTTPS Cloud Sync Mode (Default — Easiest for Beginners)
- **How it works**:
  - When a customer buys a package or enters a voucher on the PoaFi Captive Portal, PoaFi creates the user account and speed limit directly on the router.
  - **On Shared Hosting (or when the router uses a 4G SIM card / ISP NAT)**: PoaFi installs a lightweight **15-second HTTPS Cloud Sync scheduler** (`poafi-cloud-sync`) on the MikroTik router. Every 15 seconds, the router contacts PoaFi over standard HTTPS (port 443) to download new active vouchers and kick expired users.
  - **On a VPS with WireGuard / Direct Public IP**: PoaFi connects directly to RouterOS API port `8728` (or TP-Link Omada Controller API port `8043`/`443`).
- **When to use it**:
  - Use this for **90% of setups** involving **MikroTik routers** or **TP-Link Omada Controllers**.
  - It requires **no FreeRADIUS server** and works even on low-cost shared hosting!

### Way 2: RADIUS Mode (`FreeRADIUS + NAS`)
- **How it works**:
  - Instead of PoaFi pushing voucher codes onto the router ahead of time, the router is configured as a **RADIUS Client (NAS)**.
  - When a customer enters their voucher code on the Wi-Fi sign-in screen, the router sends an authentication request (UDP port `1812`) to the PoaFi FreeRADIUS server, which checks `/api/radius/authorize` in real time and returns the customer's exact upload/download speed (`Mikrotik-Rate-Limit` / `WISPr-Bandwidth-Max-Down`) and time limit (`Session-Timeout`).
  - While the customer is online, the router sends live data-usage and time updates (UDP port `1813`) to `/api/radius/accounting`.
- **When to use it**:
  - When an operator has **many routers at the same site** that all need to share the exact same voucher pool simultaneously.
  - When using **PPPoE home fiber/wireless subscribers** alongside Hotspot users.
  - When using **third-party enterprise gateways/APs** that support external RADIUS authentication.
  - *(Note: FreeRADIUS requires a server/container capable of listening on UDP ports 1812 & 1813 — see the `freeradius/` folder).*

---

## 3. The Two Onboarding Workflows (Self-Setup vs. Physical Handover to Admin)

When an operator gets a new router, they go to **Device Setup (`/device-setup`)** and choose one of two paths:

### Path A: Self-Setup (Remote 1-Line Quick Setup)
1. The operator (or Admin helping them remotely via AnyDesk/TeamViewer) goes to **Routers → Quick Setup (Auto-Detect)**.
2. They select the Operator, Site, and RouterOS version (`RouterOS v7` or `RouterOS v6`), then click **Generate Setup Command**.
3. They copy the **1-line terminal command** and paste it into **WinBox → New Terminal**.
4. The router automatically configures its Hotspot, DHCP, DNS, Walled Garden, API user, and HTTPS Cloud Sync, then **phones home** to PoaFi with its Model, Serial Number, and Identity!
5. The Admin/Operator clicks **Confirm & Finish** in PoaFi — done in under 60 seconds!

### Path B: Assisted / Physical Handover Setup (Operator Sends Router to Admin)
Many beginner operators do not know how to open WinBox. PoaFi handles this cleanly:
1. **Operator Submits Request**: In **Device Setup (`/device-setup`)**, the operator creates an **Assisted Setup Request**, entering the device brand, model, **Serial Number (S/N)**, **MAC Address**, and how they are delivering the router (e.g. *"Sent via ABC Coach parcel to Dar office"*).
2. **Admin Receives Device**: The Super Admin opens **Device Setup (`/device-setup`)** and sees the request card displaying the **Serial Number**, **MAC Address**, and operator notes.
3. **Admin Updates Status**: Admin sets the request status to `IN_PROGRESS` while unboxing and powering on the router.
4. **2-Click Registration**: Admin clicks **"Register this device"** on the request card. This opens the **Routers** page with the **Operator, Device Name, and Vendor already pre-filled**!
5. **Auto-Linking**: As soon as the Admin runs Quick Setup or saves the router, PoaFi automatically links the new router back to the operator's request and sets the request status to `CONFIGURED` (and `COMPLETED` once shipped back).
6. **Operator Notification Banner**: The operator immediately sees a notification banner on their **Dashboard** and **Device Setup** page letting them know their router is configured and ready to plug in!

---

## 4. Step-by-Step Router Setup Guide for ALL Brands

Below is the exact guide for configuring every router and access point brand listed in PoaFi.

---

### 4.1 MikroTik (RouterOS v7 & v6) — Full Auto-Setup

**Supported Models**: hAP lite, hAP ac2/ac3, hAP ax2/ax3, hEX (RB750Gr3), hEX S, RB2011, RB3011, RB4011, RB5009, L009, CCR series, wAP ac.

#### Preparation before running the PoaFi script:
1. Connect the ISP internet cable (Starlink, Fiber modem, or 4G router) into **Port 1 (`ether1`)** of the MikroTik.
2. Connect your computer to **Port 2 (`ether2`)** and open **WinBox**.
3. Make sure the MikroTik has internet access (open **New Terminal** in WinBox and type `ping 8.8.8.8`).
4. Make sure the remaining ports (e.g. `ether2`–`ether5` and `wlan1`/`wlan2`) are inside the default **`bridge`** interface.

#### Option 1: 1-Line Quick Setup (Recommended — Works for both Native Cloud Sync & RADIUS)
1. Log into PoaFi → Go to **Routers (`/routers`)** → Click **Quick Setup (1-Paste Auto-Detect)**.
2. If you are logged in as **Super Admin**, select the **Operator** from the dropdown first.
3. Choose:
   - **RouterOS Version**: Select **`RouterOS v7`** (or **`RouterOS v6`** for older routers).
   - **Hotspot Interface**: Leave as `bridge` (default) unless your hotspot runs on a specific port/VLAN like `ether3`.
   - **Enable Hotspot**: Checked (`YES`).
   - **Enable PPPoE** *(Optional)*: Check if this router also serves home PPPoE customers.
   - **Enable RADIUS** *(Optional)*: Leave unchecked for Native/Shared-Hosting Cloud Sync mode, or check if using FreeRADIUS.
4. Click **Start Enrollment & Get Command**.
5. **Important for RouterOS v7.13+**: If the router complains about `device-mode`, run this command first in WinBox Terminal and press the physical reset/mode button when prompted:
   ```routeros
   /system/device-mode/update mode=advanced
   ```
6. Copy the **1-Line Terminal Command** from PoaFi (it starts with `:do { /tool fetch url="https://..." ...`) and paste it into **WinBox → New Terminal**, then press **Enter**.
7. Watch the PoaFi screen: within 5–10 seconds, the router will phone home and PoaFi will automatically display its **Hardware Model**, **Serial Number**, and **RouterOS Version**!
8. Click **Confirm & Activate Router**. Your MikroTik is now **`ONLINE`**!

---

### 4.2 TP-Link Omada (OC200 / OC300 / Software Controller)

**Supported Hardware**: OC200 / OC300 Hardware Controllers, Free Omada Software Controller (Windows/Linux), ER605 / ER7206 Gateways, EAP110 / EAP225 / EAP245 / EAP610 / EAP650 Access Points.

PoaFi has a **built-in TP-Link Omada SDN Driver** that connects directly to the Omada Controller Open API!

#### Step-by-Step Setup for TP-Link Omada:
1. Ensure your Omada Access Points (EAPs) and/or Omada Gateway (ER605/ER7206) are adopted in your **Omada Controller**.
2. Make sure your Omada Controller is reachable from your PoaFi server (or port-forwarded on HTTPS port `8043` or `443`).
3. In PoaFi, go to **Routers (`/routers`)** → Click **Add Router Manually**.
4. Select **Vendor**: **`TP-Link Omada (TPLINK_OMADA)`**.
5. Enter your Omada Controller's:
   - **Host / IP**: (e.g. `203.0.113.10` or `omada.yourdomain.co.tz`)
   - **API Port**: `8043` (or `443`)
   - **Username & Password**: Your Omada Controller administrator login.
6. Click the **"Discover from Omada Controller"** button in the form!
   - PoaFi will log into your Omada Controller, detect the Controller Version, list your Sites and Adopted Devices, and auto-fill the form!
7. Click **Save Router**.
8. On the saved Omada Router card, click **"1-Click Omada Portal & Walled Garden Setup"**:
   - PoaFi automatically configures the External Portal URL (`/portal?tenant=<slug>`) and adds all required Walled Garden domains (PoaFi + AzamPay) inside your Omada Controller!

---

### 4.3 Cudy, Comfast & Wavlink (`RADIUS / AP Only` Mode)

**Supported Models**: Cudy (WR1300, M1200, AP1300 Outdoor), Comfast (CF-EW71, CF-EW72, CF-E314N CPE), Wavlink (AC600 / AC1200 / AX1800 Outdoor High-Power APs).

> **Important Note for Beginner Admins**:
> Consumer and outdoor Access Points from **Cudy, Comfast, and Wavlink** do not have a built-in billing API to create or expire vouchers on their own. In PoaFi they are clearly labeled **`RADIUS / AP only`**.

Here are the **two ways** you deploy them for an operator:

#### Setup Method 1: Access Point (Bridge) Behind a MikroTik Router *(Recommended — Simplest & Most Reliable)*
In this setup, a small indoor **MikroTik router** (even a low-cost hEX lite or hAP lite) acts as the "Brain" (handling PoaFi billing, vouchers, and speed limits), while the **Cudy / Comfast / Wavlink** outdoor antenna acts as the high-power Wi-Fi broadcaster:
1. Configure the **MikroTik router** in PoaFi using **Section 4.1 (1-Line Quick Setup)** above.
2. Log into the **Cudy / Comfast / Wavlink** web page (usually `192.168.10.1` or `192.168.188.1`).
3. Switch its operation mode to **Access Point (AP Mode) / Bridge Mode** (or turn **OFF** its DHCP Server).
4. Set the Wi-Fi Name (SSID) to the operator's hotspot name (e.g. `"Tanga High-Speed WiFi"`) with **No Wi-Fi Password (Open)**.
5. Plug an Ethernet cable from the MikroTik's Hotspot port (`ether2`–`ether5`) into the Cudy/Comfast/Wavlink AP.
6. **Result**: Anyone who connects to the Cudy/Comfast/Wavlink outdoor Wi-Fi gets an IP address from the MikroTik and is immediately shown the **PoaFi Captive Portal**!

#### Setup Method 2: Direct RADIUS Mode (For Enterprise Comfast/Wavlink/Cudy Firmware)
If the specific model has a built-in **Captive Portal + External RADIUS** menu in its web settings:
1. In PoaFi, go to **RADIUS (`/radius`)** → Click **Add NAS Client**.
2. Enter the device's public/tunnel IP (`NAS IP`) and generate a **RADIUS Shared Secret**.
3. In the Cudy/Comfast/Wavlink web UI under **Captive Portal / RADIUS**:
   - **RADIUS Server IP**: Your PoaFi FreeRADIUS IP
   - **Auth Port**: `1812` | **Accounting Port**: `1813`
   - **Shared Secret**: Paste the secret from PoaFi
   - **External Portal URL**: `https://yourdomain.co.tz/portal?tenant=<operator-slug>`

---

### 4.4 Ubiquiti UniFi & Ruijie / Reyee

- **Ubiquiti UniFi (UAP-AC-M, U6-LR, U6-Mesh)** & **Ruijie / Reyee (RG-EW300, RG-RAP2200, RG-RAP52)**:
  - **Easiest Setup (No VPS needed)**: Set the UniFi AP or Ruijie Reyee AP into **Bridge / AP Mode** and plug it into a **MikroTik Hotspot Gateway** configured via PoaFi Quick Setup (exactly like Method 1 in Section 4.3).
  - **Controller + RADIUS Setup**: In the **UniFi Network Controller** (*Settings → Profiles → RADIUS* and *Hotspot Manager → Landing Page*) or **Ruijie Cloud** (*Captive Portal → External RADIUS*), point Authentication (`1812`) and Accounting (`1813`) to your PoaFi RADIUS server and register the controller/gateway IP in PoaFi's **RADIUS (`/radius`)** page.

---

## 5. Complete Feature-by-Feature Guide (Admin vs. Operator)

Here is how every menu item on the left sidebar works, and how both the **Super Admin** and the **Operator** use it.

---

### 5.1 Operator Registration, Applications & Tenants
- **Public Registration (`/register`)**:
  - A new Wi-Fi business owner visits `/register`, fills in their Business Name, Contact Name, Email, Phone Number, City, and chooses their own password.
- **Applications (`/applications` — Super Admin Only)**:
  - The Super Admin reviews pending registrations under **Applications**.
  - Clicking **Approve** automatically creates the Operator's **Tenant** workspace, activates their login account with the password they chose, and generates their unique Captive Portal slug (e.g. `/portal?tenant=kigamboni-wifi`).
- **Tenants / Operators (`/tenants` — Super Admin Only)**:
  - Super Admin can view all operators, suspend/reactivate an operator, or delete an operator (which immediately invalidates their active login session).

---

### 5.2 Sites (Hotspot Locations)
- **Page**: **Sites (`/sites`)**
- **How Operators use it**:
  - If an operator has Wi-Fi hotspots in multiple places (e.g. *"Mlimani Hostel"*, *"Kariakoo Market"*, *"Ubungo Terminal"*), they create a **Site** for each location and assign each Router to its Site.
  - The **Dashboard** then shows online/offline routers grouped by Site!
  - *(Note: The number of Sites an operator creates also determines which **Monthly Subscription tier** applies if they choose to use their own 0%-commission payment gateway).*

---

### 5.3 Device Catalogue & Physical Device Setup Requests
- **Device Catalogue (`/device-catalog`)**:
  - A built-in reference library of recommended routers, outdoor access points, switches, and CPEs (MikroTik, TP-Link Omada, Ruijie/Reyee, Cudy, Comfast, Wavlink) showing indoor/outdoor rating, coverage in meters, client capacity, PoE type, and whether the device is a full Hotspot Gateway or AP-only.
  - Helps beginners choose the right hardware before buying!
- **Device Setup (`/device-setup`)**:
  - **Operator View**: Submit a request for technical setup assistance (including Serial Number, MAC address, and delivery note) and track progress (`PENDING` → `IN_PROGRESS` → `CONFIGURED` → `COMPLETED`).
  - **Super Admin View**: View all operator hardware requests, assign them, click **"Register this device"** to jump straight to Router creation with 1 click, and leave admin notes (e.g. courier tracking number when shipping the router back).

---

### 5.4 Wi-Fi Packages & Promotional Offers (Free Trials)
- **Page**: **Packages (`/packages`)**
- **Standard Packages**:
  - Operators create their own Wi-Fi plans in **TZS** (e.g. *30 Mins @ TZS 500*, *24 Hours @ TZS 2,000*, *7 Days @ TZS 10,000*, *30 Days @ TZS 30,000*).
  - Each package defines: **Price (TZS)**, **Duration (Minutes)**, **Download Speed (Kbps)**, **Upload Speed (Kbps)**, optional **Data Cap (MB)**, and optional target **Router**.
- **Promotional Offers (Marketing Tools to Attract Customers)**:
  - When creating a package, the operator can toggle **"Promotional Offer"** and pick one of 3 offer types:
    1. **`FIRST_TIME_FREE` (Free First-Time Trial)**: Price is `TZS 0` (e.g. *15 Minutes Free Trial*). PoaFi records the customer's Device ID, MAC Address, IP, and Phone Number in `OfferClaim` so **each customer device can only claim the free trial once**!
    2. **`LIMITED_PROMO` (Discounted Flash Sale)**: Shows the crossed-out original price (e.g. ~~TZS 3,000~~ → **TZS 1,500**) with an automatic countdown expiration date (`offerEndsAt`).
    3. **`HAPPY_HOUR`**: Special time-limited promotional tariff.

---

### 5.5 Vouchers (Batch Generation, Printing & Auto-Expiry)
- **Page**: **Vouchers (`/vouchers`)**
- **How Operators & Admins use it**:
  1. **Generate Batch**: Select a Package, enter quantity (e.g. `50` or `200` vouchers), and optional custom prefix (e.g. `TANGA-`). PoaFi generates unique, encrypted voucher codes.
  2. **Print Voucher Cards**: Click **Print / Export** to generate a clean, cut-ready sheet of voucher cards (showing Hotspot Name, Package, Duration, Price, and Code) that shopkeepers can sell for cash.
  3. **Import Vouchers**: If migrating from an old MikroTik User Manager system, operators can import existing voucher codes into PoaFi.
  4. **Automatic Expiry & Cleanup**: Every 60 seconds (or via the cPanel Cron Job `/api/internal/cron/run` and the 15-second router HTTPS sync), PoaFi finds all `ACTIVE` vouchers whose time has expired, marks them `EXPIRED`, and kicks them off the router automatically.

---

### 5.6 Payment Gateways & Monthly Multi-Site Subscriptions
- **Page**: **Payment Gateways (`/payment-gateways`)**

#### A. Choosing What Customers See on the Hotspot Portal
At the top of the page, the operator selects one of 3 **Hotspot Checkout Modes**:
1. **Mobile Money + Voucher (`MIXED`)**: Customers can either pay via M-Pesa / Mixx by Yas (Tigo) / Airtel / Halopesa **or** enter a cash voucher code.
2. **Mobile Money Only (`MOBILE_ONLY`)**: Customers pay online via mobile money only (100% cashless hotspot).
3. **Voucher Only (`VOUCHER_ONLY`)**: Customers only enter pre-printed voucher codes.

#### B. How the Super Admin Makes Money (Two Flexible Operator Models)

| Operator Choice | How Money Flows | How Super Admin Earns Profit |
| :--- | :--- | :--- |
| **Option 1: Use `PoaFi Pay` (Default)** | Customer mobile money payments are collected through the Super Admin's central AzamPay account (`POAFI_MASTER` in `.env`) and credited to the operator's PoaFi wallet. | **No monthly fee (`TZS 0/mo`)**. The Super Admin automatically keeps the platform commission (`10%` platform fee / `3%` withdrawal fee) when the operator collects/withdraws earnings. |
| **Option 2: Use Own Direct Payment Gateway** (*AzamPay Direct, ClickPesa, Snippe, Pesapal, or PalmPesa*) | 100% of customer payments go directly into the operator's own merchant account (**0% PoaFi transaction commission**). | To unlock custom direct gateways, the operator must pay a **Monthly Subscription** directly to the Super Admin via Mobile Money! |

#### C. Multi-Site Monthly Subscription Tiers (Automatic Multi-Site Discounts)
PoaFi automatically counts how many **Sites** the operator has and enforces the matching tier:
1. **Single-Site Starter (`STARTER_1_SITE`) — TZS 20,000 / month**:
   - For operators with **1 Wi-Fi Site** (up to 2 routers). Unlocks all direct 0%-commission payment gateways.
2. **Multi-Site Business (`GROWTH_MULTI_SITE`) — TZS 60,000 / month *(Save 40% per site!)*:**
   - For operators with **2 to 5 Wi-Fi Sites** (up to 10 routers). Costs only **TZS 12,000 per site/month** instead of TZS 20,000!
3. **ISP Enterprise (`ENTERPRISE_UNLIMITED`) — TZS 120,000 / month *(Save 60%+ per site!)*:**
   - For operators & ISPs with **6+ Sites** (**Unlimited Sites & Routers** nationwide).
- **Multi-Month Discounts**: Operators can also choose **3 Months (10% discount)** or **12 Months (20% discount)** when paying their subscription via Mobile Money.

---

### 5.7 System Billing & Mobile Money Transactions
- **Page**: **Billing (`/billing`)**
- Shows real-time mobile money payment transactions (`SUCCESS`, `PENDING`, `FAILED`), total revenue collected, operator net payout, platform fee, **Export to CSV** (for Excel accounting), and **Print / Save PDF**.
- **Automatic Recovery**: If a customer pays via Mobile Money while their router briefly lost power or internet, PoaFi's background recovery job (`retryPendingProvisions`) automatically retries provisioning their voucher as soon as the router comes back online!

---

### 5.8 Earnings, Payout Methods (SMS OTP) & Withdrawals
- **Page**: **Payouts (`/payouts`)**
- **How Operators use it**:
  1. **Add Payout Method**: Operator adds their **Mobile Money number** (M-Pesa, Tigo Pesa / Mixx by Yas, Airtel Money) or **Bank Account** (CRDB, NMB).
  2. **SMS OTP Security Verification**: PoaFi sends a 6-digit OTP code via **Beem Africa SMS** to verify the payout destination before any money can be withdrawn.
  3. **Request Withdrawal**: Operator enters the amount to withdraw from their available wallet balance.
- **How Super Admin uses it**:
  - Super Admin views all pending withdrawal requests, transfers the net payout to the operator's verified account, and marks the withdrawal `COMPLETED`.

---

### 5.9 RADIUS Server (NAS Clients & Live Accounting)
- **Page**: **RADIUS (`/radius`)**
- **NAS Clients Tab**: Add routers/controllers by IP address (`nasname`), vendor, and shared secret. Includes 1-click **Rotate Secret** if a key ever needs to be changed.
- **Active Sessions Tab**: View live RADIUS accounting sessions (`START`, `INTERIM-UPDATE`, `STOP`), including customer IP, MAC address (`callingStationId`), session time, and data downloaded/uploaded (`inputOctets` / `outputOctets`).

---

### 5.10 Speedtest, Portal Branding & Account Settings
- **Speedtest (`/speedtest`)**:
  - Test browser-to-server latency (ping), jitter, download speed, and upload speed, plus inspect router WAN status.
- **Settings (`/settings`)**:
  - **Captive Portal Branding**: Operators can customize their **Hotspot Logo URL**, **Primary Brand Color**, **Welcome Tagline** (e.g. *"Fastest Fiber Wi-Fi in Tanga"*), and **Customer Support Phone Number** (displayed at the bottom of their `/portal?tenant=<slug>` login page).
  - **Security & Account**: Change password (immediately invalidates old sessions on other devices) or delete account.

---

## 6. Beginner Troubleshooting Checklist for Admins

| Symptom Reported by Operator | Cause & 1-Minute Fix for Admin |
| :--- | :--- |
| **"Router status says `PENDING` or `OFFLINE` after pasting script"** | 1. Make sure the router has internet on `ether1` (`ping 8.8.8.8` in WinBox Terminal).<br>2. On RouterOS v7.13+, make sure `/system/device-mode/update mode=advanced` is enabled so `/tool fetch` and scheduler scripts can run.<br>3. Check that `PUBLIC_API_URL` in `poafi-backend/.env` is set to your public HTTPS domain (not `localhost`) when testing with a remote router over the internet. |
| **"Customer connects to Wi-Fi but the Captive Portal page doesn't pop up"** | 1. Check that the router's **Walled Garden** (`/ip hotspot walled-garden`) includes your PoaFi domain and `*.azampay.co.tz` (Quick Setup adds these automatically).<br>2. Ensure the customer is connected to an port/WLAN that belongs to the `bridge` interface selected during Quick Setup. |
| **"Operator says they cannot turn on their own ClickPesa / AzamPay gateway"** | Remind them that custom 0%-commission gateways require an **active Monthly Subscription** covering their number of Sites. They can either subscribe at the top of **Payment Gateways (`/payment-gateways`)**, or use **PoaFi Pay** which is free per month. |
| **"Customer paid via M-Pesa, got the SMS voucher, how do they connect?"** | The portal automatically activates their session. If their phone closed the browser while entering their M-Pesa PIN, they simply copy the voucher code from the SMS (e.g. `A1B2C3D4`) and paste it into the **"Have a Voucher Code?"** box on the portal! |
