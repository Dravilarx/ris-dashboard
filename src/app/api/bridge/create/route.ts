import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Create a new bridge session
export async function POST() {
  const sessionId = crypto.randomBytes(6).toString('hex');

  // Initialize session in shared store
  const store: Map<string, any> = (globalThis as any).__bridgeSessions ??= new Map();
  store.set(sessionId, {
    text: '',
    connected: false,
    lastUpdate: Date.now(),
  });

  return NextResponse.json({ sessionId });
}
