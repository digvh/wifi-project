import crypto from 'crypto';
import { env } from '../../config/env';

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

  /**
   * Generates the MikroTik RouterOS script to paste into WinBox / Terminal.
   * When `enrollment` is supplied the router also "phones home" with its
   * model, serial number, identity and version so PoaFi can auto-fill the
   * registration form.
   */
  static generateMikroTikScript(
    routerIp: string,
    routerPublicKey: string,
    routerPrivateKey: string,
    routerId: string,
    apiPassword: string,
    enrollment?: { callbackUrl: string; token: string },
  ) {
    const serverEndpoint = env.WG_SERVER_ENDPOINT || 'YOUR_POAFI_SERVER_IP:51820';
    const serverPublicKey = env.WG_SERVER_PUBLIC_KEY || 'YOUR_POAFI_SERVER_WG_PUBLIC_KEY';
    const serverIp = env.WG_SERVER_IP || '10.8.0.1';

    const phoneHome = enrollment
      ? `
# 8. Phone home: report this device to PoaFi so the registration form fills itself
:local pfModel "unknown"
:local pfSerial "unknown"
:do { :set pfModel [/system routerboard get model] } on-error={ :set pfModel [/system resource get board-name] }
:do { :set pfSerial [/system routerboard get serial-number] } on-error={ :set pfSerial "n/a" }
:local pfIdentity [/system identity get name]
:local pfVersion [/system resource get version]
:delay 5s
/tool fetch url="${enrollment.callbackUrl}" mode=https http-method=post http-header-field="Content-Type: application/json,X-Enrollment-Token: ${enrollment.token}" http-data=("{\\"model\\":\\"" . $pfModel . "\\",\\"serial\\":\\"" . $pfSerial . "\\",\\"identity\\":\\"" . $pfIdentity . "\\",\\"version\\":\\"" . $pfVersion . "\\"}") keep-result=no
:put "Device report sent to PoaFi"
`
      : '';

    return `
# =====================================================================
# PoaFi Cloud Setup for Router: ${routerId}
# Paste this script into the MikroTik Terminal (New Terminal in WinBox)
# =====================================================================

# 1. Create the WireGuard Interface
/interface wireguard add name=poafi-cloud listen-port=13231 private-key="${routerPrivateKey}"

# 2. Assign an IP to the WireGuard tunnel
/ip address add address=${routerIp}/24 interface=poafi-cloud

# 3. Add the PoaFi Server as a Peer
/interface wireguard peers add interface=poafi-cloud public-key="${serverPublicKey}" endpoint-address=${serverEndpoint.split(':')[0]} endpoint-port=${serverEndpoint.split(':')[1] || 51820} allowed-address=10.8.0.0/24 persistent-keepalive=25s

# 4. Create a dedicated API user for PoaFi (random password, unique to this router)
/user group add name=poafi-cloud policy=api,read,write,test,ssh
/user add name=poafi-cloud group=poafi-cloud password="${apiPassword}" comment="PoaFi Cloud Managed"

# 5. Enable the API service
/ip service enable api

# 6. Restrict API access to ONLY the PoaFi tunnel server (rules placed first)
/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=${serverIp} action=accept comment="PoaFi Cloud API" place-before=0
/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=drop comment="Block public API access" place-before=1

# 7. Confirm it works
:put "PoaFi Cloud Tunnel Configured Successfully!"
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
