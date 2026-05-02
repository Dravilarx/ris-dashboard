/**
 * useOllamaRefine — Motor AMIS-Voice: Refinado clínico via Gemma 2 local
 *
 * FIX #2: Health check con retry (3 intentos × 5s timeout).
 * Si falla → "Ollama no detectado" en vez de "CARGANDO..." infinito.
 * Keep-alive cada 15 min para mantener Gemma 2 en VRAM Metal.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type RefineState = 'idle' | 'refining' | 'success' | 'error';
export type OllamaStatus = 'unknown' | 'online' | 'offline' | 'warming' | 'not_detected';

export interface RefineResult {
  sections: { technique: string; history: string; findings: string; impression: string };
  model: string;
  durationMs: number;
  changes: string[];
}

export interface UseOllamaRefineReturn {
  refineState: RefineState;
  ollamaStatus: OllamaStatus;
  isRefining: boolean;
  lastResult: RefineResult | null;
  lastError: string | null;
  lastDurationMs: number | null;
  refine: (
    sections: { technique: string; history: string; findings: string; impression: string },
    metadata?: {
      modality?: string;
      studyDescription?: string;
      sex?: string;
      age?: string;
      activeSection?: string;      // Campo del informe activo en el editor
      dictionary?: Array<{ id: string; heard: string; correct: string; section?: string; notes?: string }>;
    }
  ) => Promise<RefineResult | null>;
  checkOllamaHealth: () => Promise<boolean>;
}

// ─── Constantes de retry ──────────────────────────────────────────────────────
const HEALTH_CHECK_TIMEOUT_MS = 5000;   // 5 segundos por intento
const HEALTH_CHECK_MAX_RETRIES = 3;     // 3 intentos máximo
const HEALTH_CHECK_RETRY_DELAY_MS = 2000; // 2s entre reintentos

export function useOllamaRefine(): UseOllamaRefineReturn {
  const [refineState, setRefineState] = useState<RefineState>('idle');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('unknown');
  const [lastResult, setLastResult] = useState<RefineResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // ── Health check con retry — FIX #2 ─────────────────────────────────────────
  const checkOllamaHealth = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    setOllamaStatus('warming');

    for (let attempt = 0; attempt < HEALTH_CHECK_MAX_RETRIES; attempt++) {
      try {
        console.info(`[AMIS-Voice] 🔍 Verificando Ollama (intento ${attempt + 1}/${HEALTH_CHECK_MAX_RETRIES})...`);

        const res = await fetch('/api/dictado/refine', {
          method: 'OPTIONS',
          signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
        });

        if (res.ok) {
          const data = await res.json();
          if (isMountedRef.current) {
            if (data.gemmaReady) {
              setOllamaStatus('online');
              console.info('[AMIS-Voice] ✅ Gemma 2 en línea — GPU lista');
            } else {
              setOllamaStatus('warming');
              console.info('[AMIS-Voice] ⏳ Ollama conectado, esperando modelo Gemma 2...');
            }
          }
          return true;
        }

        // HTTP error pero servidor respondió
        if (res.status === 503) {
          console.warn(`[AMIS-Voice] ⚠️ Ollama no respondió (intento ${attempt + 1})`);
        }
      } catch (e: any) {
        console.warn(`[AMIS-Voice] ❌ Timeout en intento ${attempt + 1}:`, e.message);
      }

      // Esperar antes del siguiente reintento (salvo último intento)
      if (attempt < HEALTH_CHECK_MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, HEALTH_CHECK_RETRY_DELAY_MS));
      }
    }

    // Todos los reintentos fallaron
    if (isMountedRef.current) {
      setOllamaStatus('not_detected');
      console.warn('[AMIS-Voice] 🚫 Ollama no detectado después de 3 intentos. Verifica: ollama serve');
    }
    return false;
  }, []);

  // Al montar: verificar con retry + keep-alive cada 15 min
  useEffect(() => {
    isMountedRef.current = true;
    checkOllamaHealth();

    keepAliveRef.current = setInterval(() => {
      if (isMountedRef.current) checkOllamaHealth();
    }, 15 * 60 * 1000);

    return () => {
      isMountedRef.current = false;
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, [checkOllamaHealth]);

  // ── Refinar ─────────────────────────────────────────────────────────────────
  const refine = useCallback(async (
    sections: { technique: string; history: string; findings: string; impression: string },
    metadata?: {
      modality?: string;
      studyDescription?: string;
      sex?: string;
      age?: string;
      activeSection?: string;
      dictionary?: Array<{ id: string; heard: string; correct: string; section?: string; notes?: string }>;
    }
  ): Promise<RefineResult | null> => {
    const hasText = Object.values(sections).some(v => v.trim().length > 0);
    if (!hasText) { setLastError('No hay texto para refinar.'); return null; }

    setRefineState('refining');
    setLastError(null);
    const t0 = performance.now();

    try {
      const res = await fetch('/api/dictado/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections, metadata, dictionary: metadata?.dictionary }),
        signal: AbortSignal.timeout(65000),  // 65s — dar margen a Gemma 2
      });

      if (!res.ok) { throw new Error(`Gemma 2 HTTP ${res.status}: ${await res.text()}`); }

      const data = await res.json();
      const durationMs = Math.round(performance.now() - t0);
      const result: RefineResult = {
        sections: data.sections,
        model: data.model || 'gemma2',
        durationMs,
        changes: data.changes || [],
      };

      setRefineState('success');
      setLastResult(result);
      setLastDurationMs(durationMs);
      setOllamaStatus('online');
      setTimeout(() => setRefineState('idle'), 3000);
      return result;
    } catch (e: any) {
      const msg = e?.message || 'Error al refinar con Gemma 2';
      setRefineState('error');
      setLastError(msg);
      setLastDurationMs(Math.round(performance.now() - t0));
      setTimeout(() => setRefineState('idle'), 5000);
      return null;
    }
  }, []);

  return {
    refineState,
    ollamaStatus,
    isRefining: refineState === 'refining',
    lastResult,
    lastError,
    lastDurationMs,
    refine,
    checkOllamaHealth,
  };
}
