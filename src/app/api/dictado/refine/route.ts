import { NextResponse } from 'next/server';

/**
 * /api/dictado/refine — Motor AMIS-Voice: Refinado Clínico via Ollama + Gemma 2
 *
 * Modelo exclusivo: gemma2 (Gemma 2 de Google, corriendo en Apple Silicon M2 Pro)
 * Conexión persistente: keep_alive=30m para evitar latencias de carga del modelo
 *
 * System Prompt AMIS oficial para corrección radiológica.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const PRIMARY_MODEL = process.env.OLLAMA_PRIMARY_MODEL || 'gemma2:2b';  // 2B = rápido (~3-5s)
const FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || 'gemma2';    // 9B = fallback de calidad

// ─── SYSTEM PROMPT AMIS OFICIAL ───────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un corrector ortográfico y de estilo para informes radiológicos en español.

REGLAS ESTRICTAS:
1. SOLO corrige ortografía (tildes, errores de transcripción de voz) y puntuación (doble punto, comas faltantes).
2. PRESERVA EXACTAMENTE los saltos de línea (\n) del texto original. Cada hallazgo debe permanecer en su propia línea.
3. NO inventes contenido. Si una sección está vacía o dice "(vacío)", devuélvela como cadena vacía "".
4. NO cambies el diagnóstico ni agregues hallazgos nuevos.
5. NO fusiones líneas separadas en un solo párrafo.
6. Usa terminología radiológica estándar en español.
7. Responde SOLO con JSON válido, sin explicaciones.`;

// ─── Warm-up: pre-carga del modelo al iniciar el servidor ─────────────────────
// Esto mantiene Gemma 2 en memoria GPU (Metal) para respuestas <1s
let modelWarmedUp = false;

async function warmUpModel() {
  if (modelWarmedUp) return;
  try {
    console.info(`[AMIS-Voice] 🔥 Pre-cargando modelo ${PRIMARY_MODEL} en GPU...`);
    await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        prompt: 'Hola',
        stream: false,
        keep_alive: '30m',        // Mantener en VRAM por 30 minutos
        options: { num_predict: 1, num_gpu: 99 },
      }),
      signal: AbortSignal.timeout(60000), // El primer load puede tardar
    });
    modelWarmedUp = true;
    console.info(`[AMIS-Voice] ✅ Modelo ${PRIMARY_MODEL} cargado en GPU Metal — listo para <1s`);
  } catch (e: any) {
    console.warn(`[AMIS-Voice] ⚠️ Warm-up falló (Ollama podría no estar corriendo):`, e.message);
  }
}

// Ejecutar warm-up automáticamente al importar el módulo
warmUpModel();

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SectionInput {
  technique: string;
  history: string;
  findings: string;
  impression: string;
}

// ─── Llamada a Ollama ─────────────────────────────────────────────────────────
async function callOllama(
  model: string,
  sections: SectionInput,
  metadata?: Record<string, string | undefined>
): Promise<{ sections: SectionInput; changes: string[] }> {
  const userPrompt = `Corrige SOLO ortografía y puntuación del siguiente informe. Preserva los saltos de línea. Responde en JSON con claves: technique, history, findings, impression, changes.
Si una sección está vacía, devuelve "".

${metadata?.modality ? `[Modalidad: ${metadata.modality}]` : ''}

TÉCNICA: ${sections.technique || '(vacío)'}

ANTECEDENTES: ${sections.history || '(vacío)'}

HALLAZGOS:
${sections.findings || '(vacío)'}

IMPRESIÓN: ${sections.impression || '(vacío)'}`;

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: userPrompt,
      system: SYSTEM_PROMPT,
      stream: false,
      keep_alive: '30m',
      options: {
        temperature: 0.05,          // Muy baja = solo correcciones mínimas
        top_p: 0.85,
        num_predict: 2048,          // Reducido — solo necesita corregir, no inventar
        num_gpu: 99,
        num_thread: 8,
      },
      format: 'json',
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama ${model} HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const responseText = data.response || '';

  // Parsear JSON de la respuesta
  try {
    const parsed = JSON.parse(responseText);
    return {
      sections: {
        technique: parsed.technique || sections.technique,
        history: parsed.history || sections.history,
        findings: parsed.findings || sections.findings,
        impression: parsed.impression || sections.impression,
      },
      changes: parsed.changes || [],
    };
  } catch {
    // Fallback: extraer JSON incrustado en texto
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sections: {
          technique: parsed.technique || sections.technique,
          history: parsed.history || sections.history,
          findings: parsed.findings || sections.findings,
          impression: parsed.impression || sections.impression,
        },
        changes: parsed.changes || [],
      };
    }
    throw new Error('Ollama no devolvió JSON válido');
  }
}

// ─── POST: Refinar informe ────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { sections, metadata } = await request.json();

    if (!sections) {
      return NextResponse.json({ error: 'Missing sections' }, { status: 400 });
    }

    // Re-warm si el modelo se enfrió
    if (!modelWarmedUp) warmUpModel();

    let result;
    let usedModel = PRIMARY_MODEL;

    try {
      result = await callOllama(PRIMARY_MODEL, sections, metadata);
    } catch (primaryError: any) {
      console.warn(`[AMIS-Voice] Modelo primario ${PRIMARY_MODEL} falló:`, primaryError.message);
      console.info(`[AMIS-Voice] Intentando fallback: ${FALLBACK_MODEL}`);
      usedModel = FALLBACK_MODEL;

      try {
        result = await callOllama(FALLBACK_MODEL, sections, metadata);
      } catch (fallbackError: any) {
        console.error(`[AMIS-Voice] Fallback ${FALLBACK_MODEL} también falló:`, fallbackError.message);
        return NextResponse.json({
          error: 'Ollama no disponible. Verifica que esté corriendo: ollama serve',
          details: fallbackError.message,
        }, { status: 503 });
      }
    }

    return NextResponse.json({
      sections: result.sections,
      model: usedModel,
      changes: result.changes,
    });

  } catch (error: any) {
    console.error('[AMIS-Voice Refine Error]', error);
    return NextResponse.json({
      error: error.message || 'Error interno del motor AMIS-Voice',
    }, { status: 500 });
  }
}

// ─── OPTIONS: Health check + lista de modelos ─────────────────────────────────
export async function OPTIONS() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = data.models?.map((m: any) => m.name) || [];
      const hasGemma = models.some((n: string) => n.startsWith('gemma2'));
      return NextResponse.json({
        status: 'ok',
        models,
        primaryModel: PRIMARY_MODEL,
        gemmaReady: hasGemma,
        warmedUp: modelWarmedUp,
      });
    }
    return NextResponse.json({ status: 'error', message: 'Ollama no responde' }, { status: 503 });
  } catch {
    return NextResponse.json({ status: 'error', message: 'Ollama no accesible en ' + OLLAMA_BASE }, { status: 503 });
  }
}
