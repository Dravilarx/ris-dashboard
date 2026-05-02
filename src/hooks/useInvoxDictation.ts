/**
 * useInvoxDictation — Hook de dictado médico profesional (Invox Medical SDK v2.8)
 *
 * API real del SDK (objeto global INVOX):
 * - INVOX.Login(credentials, connectionConfig)  → Promise
 * - INVOX.Logout()                              → Promise
 * - INVOX.SetDictationRunning()                 → Activa el micrófono
 * - INVOX.SetDictationPaused()                  → Pausa el micrófono
 * - INVOX.SwitchDictation()                     → Toggle activo/pausado
 * - INVOX.SetWriterTarget(htmlElement)          → Fija el campo de destino
 * - INVOX.SetTextWriter(INVOX.TextAreaTextWriter) → Usa el writer de textarea
 * - document.addEventListener(INVOX.eventTypeReport.LOGIN_SUCCESS, ...)
 * - document.addEventListener(INVOX.eventTypeReport.LOGIN_ERROR, ...)
 * - INVOX.OnStartedRecognizer(fn)               → Micrófono activo
 * - INVOX.OnPausedRecognizer(fn)                → Micrófono pausado
 * - INVOX.OnRunningRecognizer(fn)               → Dictado en curso
 * - INVOX.OnChangeVisorHypothesis(fn)           → Texto parcial/reconocido
 *
 * Arquitectura de seguridad:
 * - El script se inyecta en <head> de forma asíncrona (no bloquea render).
 * - Todos los errores de conexión son silenciosos (console.warn, sin alert).
 * - El WriterTarget se actualiza en cada section activa para que Invox
 *   escriba directamente en el textarea correcto.
 * - Si el SDK no está disponible, la UI cae a "Micrófono Móvil" (contingencia).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Declaración del global INVOX ──────────────────────────────────────────────
declare global {
  interface Window {
    INVOX?: InvoxSDK;
  }
}

interface InvoxCredentials {
  user: string;
  password: string;
}

interface InvoxConnectionConfig {
  host: string;
  port: string | number;
  useDictationService: boolean; // true = remote, false = local agent
}

interface InvoxSDK {
  Login: (credentials: InvoxCredentials, config: InvoxConnectionConfig) => Promise<void>;
  Logout: () => Promise<void>;
  SetDictationRunning: () => void;
  SetDictationPaused: () => void;
  SwitchDictation: () => void;
  SetWriterTarget: (element: HTMLElement) => void;
  SetTextWriter: (writer: any) => void;
  TextAreaTextWriter: any;
  GetCurrentSession: () => { State: string };
  GetMicrophoneName: () => string;
  OnStartedRecognizer: (fn: () => void) => void;
  OnPausedRecognizer: (fn: () => void) => void;
  OnRunningRecognizer: (fn: () => void) => void;
  OnChangeVisorHypothesis: (fn: (msg: string, eventType: any) => void) => void;
  OnGrantedAudioSource: (fn: () => void) => void;
  OnDeniedAudioSource: (fn: () => void) => void;
  OnChangeProgressBar: (fn: (msg: { Percent: number; Description?: string }) => void) => void;
  OnFinishProgressBar: (fn: () => void) => void;
  CustomizeComponents: (fn: () => void) => void;
  eventTypeReport: {
    LOGIN_SUCCESS: string;
    LOGIN_ERROR: string;
    NOT_CUSTOMIZED_COMPONENTS: string;
  };
  dictationEventType: {
    ACCEPTED: any;
    REJECTED: any;
    PARTIAL: any;
    COMMAND: any;
    MACRO: any;
  };
  MessageType: {
    ERROR: string;
    INFO: string;
    SUCCESS: string;
    WARNING: string;
  };
  productName: string;
  webNavigator: string;
  sessionState: { DISCONNECTED: string };
}

// ─── Estado del hook ──────────────────────────────────────────────────────────
export type InvoxState =
  | 'loading'       // Cargando el script SDK
  | 'connecting'    // SDK cargado, ejecutando Login()
  | 'ready'         // Login OK, micrófono pausado — listo para escuchar
  | 'listening'     // Dictando activamente
  | 'paused'        // Pausado manualmente
  | 'error'         // Error de conexión/auth
  | 'unavailable';  // SDK no pudo cargarse

export interface UseInvoxDictationProps {
  /** Sección activa del informe — el WriterTarget se actualiza automáticamente */
  activeTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Callback cuando llega texto final reconocido (para insertar en cursor) */
  onTranscriptionSuccess: (text: string) => void;
  /** Callback cuando llega hipótesis parcial (texto en tiempo real) */
  onInterimText?: (text: string) => void;
  /** Progreso del login (0–100) */
  onLoginProgress?: (percent: number, description?: string) => void;
}

export interface UseInvoxDictationReturn {
  invoxState: InvoxState;
  isListening: boolean;
  isReady: boolean;
  isLoadingOrConnecting: boolean;
  interimText: string;
  loginProgress: number;
  micName: string;
  micPermission: 'unknown' | 'granted' | 'denied';
  toggleInvox: () => void;
  reconnect: () => void;
}

