'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export default function MobileMicPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [status, setStatus] = useState('idle');
  const [lastText, setLastText] = useState('');
  const [words, setWords] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Toque CONECTAR para iniciar']);
  const [isPressed, setIsPressed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const recRef = useRef(false);

  function addLog(msg: string) {
    setLogs(p => [...p.slice(-6), msg]);
  }

  function doConnect() {
    const host = window.location.hostname;
    const url = `ws://${host}:8765`;
    addLog(`Conectando: ${url}`);
    setStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('✅ Conectado!');
        ws.send(JSON.stringify({ type: 'join_session', sessionId, role: 'sender' }));
        setStatus('connected');
        try { navigator.vibrate?.(50); } catch {}
      };

      ws.onmessage = (evt) => {
        try {
          const d = JSON.parse(evt.data);
          if (d.type === 'final' && d.text) {
            addLog(`📝 ${d.text.slice(0, 50)}`);
            setLastText(d.text);
            setWords(w => w + d.text.trim().split(/\s+/).length);
          }
        } catch {}
      };

      ws.onclose = (e) => {
        addLog(`🔌 Cerrado (${e.code})`);
        setStatus('idle');
      };

      ws.onerror = () => {
        addLog('❌ Error WebSocket');
        setStatus('error');
      };
    } catch (e: any) {
      addLog(`❌ ${e.message}`);
      setStatus('error');
    }
  }

  async function startRec() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try { navigator.vibrate?.(30); } catch {}
    setIsPressed(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      procRef.current = proc;

      proc.onaudioprocess = (e) => {
        if (!recRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const inp = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(inp.length);
        for (let i = 0; i < inp.length; i++) {
          const s = Math.max(-1, Math.min(1, inp[i]));
          i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        wsRef.current!.send(i16.buffer);
      };

      src.connect(proc);
      proc.connect(ctx.destination);
      wsRef.current.send(JSON.stringify({ type: 'start', sampleRate: SAMPLE_RATE, language: 'es' }));
      recRef.current = true;
      setStatus('recording');
      addLog('🔴 Grabando...');
    } catch (err: any) {
      addLog(`❌ Mic: ${err.message}`);
    }
  }

  function stopRec() {
    try { navigator.vibrate?.(15); } catch {}
    setIsPressed(false);
    recRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    procRef.current?.disconnect();
    ctxRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(t => t.stop());
    procRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
    setStatus('connected');
    addLog('⏹ Detenido');
  }

  const connected = status === 'connected' || status === 'recording';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: status === 'recording' ? '#1a0505' : '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 20px',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        fontFamily: '-apple-system, sans-serif',
        color: 'white',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>AMIS VOICE</h1>
        <p style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 4, marginTop: 4 }}>DICTADO REMOTO</p>

        {/* Botón conectar */}
        {!connected && (
          <button
            onClick={doConnect}
            style={{
              marginTop: 16,
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 800,
              color: 'white',
              background: status === 'error' ? '#dc2626' : '#059669',
              border: 'none',
              borderRadius: 99,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            {status === 'connecting' ? '⏳ CONECTANDO...' : status === 'error' ? '🔄 REINTENTAR' : '📡 CONECTAR'}
          </button>
        )}

        {connected && (
          <div style={{
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 99,
            background: 'rgba(16,185,129,0.15)',
            border: '2px solid rgba(16,185,129,0.5)',
          }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>CONECTADO</span>
          </div>
        )}
      </div>

      {/* Botón PTT */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onTouchStart={(e) => { e.preventDefault(); if (connected) startRec(); }}
          onTouchEnd={(e) => { e.preventDefault(); if (recRef.current) stopRec(); }}
          onMouseDown={() => { if (connected) startRec(); }}
          onMouseUp={() => { if (recRef.current) stopRec(); }}
          disabled={!connected}
          style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            border: `4px solid ${isPressed ? '#f87171' : '#475569'}`,
            background: isPressed
              ? 'radial-gradient(circle, #dc2626, #991b1b)'
              : connected
              ? 'linear-gradient(to bottom, #334155, #1e293b)'
              : '#1e293b50',
            boxShadow: isPressed ? '0 0 80px rgba(239,68,68,0.5)' : 'none',
            transform: isPressed ? 'scale(1.08)' : 'scale(1)',
            transition: 'all 0.15s',
            cursor: connected ? 'pointer' : 'default',
            opacity: connected ? 1 : 0.4,
            color: 'white',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          <span style={{ fontSize: 56 }}>{isPressed ? '🔴' : '🎙️'}</span>
          <span style={{ fontSize: 11, padding: '0 16px', textAlign: 'center', lineHeight: 1.4 }}>
            {isPressed ? 'Suelte para\ndetener' : 'Mantenga\npara dictar'}
          </span>
        </button>
      </div>

      {/* Footer */}
      <div style={{ width: '100%' }}>
        {lastText && (
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 10, color: '#64748b', letterSpacing: 3, marginBottom: 4 }}>ÚLTIMA TRANSCRIPCIÓN</p>
            <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>{lastText}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>Palabras: {words}</span>
          <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>16kHz · Mono</span>
        </div>

        {/* Debug */}
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          borderRadius: 12,
          padding: 12,
          border: '1px solid rgba(6,182,212,0.3)',
        }}>
          {logs.map((l, i) => (
            <p key={i} style={{
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 600,
              lineHeight: 1.8,
              color: l.includes('❌') ? '#f87171' : l.includes('✅') ? '#34d399' : l.includes('📝') ? '#38bdf8' : '#e2e8f0',
              margin: 0,
            }}>
              {l}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
