'use client';

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function MobileBridgePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    const container = containerRef.current;
    const API_URL = `/api/bridge/${sessionId}`;

    // ═══ Build UI with vanilla DOM ═══
    container.innerHTML = `
      <div id="header" style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:8px">
          <div id="statusDot" style="width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 10px #ef4444"></div>
          <span id="statusText" style="font-size:13px;font-weight:900;letter-spacing:0.1em;color:#ef4444">⏳ CONECTANDO...</span>
        </div>
        <button id="clearBtn" style="background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:10px;padding:10px 18px;font-size:12px;font-weight:800;cursor:pointer">🗑️ BORRAR</button>
      </div>
      <div style="font-size:9px;color:#374151;text-align:center;margin-bottom:6px;font-family:monospace">${sessionId}</div>
      <textarea id="mainInput" placeholder="Toque aquí y use el micrófono 🎙️ del teclado para dictar..." autocomplete="off" autocorrect="on" spellcheck="true" style="flex:1;width:100%;background:#111;color:#f59e0b;border:2px solid #dc262644;border-radius:16px;padding:20px;font-size:20px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;resize:none;outline:none;caret-color:#f59e0b;min-height:35vh;box-sizing:border-box"></textarea>
      <button id="sendBtn" style="margin-top:12px;width:100%;padding:22px;background:#1e293b;color:#fff;border:none;border-radius:18px;font-size:18px;font-weight:900;letter-spacing:0.12em;cursor:pointer;transition:all 0.3s ease">🎙️  DICTE ARRIBA</button>
      <div style="display:flex;align-items:center;justify-content:center;padding:10px;margin-top:4px">
        <span id="charCount" style="font-size:11px;color:#4b5563;font-weight:600">AMIS Text-Bridge • 0 caracteres</span>
      </div>
    `;

    const textarea = document.getElementById('mainInput') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
    const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
    const statusDot = document.getElementById('statusDot') as HTMLDivElement;
    const statusText = document.getElementById('statusText') as HTMLSpanElement;
    const charCountEl = document.getElementById('charCount') as HTMLSpanElement;

    let lastSent = '';
    let isConnected = false;
    let isSending = false;

    // ═══ Send text to API ═══
    async function sendToPC(text: string) {
      isSending = true;
      sendBtn.textContent = '⏳ ENVIANDO...';
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          isConnected = true;
          lastSent = text;
          statusDot.style.background = '#22c55e';
          statusDot.style.boxShadow = '0 0 10px #22c55e';
          statusText.textContent = '✅ CONECTADO';
          statusText.style.color = '#22c55e';
          textarea.style.borderColor = '#16a34a44';
          sendBtn.textContent = '✅  TEXTO ENVIADO';
          sendBtn.style.background = '#16a34a';
          sendBtn.style.color = '#fff';
          sendBtn.style.boxShadow = 'none';
        } else {
          setDisconnected();
        }
      } catch {
        setDisconnected();
      }
      isSending = false;
    }

    function setDisconnected() {
      isConnected = false;
      statusDot.style.background = '#ef4444';
      statusDot.style.boxShadow = '0 0 10px #ef4444';
      statusText.textContent = '❌ SIN CONEXIÓN';
      statusText.style.color = '#ef4444';
      textarea.style.borderColor = '#dc262644';
    }

    // ═══ Poll textarea value & update button ═══
    setInterval(() => {
      const val = textarea.value;
      const len = val.length;
      charCountEl.textContent = 'AMIS Text-Bridge • ' + len + ' caracteres';

      if (!isSending) {
        if (len > 0 && val !== lastSent) {
          sendBtn.textContent = '📤  ENVIAR AL PC';
          sendBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
          sendBtn.style.color = '#000';
          sendBtn.style.boxShadow = '0 0 30px rgba(245,158,11,0.4)';
        } else if (len === 0) {
          sendBtn.textContent = '🎙️  DICTE ARRIBA';
          sendBtn.style.background = '#1e293b';
          sendBtn.style.color = '#fff';
          sendBtn.style.boxShadow = 'none';
        }
      }
    }, 250);

    // ═══ Auto-send every 3s ═══
    setInterval(() => {
      const val = textarea.value;
      if (val.trim() && val !== lastSent && !isSending) {
        sendToPC(val);
      }
    }, 3000);

    // ═══ Button handlers ═══
    sendBtn.addEventListener('click', () => {
      const val = textarea.value;
      if (val.trim()) sendToPC(val);
    });

    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      lastSent = '';
      sendToPC('');
      textarea.focus();
    });

    // ═══ Initial ping ═══
    sendToPC('');
    setTimeout(() => textarea.focus(), 500);
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100dvh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    />
  );
}