// ─── Singleton del script (evitar doble inyección) ────────────────────────────
let scriptLoadPromise: Promise<boolean> | null = null;

function loadInvoxScript(): Promise<boolean> {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<boolean>((resolve) => {
    // Ya cargado
    if (typeof window !== 'undefined' && window.INVOX) {
      resolve(true);
      return;
    }

    const existing = document.querySelector('script[data-invox-sdk]');
    if (existing) {
      // Esperar a que el global aparezca
      pollForINVOX(resolve);
      return;
    }

    const script = document.createElement('script');
    script.src = '/invox-sdk/libs/invox.min.js';
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-invox-sdk', 'true');

    script.onload = () => pollForINVOX(resolve);
    script.onerror = () => {
      console.warn('[Invox Medical] Error cargando invox.min.js desde /invox-sdk/libs/invox.min.js');
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

function pollForINVOX(resolve: (v: boolean) => void) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window.INVOX) {
      clearInterval(interval);
      resolve(true);
    } else if (attempts > 80) { // ~12 segundos
      clearInterval(interval);
      console.warn('[Invox Medical] Timeout: INVOX global no encontrado después de 12s.');
      resolve(false);
    }
  }, 150);
}

// ─── Hook principal ────────────────────────────────────────────────────────────
export function useInvoxDictation({
  activeTextareaRef,
  onTranscriptionSuccess,
  onInterimText,
  onLoginProgress,
}: UseInvoxDictationProps): UseInvoxDictationReturn {
  const [invoxState, setInvoxState] = useState<InvoxState>('loading');
  const [interimText, setInterimText] = useState('');
  const [loginProgress, setLoginProgress] = useState(0);
  const [micName, setMicName] = useState('');
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);
  const onLoginSuccessRef = useRef<((e: Event) => void) | null>(null);
  const onLoginErrorRef  = useRef<((e: Event) => void) | null>(null);

  const safeSetState = useCallback((state: InvoxState) => {
    if (isMountedRef.current) setInvoxState(state);
  }, []);

  // ── Configurar WriterTarget cuando el textarea activo cambia ─────────────────
  useEffect(() => {
    if (!window.INVOX || invoxState !== 'ready' && invoxState !== 'listening' && invoxState !== 'paused') return;
    const el = activeTextareaRef.current;
    if (!el) return;
    try {
      window.INVOX.SetTextWriter(window.INVOX.TextAreaTextWriter);
      window.INVOX.SetWriterTarget(el);
    } catch (e) {
      // Silencioso
    }
  }, [activeTextareaRef, invoxState]);

  // ── Inicialización única ──────────────────────────────────────────────────────
  const initInvox = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    safeSetState('loading');
    setLoginProgress(0);

    const loaded = await loadInvoxScript();
    if (!loaded || !window.INVOX) {
      safeSetState('unavailable');
      return;
    }

    const INVOX = window.INVOX;
    safeSetState('connecting');

    // ── Customizar comportamiento del SDK ────────────────────────────────────
    try {
      INVOX.CustomizeComponents(() => {

        // Progreso de login
        INVOX.OnChangeProgressBar((msg) => {
          const pct = Number(msg.Percent) || 0;
          if (isMountedRef.current) setLoginProgress(pct);
          onLoginProgress?.(pct, msg.Description);
        });
        INVOX.OnFinishProgressBar(() => {
          if (isMountedRef.current) setLoginProgress(100);
        });

        // Micrófono concedido
        INVOX.OnGrantedAudioSource(() => {
          if (isMountedRef.current) setMicPermission('granted');
          try {
            const name = INVOX.GetMicrophoneName();
            if (isMountedRef.current && name) setMicName(name);
          } catch {}
        });

        // Micrófono denegado
        INVOX.OnDeniedAudioSource(() => {
          console.warn('[Invox Medical] Permiso de micrófono denegado.');
          if (isMountedRef.current) setMicPermission('denied');
          try { INVOX.SetDictationPaused(); } catch {}
        });

        // Reconocedor iniciado
        INVOX.OnStartedRecognizer(() => {
          // El SDK llama esto al arrancar — pausa inmediata para que el médico
          // active manualmente con el botón Vocalis.
          try { INVOX.SetDictationPaused(); } catch {}
          safeSetState('ready');
        });

        // Dictado pausado
        INVOX.OnPausedRecognizer(() => {
          safeSetState('ready');
        });

        // Dictado activo (escribiendo)
        INVOX.OnRunningRecognizer(() => {
          safeSetState('listening');
          // Asegurar que el WriterTarget apunta al textarea correcto
          const el = activeTextareaRef.current;
          if (el) {
            try {
              INVOX.SetTextWriter(INVOX.TextAreaTextWriter);
              INVOX.SetWriterTarget(el);
            } catch {}
          }
        });

        // Hipótesis / texto en tiempo real
        INVOX.OnChangeVisorHypothesis((msg, eventType) => {
          if (!msg || !isMountedRef.current) return;
          const isPartial =
            eventType === INVOX.dictationEventType.PARTIAL;
          const isFinal =
            eventType === INVOX.dictationEventType.ACCEPTED ||
            eventType === INVOX.dictationEventType.MACRO;

          if (isPartial) {
            setInterimText(msg);
            onInterimText?.(msg);
          } else if (isFinal) {
            setInterimText('');
            // Nota: Invox escribe directamente en el textarea vía SetWriterTarget.
            // Llamamos al callback TAMBIÉN para que el React state se sincronice
            // con el valor actual del DOM.
            if (activeTextareaRef.current) {
              // Pequeño delay para que Invox termine de escribir en el DOM
              setTimeout(() => {
                const el = activeTextareaRef.current;
                if (el && isMountedRef.current) {
                  onTranscriptionSuccess(el.value);
                }
              }, 80);
            }
          }
        });
      });
    } catch (e) {
      console.warn('[Invox Medical] Error en CustomizeComponents:', e);
    }

    // ── Eventos DOM de login ──────────────────────────────────────────────────
    // Limpiar listeners anteriores antes de registrar nuevos (evitar duplicados en hot-reload).
    if (onLoginSuccessRef.current) {
      document.removeEventListener(INVOX.eventTypeReport.LOGIN_SUCCESS, onLoginSuccessRef.current);
    }
    if (onLoginErrorRef.current) {
      document.removeEventListener(INVOX.eventTypeReport.LOGIN_ERROR, onLoginErrorRef.current);
    }

    const onLoginSuccess = () => {
      console.info('[Invox Medical] Login exitoso — esperando inicialización del reconocedor...');
      // NO poner 'ready' aquí — la sesión aún no está inicializada.
      // OnStartedRecognizer se disparará cuando el reconocedor esté listo,
      // ahí sí llamamos SetDictationPaused() y ponemos 'ready'.
      const el = activeTextareaRef.current;
      if (el) {
        try {
          INVOX.SetTextWriter(INVOX.TextAreaTextWriter);
          INVOX.SetWriterTarget(el);
        } catch {}
      }
    };

    const onLoginError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.warn('[Invox Medical] Error de login (silencioso):', detail);
      safeSetState('error');
      isInitializedRef.current = false;
    };

    onLoginSuccessRef.current = onLoginSuccess;
    onLoginErrorRef.current  = onLoginError;

    document.addEventListener(INVOX.eventTypeReport.LOGIN_SUCCESS, onLoginSuccess);
    document.addEventListener(INVOX.eventTypeReport.LOGIN_ERROR, onLoginError);

    // ── Login ─────────────────────────────────────────────────────────────────
    // Mac: usa Remote Service (el Local Agent solo existe para Windows).
    // Servidor: sdk.invoxmedical.com:8443
    const creds = {
      user: process.env.NEXT_PUBLIC_VOCALIS_USER || 'mavila',
      password: process.env.NEXT_PUBLIC_VOCALIS_PASS || 'u69u69u69',
    };
    const connConfig = {
      host: 'sdk.invoxmedical.com',
      port: '8443',
      useDictationService: true,
    };

    try {
      await INVOX.Login(creds, connConfig);




    } catch (e) {
      // Login falla silenciosamente — el evento LOGIN_ERROR se disparará
      console.warn('[Invox Medical] Login promise rechazada:', e);
    }
  }, [safeSetState, activeTextareaRef, onTranscriptionSuccess, onInterimText, onLoginProgress]);

  // ── Ciclo de vida ──────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    initInvox();

    return () => {
      isMountedRef.current = false;
      try {
        if (window.INVOX) window.INVOX.Logout().catch(() => {});
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Acciones públicas ───────────────────────────────────────────────────────
  const toggleInvox = useCallback(() => {
    const INVOX = window.INVOX;
    if (!INVOX) return;
    try {
      // Siempre actualizar el WriterTarget al textarea activo
      const el = activeTextareaRef.current;
      if (el) {
        INVOX.SetTextWriter(INVOX.TextAreaTextWriter);
        INVOX.SetWriterTarget(el);
      }
      // Usar llamadas explícitas en lugar de SwitchDictation()
      // para no depender del estado interno del SDK.
      if (invoxState === 'listening') {
        INVOX.SetDictationPaused();
      } else {
        INVOX.SetDictationRunning();
      }
    } catch (e) {
      console.warn('[Invox Medical] Error al toggle dictado:', e);
    }
  }, [activeTextareaRef, invoxState]);

  const reconnect = useCallback(() => {
    // NO llamamos Logout() — corrompe el estado interno del SDK y Login() falla.
    // Simplemente reseteamos el flag de inicialización y re-ejecutamos el login.
    isInitializedRef.current = false;
    safeSetState('loading');
    setLoginProgress(0);
    initInvox();
  }, [initInvox, safeSetState]);

  return {
    invoxState,
    isListening: invoxState === 'listening',
    isReady: invoxState === 'ready' || invoxState === 'listening' || invoxState === 'paused',
    isLoadingOrConnecting: invoxState === 'loading' || invoxState === 'connecting',
    interimText,
    loginProgress,
    micName,
    micPermission,
    toggleInvox,
    reconnect,
  };
}
