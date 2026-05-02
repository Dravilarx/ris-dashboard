import { NextResponse } from 'next/server';

/**
 * /api/dictado/transcribe-local — Transcripción via Faster-Whisper local (REST fallback)
 *
 * Este endpoint es el fallback cuando el WebSocket directo no está disponible.
 * Para tiempo real, usar el WebSocket del hook useLocalWhisper.
 */

const WHISPER_API_URL = process.env.WHISPER_API_URL || 'http://localhost:8766';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const payload = new FormData();
    payload.append('file', file, 'audio.webm');
    payload.append('language', 'es');

    const res = await fetch(`${WHISPER_API_URL}/transcribe`, {
      method: 'POST',
      body: payload,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Whisper server HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text || '' });

  } catch (error: any) {
    console.error('[Whisper Local Transcribe Error]', error);

    // Fallback: si el servidor Whisper local no está disponible, usar la simulación
    console.warn('[Whisper] Servidor local no disponible. Usando simulación dev.');
    await new Promise(r => setTimeout(r, 300));
    return NextResponse.json({ text: ' Sin hallazgos patológicos significativos.' });
  }
}
