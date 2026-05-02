import { NextResponse } from 'next/server';

/**
 * /api/dictado/refine — Motor AMIS-Voice: Refinado Clínico via Ollama + Gemma 2
 *
 * v2.0 — Árbitro Anatómico + Diccionario de Aprendizaje + Limpieza de Ruido
 * Modelo exclusivo: gemma2 (corriendo en Apple Silicon M2 Pro)
 * Sistema: Experto en radiología con español chileno (seseo, confusión B/V)
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const PRIMARY_MODEL = process.env.OLLAMA_PRIMARY_MODEL || 'gemma2:2b';
const FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || 'gemma2';

// ─── Árbitro Anatómico (System Prompt permanente) ─────────────────────────────
const SYSTEM_PROMPT = `Eres el motor de corrección del sistema AMIS 2030, especializado en informes radiológicos en español chileno.

ÁRBITRO ANATÓMICO — Reglas de desambiguación (seseo y confusión B/V chilena):

REGLA BAZO/VASO:
- Si el texto menciona: páncreas, abdomen, hígado, hilio, esplénico, retroperitoneo, esplenomegalia, ascitis, porta, celíaco → "vaso" es "bazo" (órgano, B y Z).
- Si el texto menciona: doppler, flujo, extremidades, carótida, fístula, arteria, vena, aorta, femoral, iliaco → "vaso" es "vaso" (conducto vascular, V y S).

OTRAS REGLAS:
- "bolsa" en contexto cardíaco → posiblemente "válvula"
- "sesgo" en contexto cerebral → posiblemente "septo"
- Prefijos sub-: subpleural, subcutáneo (nunca "sup-")
- Abreviaturas intocables: TC, RM, RX, ECO, AP, PA, EVP, HTA, DM2, BIRADS, EPOC

NORMALIZACIÓN NUMÉRICA — Reglas estrictas de cifras y unidades:
- NUNCA escribas medidas con letras. Siempre usa dígitos: "3.5 cm" (nunca "tres coma cinco centímetros").
- Unidades de densidad: SIEMPRE "UH" en mayúsculas y sin espacio con el número: "45 UH" (nunca "45 uh", "45 U.H." ni "cuarenta y cinco unidades Hounsfield").
- Porcentajes: siempre dígito + símbolo: "35%" (nunca "treinta y cinco por ciento").
- Medidas lineales: número + espacio + unidad: "12 mm", "3.5 cm", "1.2 cm".
- Volúmenes: "120 ml", "1.5 L".
- Presión: "120 mmHg".
- Escalas clínicas (BIRADS, PIRADS, TI-RADS): número entero adherido: "BIRADS 4", "PIRADS 3".
- Si el texto dice "cuatro punto cinco centímetros", conviértelo a "4.5 cm".
- Decimales: usa coma solo si el texto original la usa, preferentemente punto para consistencia clínica.

LIMPIEZA DE RUIDO DE DICTADO POR VOZ:
- Elimina muletillas: "este...", "mmm", "o sea", "ya", "eh", "aah", "bueno entonces", "entonces..."
- Elimina repeticiones accidentales: si una palabra o frase corta aparece dos veces seguidas, conserva solo una.
- Ajusta puntuación clínica: listas de hallazgos terminan en punto. Frases largas sin punto deben cerrarse.
- NO inventes hallazgos. NO cambies diagnósticos. NO fusiones líneas separadas.
- Si una sección está vacía, devuélvela como cadena vacía "".
- Responde SOLO con JSON válido sin explicaciones extra.`;

// ─── Warm-up ──────────────────────────────────────────────────────────────────
let modelWarmedUp = false;

async function warmUpModel() {
  if (modelWarmedUp) return;
  try {
    console.info(`[AMIS-Voice] 🔥 Pre-cargando ${PRIMARY_MODEL} en GPU...`);
    await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        prompt: 'Hola',
        stream: false,
        keep_alive: '30m',
        options: { num_predict: 1, num_gpu: 99 },
      }),
      signal: AbortSignal.timeout(60000),
    });
    modelWarmedUp = true;
    console.info(`[AMIS-Voice] ✅ ${PRIMARY_MODEL} cargado en GPU Metal`);
  } catch (e: any) {
    console.warn(`[AMIS-Voice] ⚠️ Warm-up falló:`, e.message);
  }
}

warmUpModel();

// ─── Types ────────────────────────────────────────────────────────────────────
interface SectionInput {
  technique: string;
  history: string;
  findings: string;
  impression: string;
}

interface DictionaryEntry {
  id: string;
  heard: string;
  correct: string;
  section?: string;
  contextKeywords?: string; // Palabras clave que condicionan la corrección
  notes?: string;
}

// ─── Build user prompt with dictionary + context metadata ─────────────────────
function buildUserPrompt(
  sections: SectionInput,
  metadata?: Record<string, string | undefined>,
  dictionary?: DictionaryEntry[]
): string {
  const parts: string[] = [];

  // Context header
  const ctxParts: string[] = [];
  if (metadata?.modality) ctxParts.push(`Modalidad: ${metadata.modality}`);
  if (metadata?.studyDescription) ctxParts.push(`Examen: ${metadata.studyDescription}`);
  if (metadata?.sex) ctxParts.push(`Sexo: ${metadata.sex}`);
  if (metadata?.age) ctxParts.push(`Edad: ${metadata.age}`);
  if (metadata?.activeSection) {
    const labels: Record<string, string> = {
      technique: 'Técnica de Estudio',
      history: 'Antecedentes',
      findings: 'Hallazgos',
      impression: 'Impresión Diagnóstica',
    };
    ctxParts.push(`Campo activo: ${labels[metadata.activeSection] || metadata.activeSection}`);
  }
  if (ctxParts.length) parts.push(`[${ctxParts.join(' | ')}]`);

  // Learning dictionary — context-aware injection
  if (dictionary && dictionary.length > 0) {
    const activeSection = metadata?.activeSection;
    const applicable = dictionary.filter(e => !e.section || e.section === activeSection);

    if (applicable.length > 0) {
      const lines = applicable.map(e => {
        let rule = `  • "${e.heard}" → "${e.correct}"`;
        if (e.contextKeywords) {
          rule += ` [SOLO si el texto contiene: ${e.contextKeywords}]`;
        }
        if (e.notes) rule += ` (${e.notes})`;
        return rule;
      });
      parts.push(
        `DICCIONARIO DE CORRECCIÓN PERSONALIZADO (prioridad máxima):\n` +
        `  — Si la regla tiene condición [SOLO si...], aplícala únicamente cuando esas palabras aparezcan en el mismo campo.\n` +
        `  — Si no tiene condición, aplícala siempre.\n` +
        lines.join('\n')
      );
    }
  }

  parts.push(
    `Corrige ortografía, puntuación y limpia ruido de voz. Usa el contexto anatómico para desambiguar.`,
    `Devuelve SOLO JSON con claves: technique, history, findings, impression, changes (array de correcciones aplicadas).`,
    ``,
    `TÉCNICA: ${sections.technique || '(vacío)'}`,
    ``,
    `ANTECEDENTES: ${sections.history || '(vacío)'}`,
    ``,
    `HALLAZGOS:\n${sections.findings || '(vacío)'}`,
    ``,
    `IMPRESIÓN: ${sections.impression || '(vacío)'}`
  );

  return parts.join('\n');
}

// ─── Llamada a Ollama ─────────────────────────────────────────────────────────
async function callOllama(
  model: string,
  sections: SectionInput,
  metadata?: Record<string, string | undefined>,
  dictionary?: DictionaryEntry[]
): Promise<{ sections: SectionInput; changes: string[] }> {
  const userPrompt = buildUserPrompt(sections, metadata, dictionary);

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
        temperature: 0.05,
        top_p: 0.85,
        num_predict: 2048,
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

  const tryParse = (text: string) => {
    const parsed = JSON.parse(text);
    return {
      sections: {
        technique:  parsed.technique  ?? sections.technique,
        history:    parsed.history    ?? sections.history,
        findings:   parsed.findings   ?? sections.findings,
        impression: parsed.impression ?? sections.impression,
      },
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    };
  };

  try {
    return tryParse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return tryParse(jsonMatch[0]);
    throw new Error('Ollama no devolvió JSON válido');
  }
}

// ─── POST: Refinar informe ────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { sections, metadata, dictionary } = await request.json();

    if (!sections) {
      return NextResponse.json({ error: 'Missing sections' }, { status: 400 });
    }

    if (!modelWarmedUp) warmUpModel();

    let result;
    let usedModel = PRIMARY_MODEL;

    try {
      result = await callOllama(PRIMARY_MODEL, sections, metadata, dictionary);
    } catch (primaryError: any) {
      console.warn(`[AMIS-Voice] Modelo primario ${PRIMARY_MODEL} falló:`, primaryError.message);
      usedModel = FALLBACK_MODEL;

      try {
        result = await callOllama(FALLBACK_MODEL, sections, metadata, dictionary);
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

// ─── OPTIONS: Health check ────────────────────────────────────────────────────
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
