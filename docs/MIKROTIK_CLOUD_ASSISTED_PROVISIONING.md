# MikroTik cloud-assisted provisioning — Phase 1

This increment generates a short-lived RouterOS bootstrap script for a registered MikroTik router. It creates a WireGuard interface, adds the PoaFi hub as a peer, assigns a dedicated management address, and posts the router public key to PoaFi using a one-time enrollment token.

## Required backend environment

Set these only after deploying a reachable WireGuard hub:

- `PUBLIC_API_BASE_URL`: public HTTPS API base URL.
- `WIREGUARD_SERVER_ENDPOINT`: public DNS name or IP of the WireGuard hub.
- `WIREGUARD_SERVER_PUBLIC_KEY`: hub's WireGuard public key.
- `WIREGUARD_SERVER_ADDRESS`: hub address on the dedicated management subnet (default `10.250.0.1`).
- `WIREGUARD_SERVER_PORT`: UDP listen port (default `51820`).
- `WIREGUARD_SERVER_INTERFACE`: hub interface name (default `wg-poafi`).

The API refuses to generate a script until the HTTPS URL, hub endpoint, and valid hub public key are configured. The router generates and retains its own private key; PoaFi only receives the public key.

## Workflow

1. Register a MikroTik router in PoaFi.
2. Generate its provisioning script from the authenticated router endpoint.
3. Review and run the script in Winbox Terminal on that router.
4. The router posts its public key using a one-time token (30-minute expiry).
5. A platform administrator adds the returned public key to the WireGuard hub using the generated server peer command.
6. Verify a real WireGuard handshake and test RouterOS API access over the tunnel before marking the router ready.

## Limits and safety

- This code does not deploy the WireGuard hub, configure hub firewall/routing, or automatically install the server peer.
- It does not configure hotspot, SSID, VLAN, WAN, or customer traffic.
- Do not expose RouterOS API or Winbox to the public internet. Restrict management services to the VPN address only after tunnel testing.
- Test on the newly acquired physical MikroTik only after identifying its exact model, confirming RouterOS version, and preparing a safe rollback/export. Do not run the generated script on a production router.
- A successful enrollment callback means only that the router submitted its public key; it does not prove a WireGuard handshake or API reachability.
- RouterOS WireGuard peer behavior is documented in the [official RouterOS manual](https://manual.mikrotik.com/docs/virtual-private-networks/wireguard/).
