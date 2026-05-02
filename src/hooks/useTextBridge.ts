/**
 * useTextBridge — Hook para recibir texto del móvil via polling
 * ═══════════════════════════════════════════════════════════════
 * 
 * Crea una sesión de bridge, hace polling al API de Next.js,
 * y proporciona el texto del móvil en tiempo real.
 * 
 * TODO: El bridge funciona via API routes de Next.js (mismo puerto 3000)
 * para evitar CORS y problemas de mixed-content con Safari.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const VOICE_SERVER = process.env.NEXT_PUBLIC_AMIS_VOICE_URL || 'http://localhost:8769';

export interface UseTextBridgeReturn {
  sessionId: string | null;
  mobileText: string;
  mobileConnected: boolean;
  isRefining: boolean;
  mobileUrl: string;
  createSession: () => Promise<void>;
  refineText: (text: string, modality?: string, studyDesc?: string) => Promise<string>;
  clearBridgeText: () => void;
}

export function useTextBridge(): UseTextBridgeReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mobileText, setMobileText] = useState('');
  const [mobileConnected, setMobileConnected] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [lanIp, setLanIp] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTextRef = useRef('');

  // Detect LAN IP for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        setLanIp(host);
        return;
      }
    }
    fetch('/api/lan-ip').then(r => r.json()).then(d => {
      if (d.ip) setLanIp(d.ip);
    }).catch(() => {});
  }, []);

  // Create bridge session via Next.js API (same port)
  const createSession = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/create', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.sessionId);
        console.info(`[Text-Bridge] 🌉 Sesión: ${data.sessionId}`);
      }
    } catch (err) {
      console.error('[Text-Bridge] Error creando sesión:', err);
    }
  }, []);

  // Poll for text updates (every 500ms)
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/bridge/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMountedRef.current) {
            if (data.text !== lastTextRef.current) {
              setMobileText(data.text || '');
              lastTextRef.current = data.text || '';
            }
            // Connected if update was within last 15 seconds
            const isConnected = data.connected && (Date.now() - data.lastUpdate < 15000);
            setMobileConnected(isConnected);
          }
        }
      } catch {}
    };

    poll(); // Initial check
    pollRef.current = setInterval(poll, 500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Refine text with Gemma 2 via voice server
  const refineText = useCallback(async (text: string, modality = '', studyDesc = ''): Promise<string> => {
    if (!sessionId || !text.trim()) return text;
    setIsRefining(true);
    try {
      const res = await fetch(`${VOICE_SERVER}/bridge/refine/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, modality, studyDescription: studyDesc }),
        signal: AbortSignal.timeout(35000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.refined || text;
      }
      return text;
    } catch {
      return text;
    } finally {
      setIsRefining(false);
    }
  }, [sessionId]);

  const clearBridgeText = useCallback(() => {
    setMobileText('');
    lastTextRef.current = '';
  }, []);

  // QR URL uses LAN IP and port 3000
  const port = typeof window !== 'undefined' ? window.location.port || '3000' : '3000';
  const host = lanIp || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const mobileUrl = sessionId ? `http://${host}:${port}/api/mobile-bridge/${sessionId}` : '';

  return {
    sessionId,
    mobileText,
    mobileConnected,
    isRefining,
    mobileUrl,
    createSession,
    refineText,
    clearBridgeText,
  };
}
