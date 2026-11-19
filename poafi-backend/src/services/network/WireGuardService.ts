import crypto from 'crypto';
import { env } from '../../config/env';

export interface MikroTikSetupOptions {
  rosVersion?: '7' | '6';
  enableHotspot?: boolean;
  enablePppoe?: boolean;
  enableRadius?: boolean;
  hotspotInterface?: string;
  hotspotSubnet?: string;
  tenantSlug?: string;
  portalHost?: string;
  apiHost?: string;
  radiusServerHost?: string;
  radiusSecret?: string;
}

function safeInterfaceName(raw?: string): string {
  const cleaned = String(raw || 'bridge').trim().replace(/[^a-zA-Z0-9_.\-]/g, '');
  return cleaned.slice(0, 32) || 'bridge';
}

function safeSubnetPrefix(raw?: string): string {
  const candidate = String(raw || '10.5.50').trim().replace(/\.0(\/24)?$/, '');
  const parts = candidate.split('.');
  if (parts.length === 3 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
    return candidate;
  }
  return '10.5.50';
}

function extractHostname(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return null;
  }
}

export class WireGuardService {
  /**
   * Generates a WireGuard compatible X25519 keypair.
   */
  static generateKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');

    const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(12);
    const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(16);

    return {
      publicKey: pubRaw.toString('base64'),
      privateKey: privRaw.toString('base64'),
    };
  }

  /**
   * Random per-router API password (never derived from the router id).
   */
  static generateApiPassword() {
    return crypto.randomBytes(18).toString('base64url');
  }

  static readonly DEVICE_MODE_COMMAND = '/system/device-mode/update mode=advanced';

  /**
   * Short 1-line Terminal command that fetches and applies the full .rsc script.
   */
  static generateOneLineFetchCommand(scriptUrl: string): string {
    return `:do { /tool fetch url="${scriptUrl}" mode=https dst-path=poafi-setup.rsc; :delay 1s; /import poafi-setup.rsc; } on-error={ :put "Setup fetch failed. On RouterOS 7, run: /system/device-mode/update mode=advanced" }`;
  }

  /**
   * Generates the MikroTik RouterOS script to paste into WinBox / Terminal
   * or fetch via /tool fetch. Supports RouterOS 7 (WireGuard + Hotspot + RADIUS + PPPoE)
   * and RouterOS 6 (API + Hotspot + RADIUS + PPPoE without WireGuard).
   */
  static generateMikroTikScript(
    routerIp: string,
    routerPublicKey: string,
    routerPrivateKey: string,
    routerId: string,
    apiPassword: string,
    enrollment?: { callbackUrl: string; token: string },
    options?: MikroTikSetupOptions,
  ) {
    const serverEndpoint = env.WG_SERVER_ENDPOINT || 'YOUR_POAFI_SERVER_IP:51820';
    const serverPublicKey = env.WG_SERVER_PUBLIC_KEY || 'YOUR_POAFI_SERVER_WG_PUBLIC_KEY';
    const serverIp = env.WG_SERVER_IP || '10.8.0.1';
    const hasWireGuardServer = Boolean(
      env.WG_SERVER_ENDPOINT &&
        env.WG_SERVER_PUBLIC_KEY &&
        !env.WG_SERVER_ENDPOINT.includes('YOUR_') &&
        !env.WG_SERVER_PUBLIC_KEY.includes('YOUR_'),
    );

    const rosVersion = options?.rosVersion === '6' ? '6' : '7';
    const enableHotspot = options?.enableHotspot !== false;
    const enablePppoe = options?.enablePppoe === true;
    const enableRadius = Boolean(options?.enableRadius && options?.radiusServerHost && options?.radiusSecret);
    const iface = safeInterfaceName(options?.hotspotInterface);
    const subnet = safeSubnetPrefix(options?.hotspotSubnet);
    const portalHost = options?.portalHost || extractHostname(env.PUBLIC_APP_URL);
    const apiHost = options?.apiHost || extractHostname(env.PUBLIC_API_URL);

    const wgSection =
      rosVersion === '7' && hasWireGuardServer
        ? `
# 1. Create the WireGuard Cloud Tunnel (RouterOS 7)
:do { /interface wireguard remove [find name="poafi-cloud"] } on-error={}
/interface wireguard add name=poafi-cloud listen-port=13231 private-key="${routerPrivateKey}" comment="PoaFi Cloud"

# 2. Assign Tunnel IP
:do { /ip address remove [find interface="poafi-cloud"] } on-error={}
/ip address add address=${routerIp}/24 interface=poafi-cloud comment="PoaFi Cloud Tunnel"

# 3. Add PoaFi Server Peer
:do { /interface wireguard peers remove [find interface="poafi-cloud"] } on-error={}
/interface wireguard peers add interface=poafi-cloud public-key="${serverPublicKey}" endpoint-address=${serverEndpoint.split(':')[0]} endpoint-port=${serverEndpoint.split(':')[1] || 51820} allowed-address=10.8.0.0/24 persistent-keepalive=25s
`
        : rosVersion === '7'
          ? `
# 1. Shared Hosting HTTPS Cloud Sync Mode (No WireGuard VPS required)
:put "PoaFi Shared Hosting mode: using outbound HTTPS Cloud Sync (no WireGuard peer required)."
`
          : `
# 1. RouterOS 6 Notice: Using outbound HTTPS Cloud Sync + Hotspot
:put "RouterOS 6 mode: configuring Hotspot + HTTPS Cloud Sync."
`;

    const apiFirewallSection =
      rosVersion === '7' && hasWireGuardServer
        ? `
# 5. Lock RouterOS API (8728) to the PoaFi WireGuard Tunnel
:do { /ip firewall filter remove [find comment="PoaFi Cloud API"] } on-error={}
:do { /ip firewall filter remove [find comment="Block public API access"] } on-error={}
/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=${serverIp} action=accept comment="PoaFi Cloud API" place-before=0
/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=drop comment="Block public API access" place-before=1
`
        : '';

    const walledGardenHosts = Array.from(
      new Set(
        [
          portalHost,
          apiHost,
          'poafi.co.tz',
          '*.poafi.co.tz',
          'azampay.co.tz',
          '*.azampay.co.tz',
        ].filter((h): h is string => Boolean(h && h !== 'localhost' && h !== '127.0.0.1')),
      ),
    );

    const walledGardenLines = walledGardenHosts
      .map(
        (host) =>
          `:do { /ip hotspot walled-garden add dst-host="${host}" action=allow comment="PoaFi Walled Garden" } on-error={}`,
      )
      .join('\n');

    const hotspotSection = enableHotspot
      ? `
# 6. Auto-Configure Hotspot Network, DHCP, Server & Walled Garden
:do { /ip address add address=${subnet}.1/24 interface="${iface}" comment="PoaFi Hotspot Gateway" } on-error={}
:do { /ip pool remove [find name="poafi-hs-pool"] } on-error={}
/ip pool add name=poafi-hs-pool ranges=${subnet}.10-${subnet}.254
:do { /ip dhcp-server network add address=${subnet}.0/24 gateway=${subnet}.1 dns-server=8.8.8.8,1.1.1.1 comment="PoaFi Hotspot Net" } on-error={}
:do { /ip dhcp-server add name=poafi-hs-dhcp interface="${iface}" address-pool=poafi-hs-pool lease-time=1h disabled=no } on-error={}
:do { /ip dns set allow-remote-requests=yes servers=8.8.8.8,1.1.1.1 } on-error={}
:do { /ip firewall nat add chain=srcnat src-address=${subnet}.0/24 action=masquerade comment="PoaFi Hotspot NAT" } on-error={}
:do { /ip hotspot profile remove [find name="poafi-hsprof"] } on-error={}
/ip hotspot profile add name=poafi-hsprof hotspot-address=${subnet}.1 dns-name=wifi.poafi.local login-by=http-chap,http-pap,cookie html-directory=hotspot use-radius=${enableRadius ? 'yes' : 'no'}${enableRadius ? ' radius-interim-update=5m' : ''}
:do { /ip hotspot remove [find name="poafi-hotspot"] } on-error={}
/ip hotspot add name=poafi-hotspot interface="${iface}" address-pool=poafi-hs-pool profile=poafi-hsprof disabled=no
${walledGardenLines}
:put "PoaFi Hotspot & Walled Garden Configured!"
`
      : '';

    const radiusSection = enableRadius
      ? `
# 7. Auto-Configure PoaFi RADIUS Authentication
:do { /radius remove [find comment="PoaFi RADIUS"] } on-error={}
/radius add service=hotspot${enablePppoe ? ',ppp' : ''} address=${options!.radiusServerHost} secret="${options!.radiusSecret}" authentication-port=1812 accounting-port=1813 comment="PoaFi RADIUS"
:put "PoaFi RADIUS Configured!"
`
      : '';

    const pppoeSection = enablePppoe
      ? `
# 8. Auto-Configure PPPoE Server
:do { /ip pool remove [find name="poafi-pppoe-pool"] } on-error={}
/ip pool add name=poafi-pppoe-pool ranges=10.6.60.10-10.6.60.254
:do { /ppp profile remove [find name="poafi-pppoe"] } on-error={}
/ppp profile add name=poafi-pppoe local-address=10.6.60.1 remote-address=poafi-pppoe-pool dns-server=8.8.8.8,1.1.1.1${enableRadius ? ' use-encryption=default' : ''}
:do { /interface pppoe-server server remove [find service-name="PoaFi-PPPoE"] } on-error={}
/interface pppoe-server server add service-name=PoaFi-PPPoE interface="${iface}" default-profile=poafi-pppoe disabled=no
:put "PoaFi PPPoE Server Configured!"
`
      : '';

    const enrollBaseUrl = enrollment?.callbackUrl
      ? enrollment.callbackUrl.replace(/\/$/, '')
      : env.PUBLIC_API_URL
        ? `${env.PUBLIC_API_URL.replace(/\/$/, '')}/api/enroll`
        : 'https://YOUR_PUBLIC_API_URL/api/enroll';
    const syncUrl = `${enrollBaseUrl}/sync/${routerId}?key=${encodeURIComponent(apiPassword)}`;

    const httpsSyncSection = `
# 9. PoaFi HTTPS Cloud Sync Scheduler (Works on Shared Hosting & Behind 4G/NAT without VPS)
:do { /system scheduler remove [find name="poafi-cloud-sync"] } on-error={}
/system scheduler add name=poafi-cloud-sync interval=15s start-time=startup policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon on-event=":do { /tool fetch url=\\"${syncUrl}\\" mode=https http-header-field=\\"X-Router-Key: ${apiPassword}\\" dst-path=poafi-sync.rsc; :delay 1s; /import poafi-sync.rsc; } on-error={}" comment="PoaFi HTTPS Cloud Sync"
:put "PoaFi HTTPS Cloud Sync Scheduler (15s) Installed!"
`;

    const phoneHome = enrollment
      ? `
# 10. Phone home: report device specs so PoaFi auto-fills registration
:local pfModel "unknown"
:local pfSerial "unknown"
:do { :set pfModel [/system routerboard get model] } on-error={ :set pfModel [/system resource get board-name] }
:do { :set pfSerial [/system routerboard get serial-number] } on-error={ :set pfSerial "n/a" }
:local pfIdentity [/system identity get name]
:local pfVersion [/system resource get version]
:delay 2s
/tool fetch url="${enrollment.callbackUrl}" mode=https http-method=post http-header-field="Content-Type: application/json,X-Enrollment-Token: ${enrollment.token}" http-data=("{\\"model\\":\\"" . $pfModel . "\\",\\"serial\\":\\"" . $pfSerial . "\\",\\"identity\\":\\"" . $pfIdentity . "\\",\\"version\\":\\"" . $pfVersion . "\\"}") keep-result=no
:put "Device report sent to PoaFi!"
`
      : '';

    return `# =====================================================================
# PoaFi One-Paste Auto-Setup for Router: ${routerId}
# Target: RouterOS v${rosVersion} | Interface: ${iface} | Hotspot: ${enableHotspot ? 'YES' : 'NO'}
# Paste this script into WinBox -> New Terminal (or run the 1-line fetch)
# =====================================================================
${wgSection}
# 4. Create dedicated PoaFi API user
:do { /user remove [find name="poafi-cloud"] } on-error={}
:do { /user group remove [find name="poafi-cloud"] } on-error={}
/user group add name=poafi-cloud policy=api,read,write,test,ssh
/user add name=poafi-cloud group=poafi-cloud password="${apiPassword}" comment="PoaFi Cloud Managed"
/ip service enable api
${apiFirewallSection}${hotspotSection}${radiusSection}${pppoeSection}${httpsSyncSection}
:put "PoaFi Setup Completed Successfully!"
${phoneHome}`;
  }

  /**
   * Generates the configuration for the central Linux server (for the Super Admin).
   */
  static generateServerConfig(routerPublicKey: string, routerIp: string) {
    return `
# Add this to your /etc/wireguard/wg0.conf on the PoaFi Central Server
[Peer]
# PoaFi Router
PublicKey = ${routerPublicKey}
AllowedIPs = ${routerIp}/32
`;
  }
}
