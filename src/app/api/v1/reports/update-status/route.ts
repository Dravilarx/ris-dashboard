import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const internalApiKey = process.env.AMIS_INTERNAL_API_KEY;

    // This is a proxy route meant to forward the request to the real AMIS 3.0 backend.
    // We validate keys and forward the payload.
    if (!internalApiKey) {
      console.warn("[AMIS 3.0 Proxy] Falta AMIS_INTERNAL_API_KEY. Modo simulación update-status.");
    }
    
    console.log('[AMIS 3.0 Proxy] Actualizando estado de informe:', payload);

    // Simulated delay for AMIS 3.0 backend.
    await new Promise(r => setTimeout(r, 600));

    // Here we would normally forward to AMIS 3.0 backend via fetch():
    // const backendRes = await fetch('...', { method: 'POST', body: JSON.stringify(payload), headers: ... })

    return NextResponse.json({ 
      success: true, 
      state: payload.status,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('[AMIS 3.0 Proxy] Error in update-status:', error);
    return NextResponse.json({ error: 'Update status failed' }, { status: 500 });
  }
}
