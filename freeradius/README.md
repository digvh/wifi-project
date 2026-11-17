# FreeRADIUS + PoaFi REST Bridge (`rlm_rest`)

This directory sets up FreeRADIUS 3.x in front of the PoaFi backend (`/api/radius/*`).
All routers/APs (MikroTik, Omada, UniFi, Ruijie, Cudy, Comfast, Wavlink) point their Hotspot RADIUS settings to this server's public/tunnel IP on ports `1812/udp` (auth) and `1813/udp` (acct).

## 1. Configure `poafi-backend/.env`

Set the three RADIUS variables (minimum 32 chars for the shared secret):

```env
RADIUS_ENABLED=true
RADIUS_SERVER_HOST=your-radius-server-ip-or-domain
RADIUS_REST_SHARED_SECRET=replace-with-a-long-random-32-char-secret
```

Restart the backend after editing `.env`.

## 2. Start FreeRADIUS

Export the matching secret and run Docker Compose from this folder:

```bash
export RADIUS_REST_SHARED_SECRET="replace-with-a-long-random-32-char-secret"
export POAFI_API_URL="http://host.docker.internal:4000/api/radius"
docker compose up -d
```

For production on the same Linux host as PoaFi API, point `POAFI_API_URL` to `http://127.0.0.1:4000/api/radius` or your internal Docker network URL.

## 3. Add a Network Device (NAS) in PoaFi

1. Log into PoaFi Dashboard -> **RADIUS Devices**.
2. Register the router/AP's source IPv4 address (`nasname`) and copy the generated **Shared Secret**.
3. Paste the server IP, ports `1812`/`1813`, and shared secret into your MikroTik / Omada / UniFi / Cudy hotspot RADIUS settings.

## 4. Test with `radtest`

```bash
radtest <VOUCHER_CODE> <VOUCHER_CODE> 127.0.0.1 0 <NAS_SHARED_SECRET>
```

Expected output on a valid unused/active voucher: `Received Access-Accept`.
