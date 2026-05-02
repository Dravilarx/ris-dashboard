import { NextResponse } from 'next/server';
import os from 'os';

/**
 * GET /api/network-info
 * Retorna la IP local del Mac para que el QR apunte a la red local.
 */
export async function GET() {
  const interfaces = os.networkInterfaces();
  let localIp = '192.168.1.100'; // fallback

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      // IPv4, no interna, preferir en0 (WiFi) o en1 (Ethernet)
      if (addr.family === 'IPv4' && !addr.internal) {
        localIp = addr.address;
        // Preferir interfaces principales
        if (name === 'en0' || name === 'en1') {
          return NextResponse.json({ ip: localIp, interface: name });
        }
      }
    }
  }

  return NextResponse.json({ ip: localIp, interface: 'auto' });
}
