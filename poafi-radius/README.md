# PoaFi RADIUS Hotspot Integration

This service adds a standards-based RADIUS authentication/accounting path for network equipment that supports an external RADIUS server and a built-in captive portal.

It does **not** make every router or access point compatible. A device must support RADIUS PAP for hotspot users and RADIUS accounting. Its captive portal must be configured to send voucher username/password credentials to the RADIUS server.

## What it provides

- Dynamic NAS client discovery: a gateway is accepted only when its observed source IPv4 address is registered in PoaFi.
- Per-NAS random shared secrets, encrypted in the PoaFi database and returned once when created or rotated.
- Tenant-scoped voucher authentication through RADIUS Access-Request.
- Standard `Session-Timeout` on Access-Accept so the NAS can end the session at voucher expiry.
- `Filter-Id` to let supported NAS products map a PoaFi package to a locally configured bandwidth/access profile.
- RADIUS Accounting Start, Interim-Update and Stop records in PoaFi.

## Protocol scope

This first version supports PAP for captive-portal voucher login. It does not implement EAP/802.1X, CHAP, MS-CHAP, CoA/Disconnect-Message, vendor-specific speed-control attributes, or automatic SSID/VLAN configuration. Configure the NAS hotspot profile to use PAP and map the returned Filter-Id to a bandwidth profile if the device supports it.

RADIUS uses UDP 1812 (authentication) and 1813 (accounting). RADIUS over ordinary UDP is not transport encryption. Use private VPN transport where practical, use one random secret per NAS, restrict firewall source addresses where possible, and do not publish the backend REST bridge to the internet.

## Requirements

- A publicly reachable IPv4 address or private VPN path for the RADIUS service.
- A public/egress IPv4 address for each NAS that PoaFi can observe. Enter that observed source address in the Operator setup screen, not an arbitrary LAN management IP.
- A backend deployment with database migrations applied.
- Docker Engine with Docker Compose for the FreeRADIUS service.
- A domain and HTTPS hosting for the PoaFi public captive portal, if the NAS supports an external portal URL.

## Deploy the RADIUS service

1. Set `RADIUS_ENABLED=true` in `poafi-backend/.env`.
2. Generate a random secret of at least 32 characters and set it as `RADIUS_REST_SHARED_SECRET` in the backend environment.
3. Set `RADIUS_SERVER_HOST` in the backend to the public hostname or IPv4 address that NAS devices will use.
4. Copy `.env.radius.example` to `.env` in this folder.
5. Set `POAFI_API_URL` to the private backend URL reachable from the container. For local backend development on Windows, `http://host.docker.internal:4000` is the default example.
6. Set `RADIUS_REST_SHARED_SECRET` to the exact same internal secret as the backend.
7. Start the service:

```bash
docker compose --env-file .env -f compose.yml up --build -d
```

8. Check the logs:

```bash
docker compose --env-file .env -f compose.yml logs -f poafi-radius
```

FreeRADIUS listens on UDP 1812 and 1813. Open these UDP ports on the host/network firewall. Restrict them to known NAS source addresses when practical.

## Operator setup

1. Sign in to PoaFi and open **Internet Access Setup**.
2. Select the manufacturer's equipment family and choose **Standard RADIUS** where the equipment supports it.
3. Enter the NAS name and the fixed source IPv4 address visible to the RADIUS server.
4. Save. PoaFi displays the RADIUS server address, ports and one-time shared secret.
5. In the equipment's captive portal/hotspot settings, configure:
   - Authentication server: PoaFi RADIUS host, UDP 1812
   - Accounting server: PoaFi RADIUS host, UDP 1813
   - Shared secret: the one-time secret shown by PoaFi
   - User authentication: PAP
   - Accounting: Start, Interim-Update and Stop (recommended)
6. Keep the device's captive portal enabled and configure its login form to send the voucher as both username and password.
7. In PoaFi, create internet packages and generate vouchers. After a user enters a voucher in the device's captive portal, the NAS asks PoaFi to authenticate it.
8. Test with a disposable voucher first.

The captive portal page built into the vendor's device is used for this RADIUS flow. A generic external redirect to PoaFi's hosted portal is not automatically configured by RADIUS and remains device-specific.

## Troubleshooting

- **No response / unknown RADIUS client:** Verify the source IPv4 address the RADIUS container sees, that it is registered in PoaFi, and that UDP 1812/1813 can reach the server.
- **Invalid shared secret:** Rotate the secret in PoaFi and update the NAS with the new secret.
- **Voucher rejected:** Confirm the voucher belongs to this Operator, is unused or still active, and the NAS belongs to the same Operator.
- **Login succeeds but speed is not limited:** Configure the NAS to map the returned `Filter-Id` to a local bandwidth/access profile. Generic RADIUS cannot apply every vendor's traffic-shaping syntax automatically.
- **Accounting is missing:** Enable RADIUS accounting on the NAS and send Start, Interim-Update and Stop to UDP 1813.

## Important limitations

- The RADIUS service currently supports static IPv4 NAS source addresses. Dynamic public IPs require a stable VPN/source address or a later dynamic-address enrolment workflow.
- Devices behind one shared public NAT address use one registered NAS client identity and shared secret in this first version. Do not reuse a source IP between different Operators.
- A NAS must support the required captive-portal RADIUS PAP workflow. Enterprise Wi-Fi 802.1X/EAP is not part of this implementation.
- Session-Timeout is enforced by the NAS. Without it, accounting records alone cannot remotely disconnect a client at voucher expiry.
- No device has been physically tested by this code change yet. Validate on a test router/AP before production.
