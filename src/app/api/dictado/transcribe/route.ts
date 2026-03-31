import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const amisVoiceUrl = process.env.AMIS_VOICE_URL;
    const internalApiKey = process.env.AMIS_INTERNAL_API_KEY;

    if (!amisVoiceUrl || !internalApiKey || amisVoiceUrl.includes('tu-proyecto-amis')) {
      console.warn("Falta configuración real de AMIS_VOICE. Usando simulación de transcripción de desarrollo.");
      
      // Simulación rápida para modo dev sin URL configurada
      await new Promise(r => setTimeout(r, 800)); 
      return NextResponse.json({ text: " Sin hallazgos patológicos significativos." });
    }

    const payload = new FormData();
    payload.append('file', file, 'audio.webm');

    // Forward the audio to AMIS 3.0 Voice Engine directly
    const amisRes = await fetch(amisVoiceUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${internalApiKey}`,
      },
      body: payload
    });

    if (!amisRes.ok) {
      const errorText = await amisRes.text();
      throw new Error(`AMIS Voice Engine error: ${errorText}`);
    }

    const data = await amisRes.json();
    return NextResponse.json({ text: data.text });

  } catch (error) {
    console.error('[AMIS Voice Forwarding Error]', error);
    return NextResponse.json({ error: 'Failed to transcribe audio via AMIS 3.0' }, { status: 500 });
  }
}
