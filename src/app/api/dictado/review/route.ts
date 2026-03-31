import { NextResponse } from 'next/server';

interface LTMatch {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; description: string; category: { id: string; name: string } };
}

async function checkSpelling(text: string): Promise<{ corrected: string; corrections: string[] }> {
  if (!text.trim()) return { corrected: text, corrections: [] };

  try {
    // LanguageTool API pública — corrector real, gratuito, sin API key
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        text,
        language: 'es',
        enabledOnly: 'false',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`LanguageTool HTTP ${res.status}`);

    const data = await res.json();
    const matches: LTMatch[] = data.matches || [];

    if (matches.length === 0) return { corrected: text, corrections: [] };

    // Aplicar correcciones de atrás hacia adelante para no romper offsets
    let corrected = text;
    const corrections: string[] = [];

    const sorted = [...matches]
      .filter(m => m.replacements.length > 0)
      .sort((a, b) => b.offset - a.offset);

    for (const match of sorted) {
      const original = corrected.substring(match.offset, match.offset + match.length);
      const replacement = match.replacements[0].value;
      
      if (original !== replacement) {
        corrected = corrected.substring(0, match.offset) + replacement + corrected.substring(match.offset + match.length);
        corrections.push(`"${original}" → "${replacement}"`);
      }
    }

    return { corrected, corrections: corrections.reverse() };
  } catch (error) {
    console.error('[LanguageTool Error]', error);
    return { corrected: text, corrections: [] };
  }
}

export async function POST(request: Request) {
  try {
    const { sections, patientMetadata } = await request.json();

    // Corregir cada sección independientemente
    const [techResult, histResult, findResult, imprResult] = await Promise.all([
      checkSpelling(sections.technique || ''),
      checkSpelling(sections.history || ''),
      checkSpelling(sections.findings || ''),
      checkSpelling(sections.impression || ''),
    ]);

    const allCorrections = [
      ...techResult.corrections.map(c => `[Técnica] ${c}`),
      ...histResult.corrections.map(c => `[Antecedentes] ${c}`),
      ...findResult.corrections.map(c => `[Hallazgos] ${c}`),
      ...imprResult.corrections.map(c => `[Impresión] ${c}`),
    ];

    const correctedSections = {
      technique: techResult.corrected,
      history: histResult.corrected,
      findings: findResult.corrected,
      impression: imprResult.corrected,
    };

    // Detección de alertas de seguridad clínica
    const alerts: string[] = [];
    const fullText = Object.values(sections).join(' ').toLowerCase();

    if (patientMetadata.studyDescription?.toLowerCase().includes('derecho') && fullText.includes('izquierdo')) {
      alerts.push("⚠️ LATERALIDAD: El estudio indica lado DERECHO pero el informe menciona IZQUIERDO.");
    }
    if (patientMetadata.studyDescription?.toLowerCase().includes('izquierdo') && fullText.includes('derecho')) {
      alerts.push("⚠️ LATERALIDAD: El estudio indica lado IZQUIERDO pero el informe menciona DERECHO.");
    }
    if (patientMetadata.sex === 'M' && (fullText.includes('paciente femenina') || fullText.includes('útero') || fullText.includes('ovario'))) {
      alerts.push("⚠️ GÉNERO: Paciente MASCULINO pero se detectan términos femeninos.");
    }
    if (patientMetadata.sex === 'F' && (fullText.includes('paciente masculino') || fullText.includes('próstata'))) {
      alerts.push("⚠️ GÉNERO: Paciente FEMENINO pero se detectan términos masculinos.");
    }

    const criticalTerms = ['neumotórax', 'neumotorax', 'hemorragia', 'tromboembolismo', 'infarto', 'disección', 'diseccion', 'hernia cerebral'];
    for (const term of criticalTerms) {
      if (fullText.includes(term)) {
        alerts.push(`🚨 HALLAZGO CRÍTICO: Se detecta "${term.toUpperCase()}" — considere activar protocolo de urgencia.`);
      }
    }

    const hasChanges = allCorrections.length > 0;
    const suggestion = hasChanges
      ? `Se encontraron ${allCorrections.length} corrección(es): ${allCorrections.join('; ')}`
      : 'Ortografía y gramática sin errores detectados.';

    return NextResponse.json({
      alerts,
      suggestion,
      correctedSections: hasChanges ? correctedSections : null,
      corrections: allCorrections,
      isSafe: alerts.length === 0,
    });

  } catch (error) {
    console.error('[AI Review Error]', error);
    return NextResponse.json({
      alerts: [],
      suggestion: "Error de conexión con el corrector. Intente nuevamente.",
      correctedSections: null,
      corrections: [],
      isSafe: true,
    }, { status: 500 });
  }
}
