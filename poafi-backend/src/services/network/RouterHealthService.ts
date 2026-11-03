import net from 'net';
import { prisma } from '../../config/database';

export class RouterHealthService {
  /**
   * Fast TCP probe to check if router IP and API port are reachable
   */
  static async checkRouterReachability(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      try {
        socket.connect(port, host);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Probe list of routers, update database status in background if changed
   */
  static async verifyAndSyncRouters(routers: Array<{ id: string; host: string; apiPort: number; status: string }>) {
    await Promise.allSettled(
      routers.map(async (r) => {
        const isAlive = await this.checkRouterReachability(r.host, r.apiPort, 1200);
        const expectedStatus = isAlive ? 'ONLINE' : 'OFFLINE';
        if (r.status !== expectedStatus) {
          r.status = expectedStatus;
          await prisma.router.update({
            where: { id: r.id },
            data: { status: expectedStatus },
          });
        }
      })
    );
  }

  /**
   * Background monitor job called every 30-60s
   */
  static startBackgroundMonitor(intervalMs = 30000): NodeJS.Timeout {
    console.log(`⏱️ Router Live Health Monitor started (Interval: ${intervalMs / 1000}s)`);
    return setInterval(async () => {
      try {
        const routers = await prisma.router.findMany({
          select: { id: true, host: true, apiPort: true, status: true },
        });
        await this.verifyAndSyncRouters(routers);
      } catch (err) {
        console.error('[RouterHealthService] Health check failed:', err);
      }
    }, intervalMs);
  }
}

