/**
 * useVocalisDictation — Hook de dictado médico profesional (Vocalis / Inbox Medical)
 *
 * Arquitectura de seguridad:
 * - El SDK se carga en un Worker/async no bloqueante para no interferir con el hilo principal.
 * - Todos los errores de conexión son silenciosos (console.warn, no alerts).
 * - El estado 'isReady' refleja si Vocalis está disponible; si no lo está, la UI cae a Micrófono Móvil.
 * - Las credenciales se leen de variables de entorno (nunca hardcodeadas).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Tipos del SDK de Vocalis ─────────────────────────────────────────────────
// Estos tipos siguen la firma estándar del SDK de Inbox Medical / Vocalis.
// Ajustar si la documentación del SDK indica nombres distintos.
interface VocalisSDK {
  init: (config: VocalisConfig) => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  logout: () => void;
  on: (event: VocalisEvent, callback: (data: any) => void) => void;
  off: (event: VocalisEvent, callback: (data: any) => void) => void;
  getStatus: () => VocalisStatus;
}

interface VocalisConfig {
  user: string;
  password: string;
  language?: string;
  autoConnect?: boolean;
}

type VocalisEvent =
  | 'ready'          // SDK autenticado y listo
  | 'text'           // Texto transcrito disponible
  | 'interim'        // Texto parcial (en tiempo real)
  | 'error'          // Error de conexión/autenticación
  | 'listening'      // Micrófono activo
  | 'stopped'        // Micrófono detenido
  | 'disconnected';  // Sesión terminada

type VocalisStatus = 'idle' | 'ready' | 'listening' | 'paused' | 'error' | 'disconnected';

// ─── Tipos del hook ───────────────────────────────────────────────────────────
export type VocalisState = 'disconnected' | 'connecting' | 'ready' | 'listening' | 'paused' | 'error';

export interface UseVocalisDictationProps {
  onTranscriptionSuccess: (text: string) => void;
  onInterimText?: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VocalisState) => void;
}

export interface UseVocalisDictationReturn {
  vState: VocalisState;
  isListening: boolean;
  isReady: boolean;
  interimText: string;
  toggleVocalis: () => void;
  pauseVocalis: () => void;
  resumeVocalis: () => void;
  reconnect: () => void;
}

// ─── Carga dinámica del SDK (no-bloqueante) ───────────────────────────────────
let sdkSingleton: VocalisSDK | null = null;
let sdkLoadPromise: Promise<VocalisSDK | null> | null = null;

async function loadVocalisSDK(): Promise<VocalisSDK | null> {
  if (sdkSingleton) return sdkSingleton;
  if (sdkLoadPromise) return sdkLoadPromise;

  const sdkUrl = process.env.NEXT_PUBLIC_VOCALIS_SDK_URL;

  if (!sdkUrl || sdkUrl === 'PENDIENTE') {
    console.warn('[Vocalis] SDK URL no configurada en NEXT_PUBLIC_VOCALIS_SDK_URL. Sistema en modo contingencia.');
    return null;
  }

  sdkLoadPromise = new Promise<VocalisSDK | null>((resolve) => {
    try {
      // Detecta si es un módulo ES o un script global
      const isModule = sdkUrl.endsWith('.mjs') || sdkUrl.includes('type=module');

      if (isModule) {
        // Importación dinámica de módulo — no bloquea el hilo
        import(/* webpackIgnore: true */ sdkUrl)
          .then((mod) => {
            const sdk = mod?.default || mod?.VocalisSDK || mod;
            sdkSingleton = sdk as VocalisSDK;
            resolve(sdkSingleton);
          })
          .catch((e) => {
            console.warn('[Vocalis] Error importando módulo SDK:', e);
            resolve(null);
          });
      } else {
        // Script global — inyectar en <head>
        const existing = document.querySelector(`script[data-vocalis-sdk]`);
        if (existing) {
          // Script ya inyectado, esperar a que el global esté disponible
          const poll = setInterval(() => {
            const g = (window as any).VocalisSDK || (window as any).Vocalis;
            if (g) {
              clearInterval(poll);
              sdkSingleton = g as VocalisSDK;
              resolve(sdkSingleton);
            }
          }, 150);
          // Timeout de seguridad: 10 segundos
          setTimeout(() => {
            clearInterval(poll);
            if (!sdkSingleton) {
              console.warn('[Vocalis] Timeout esperando SDK global después de 10s.');
              resolve(null);
            }
          }, 10000);
          return;
        }

        const script = document.createElement('script');
        script.src = sdkUrl;
        script.async = true;
        script.defer = true;
        script.setAttribute('data-vocalis-sdk', 'true');

        script.onload = () => {
          // Espera al global (el SDK puede declararse asíncronamente)
          const poll = setInterval(() => {
            const g = (window as any).VocalisSDK || (window as any).Vocalis;
            if (g) {
              clearInterval(poll);
              sdkSingleton = g as VocalisSDK;
              resolve(sdkSingleton);
            }
          }, 150);
          setTimeout(() => {
            clearInterval(poll);
            if (!sdkSingleton) {
              console.warn('[Vocalis] SDK cargado pero global no encontrado. Revisa el nombre del objeto global.');
              resolve(null);
            }
          }, 5000);
        };

        script.onerror = (e) => {
          console.warn('[Vocalis] Error cargando script SDK:', e);
          resolve(null);
        };

        document.head.appendChild(script);
      }
    } catch (e) {
      console.warn('[Vocalis] Error inesperado cargando SDK:', e);
      resolve(null);
    }
  });

  return sdkLoadPromise;
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useVocalisDictation({
  onTranscriptionSuccess,
  onInterimText,
  onError,
  onStateChange,
}: UseVocalisDictationProps): UseVocalisDictationReturn {
  const [vState, setVState] = useState<VocalisState>('connecting');
  const [interimText, setInterimText] = useState('');
  const sdkRef = useRef<VocalisSDK | null>(null);
  const isMountedRef = useRef(true);

  const updateState = useCallback(
    (newState: VocalisState) => {
      if (!isMountedRef.current) return;
      setVState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  // ── Handlers del SDK ────────────────────────────────────────────────────────
  const handleReady = useCallback(() => {
    console.info('[Vocalis] ✅ Conectado y listo para escuchar.');
    updateState('ready');
  }, [updateState]);

  const handleText = useCallback(
    (data: { text?: string } | string) => {
      const text = typeof data === 'string' ? data : data?.text || '';
      if (text.trim()) {
        setInterimText('');
        onTranscriptionSuccess(text);
      }
    },
    [onTranscriptionSuccess]
  );

  const handleInterim = useCallback(
    (data: { text?: string } | string) => {
      const text = typeof data === 'string' ? data : data?.text || '';
      setInterimText(text);
      onInterimText?.(text);
    },
    [onInterimText]
  );

  const handleError = useCallback(
    (err: any) => {
      const msg = err?.message || err?.toString() || 'Error de conexión Vocalis';
      console.warn('[Vocalis] Error silencioso:', msg);
      updateState('error');
      // NO se usa alert() — silencioso para no interrumpir al médico
    },
    [updateState]
  );

  const handleListening = useCallback(() => updateState('listening'), [updateState]);
  const handleStopped = useCallback(() => updateState('ready'), [updateState]);
  const handleDisconnected = useCallback(() => updateState('disconnected'), [updateState]);

  // ── Inicialización ──────────────────────────────────────────────────────────
  const initVocalis = useCallback(async () => {
    updateState('connecting');

    const sdk = await loadVocalisSDK();
    if (!sdk || !isMountedRef.current) {
      updateState('error');
      return;
    }

    sdkRef.current = sdk;

    // Registrar listeners ANTES de init para no perder eventos tempranos
    sdk.on('ready', handleReady);
    sdk.on('text', handleText);
    sdk.on('interim', handleInterim);
    sdk.on('error', handleError);
    sdk.on('listening', handleListening);
    sdk.on('stopped', handleStopped);
    sdk.on('disconnected', handleDisconnected);

    try {
      await sdk.init({
        user: process.env.NEXT_PUBLIC_VOCALIS_USER || '',
        password: process.env.NEXT_PUBLIC_VOCALIS_PASS || '',
        language: 'es-CL',
        autoConnect: true,
      });
    } catch (e) {
      // init() puede rechazar si las credenciales son inválidas
      console.warn('[Vocalis] init() falló silenciosamente:', e);
      updateState('error');
    }
  }, [handleReady, handleText, handleInterim, handleError, handleListening, handleStopped, handleDisconnected, updateState]);

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    // Carga asíncrona — no bloquea el render
    initVocalis();

    return () => {
      isMountedRef.current = false;
      const sdk = sdkRef.current;
      if (sdk) {
        try {
          sdk.off('ready', handleReady);
          sdk.off('text', handleText);
          sdk.off('interim', handleInterim);
          sdk.off('error', handleError);
          sdk.off('listening', handleListening);
          sdk.off('stopped', handleStopped);
          sdk.off('disconnected', handleDisconnected);
          sdk.logout();
        } catch (e) {
          // Silencioso en desmontaje
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Acciones públicas ────────────────────────────────────────────────────────
  const toggleVocalis = useCallback(() => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    if (vState === 'listening') {
      sdk.stopListening();
    } else if (vState === 'ready' || vState === 'paused') {
      sdk.startListening();
    }
  }, [vState]);

  const pauseVocalis = useCallback(() => {
    sdkRef.current?.pauseListening?.();
    updateState('paused');
  }, [updateState]);

  const resumeVocalis = useCallback(() => {
    sdkRef.current?.resumeListening?.();
    updateState('listening');
  }, [updateState]);

  const reconnect = useCallback(() => {
    sdkSingleton = null;
    sdkLoadPromise = null;
    initVocalis();
  }, [initVocalis]);

  return {
    vState,
    isListening: vState === 'listening',
    isReady: vState === 'ready' || vState === 'listening' || vState === 'paused',
    interimText,
    toggleVocalis,
    pauseVocalis,
    resumeVocalis,
    reconnect,
  };
}
