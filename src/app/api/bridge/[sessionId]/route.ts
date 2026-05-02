import { NextRequest, NextResponse } from 'next/server';

// In-memory bridge store (shared across API routes via module scope)
const bridgeSessions: Map<string, {
  text: string;
  connected: boolean;
  lastUpdate: number;
}> = (globalThis as any).__bridgeSessions ??= new Map();

// POST: Mobile sends text
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();
  const text = body.text ?? '';

  bridgeSessions.set(sessionId, {
    text,
    connected: true,
    lastUpdate: Date.now(),
  });

  return NextResponse.json({ ok: true });
}

// GET: PC polls for text
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = bridgeSessions.get(sessionId);

  if (session) {
    return NextResponse.json({
      text: session.text,
      connected: session.connected,
      lastUpdate: session.lastUpdate,
    });
  }

  return NextResponse.json({
    text: '',
    connected: false,
    lastUpdate: 0,
  });
}
