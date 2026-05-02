import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/mobile-mic/[sessionId]
 * Sirve una página HTML pura (sin React) para el micrófono móvil.
 * Evita todos los problemas de hidratación de Next.js.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const host = request.headers.get('host')?.split(':')[0] || 'localhost';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <title>AMIS Voice — Dictado Remoto</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0f172a;
      color: white;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 24px 20px;
      padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
    }
    body.recording { background: #1a0505; }

    .header { text-align: center; padding-top: 16px; }
    .title { font-size: 22px; font-weight: 900; letter-spacing: 3px; }
    .subtitle { font-size: 11px; color: #94a3b8; letter-spacing: 4px; margin-top: 4px; }

    #btnConnect {
      margin-top: 16px;
      padding: 14px 36px;
      font-size: 15px;
      font-weight: 800;
      color: white;
      background: #059669;
      border: none;
      border-radius: 99px;
      letter-spacing: 2px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    #btnConnect:active { transform: scale(0.95); }
    #btnConnect.error { background: #dc2626; }
    #btnConnect.connecting { background: #2563eb; }

    #statusBadge {
      display: none;
      margin-top: 12px;
      padding: 8px 20px;
      border-radius: 99px;
      background: rgba(16,185,129,0.15);
      border: 2px solid rgba(16,185,129,0.5);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
    }

    .ptt-zone { flex: 1; display: flex; align-items: center; justify-content: center; }
    
    #btnPTT {
      width: 220px;
      height: 220px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border: 4px solid #475569;
      background: linear-gradient(to bottom, #334155, #1e293b);
      color: white;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 3px;
      cursor: pointer;
      transition: all 0.15s;
      opacity: 0.4;
      -webkit-tap-highlight-color: transparent;
    }
    #btnPTT.enabled { opacity: 1; }
    #btnPTT.pressed {
      border-color: #f87171;
      background: radial-gradient(circle, #dc2626, #991b1b);
      box-shadow: 0 0 80px rgba(239,68,68,0.5);
      transform: scale(1.08);
    }
    .ptt-icon { font-size: 56px; }
    .ptt-label { font-size: 11px; text-align: center; line-height: 1.4; }

    .footer { width: 100%; }
    #lastTranscription {
      display: none;
      background: rgba(0,0,0,0.4);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 12px;
    }
    #lastTranscription .label { font-size: 10px; color: #64748b; letter-spacing: 3px; margin-bottom: 4px; }
    #lastTranscription .text { font-size: 14px; font-weight: 500; line-height: 1.6; }

    .stats {
      display: flex;
      justify-content: space-between;
      padding: 0 8px;
      margin-bottom: 12px;
      font-size: 10px;
      color: #64748b;
      font-family: monospace;
    }

    #debugPanel {
      background: rgba(0,0,0,0.8);
      border-radius: 12px;
      padding: 12px;
      border: 1px solid rgba(6,182,212,0.3);
      font-family: monospace;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.8;
    }
    .log-ok { color: #34d399; }
    .log-err { color: #f87171; }
    .log-info { color: #38bdf8; }
    .log-default { color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">AMIS VOICE</h1>
    <p class="subtitle">DICTADO REMOTO</p>
    <button id="btnConnect" onclick="doConnect()">📡 CONECTAR</button>
    <div id="statusBadge">✅ CONECTADO</div>
  </div>

  <div class="ptt-zone">
    <button id="btnPTT">
      <span class="ptt-icon" id="pttIcon">🎙️</span>
      <span class="ptt-label" id="pttLabel">Toque para<br>dictar</span>
    </button>
  </div>

  <div class="footer">
    <div id="lastTranscription">
      <p class="label">ÚLTIMA TRANSCRIPCIÓN</p>
      <p class="text" id="transText"></p>
    </div>
    <div class="stats">
      <span>Palabras: <span id="wordCount">0</span></span>
      <span>16kHz · Mono</span>
    </div>
    <div id="debugPanel">
      <p class="log-default">Toque CONECTAR para iniciar</p>
    </div>
  </div>

  <script>
    var ws = null;
    var mediaStream = null;
    var audioCtx = null;
    var processor = null;
    var recording = false;
    var wordCount = 0;
    var sessionId = '${sessionId}';
    var wsHost = '${host}';
    var micReady = false;

    function log(msg, type) {
      var panel = document.getElementById('debugPanel');
      var p = document.createElement('p');
      p.className = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : type === 'info' ? 'log-info' : 'log-default';
      p.textContent = msg;
      panel.appendChild(p);
      while (panel.children.length > 8) panel.removeChild(panel.firstChild);
      panel.scrollTop = panel.scrollHeight;
    }

    // Pre-autorizar micrófono ANTES de conectar WebSocket
    function doConnect() {
      var btn = document.getElementById('btnConnect');
      btn.textContent = '🎤 Autorizando mic...';
      btn.className = 'connecting';
      log('Solicitando permiso micrófono...', 'default');

      navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      }).then(function(stream) {
        // Mic autorizado — detener el stream de prueba
        stream.getTracks().forEach(function(t) { t.stop(); });
        micReady = true;
        log('✅ Micrófono autorizado', 'ok');

        // Ahora conectar WebSocket
        connectWS(btn);
      }).catch(function(err) {
        log('❌ Mic denegado: ' + err.message, 'err');
        btn.textContent = '🔄 REINTENTAR';
        btn.className = 'error';
      });
    }

    function connectWS(btn) {
      var isSecure = window.location.protocol === 'https:';
      var wsProto = isSecure ? 'wss://' : 'ws://';
      // Cuando es HTTPS, usar /ws en el mismo host:puerto (proxy unificado)
      // Cuando es HTTP, conectar directo al Whisper server
      var url = isSecure
        ? wsProto + window.location.host + '/ws'
        : 'ws://' + wsHost + ':8765';
      log('Conectando: ' + url, 'default');
      btn.textContent = '⏳ CONECTANDO...';

      try {
        ws = new WebSocket(url);

        ws.onopen = function() {
          log('✅ WebSocket abierto!', 'ok');
          ws.send(JSON.stringify({ type: 'join_session', sessionId: sessionId, role: 'sender' }));
          btn.style.display = 'none';
          document.getElementById('statusBadge').style.display = 'inline-block';
          document.getElementById('btnPTT').classList.add('enabled');
          try { navigator.vibrate(50); } catch(e) {}
          log('Mantenga el botón para dictar', 'ok');
        };

        ws.onmessage = function(evt) {
          try {
            var d = JSON.parse(evt.data);
            if (d.type === 'final' && d.text) {
              log('📝 ' + d.text.substring(0, 50), 'info');
              document.getElementById('transText').textContent = d.text;
              document.getElementById('lastTranscription').style.display = 'block';
              var w = d.text.trim().split(/\\s+/).length;
              wordCount += w;
              document.getElementById('wordCount').textContent = wordCount;
              try { navigator.vibrate(15); } catch(e) {}
            }
          } catch(e) {}
        };

        ws.onclose = function(e) {
          log('🔌 Cerrado: ' + e.code, 'err');
          btn.style.display = 'block';
          btn.textContent = '🔄 RECONECTAR';
          btn.className = 'error';
          document.getElementById('statusBadge').style.display = 'none';
          document.getElementById('btnPTT').classList.remove('enabled');
        };

        ws.onerror = function() {
          log('❌ Error WebSocket', 'err');
          btn.style.display = 'block';
          btn.textContent = '🔄 REINTENTAR';
          btn.className = 'error';
        };

      } catch(e) {
        log('❌ ' + e.message, 'err');
        btn.textContent = '🔄 REINTENTAR';
        btn.className = 'error';
      }
    }

    function startRec() {
      if (!ws || ws.readyState !== WebSocket.OPEN || !micReady || recording) return;
      try { navigator.vibrate(30); } catch(e) {}
      
      var btn = document.getElementById('btnPTT');
      btn.classList.add('pressed');
      document.getElementById('pttIcon').textContent = '🔴';
      document.getElementById('pttLabel').innerHTML = 'Toque para<br>detener';
      document.body.classList.add('recording');
      recording = true;

      navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      }).then(function(stream) {
        mediaStream = stream;
        audioCtx = new AudioContext({ sampleRate: 16000 });
        var src = audioCtx.createMediaStreamSource(stream);
        processor = audioCtx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = function(e) {
          if (!recording || !ws || ws.readyState !== WebSocket.OPEN) return;
          var inp = e.inputBuffer.getChannelData(0);
          var i16 = new Int16Array(inp.length);
          for (var i = 0; i < inp.length; i++) {
            var s = Math.max(-1, Math.min(1, inp[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          ws.send(i16.buffer);
        };

        src.connect(processor);
        processor.connect(audioCtx.destination);
        ws.send(JSON.stringify({ type: 'start', sampleRate: 16000, language: 'es' }));
        log('🔴 Grabando...', 'ok');
      }).catch(function(err) {
        log('❌ Mic: ' + err.message, 'err');
        recording = false;
        btn.classList.remove('pressed');
        document.body.classList.remove('recording');
      });
    }

    function stopRec() {
      if (!recording) return;
      try { navigator.vibrate(15); } catch(e) {}
      recording = false;

      var btn = document.getElementById('btnPTT');
      btn.classList.remove('pressed');
      document.getElementById('pttIcon').textContent = '🎙️';
      document.getElementById('pttLabel').innerHTML = 'Toque para<br>dictar';
      document.body.classList.remove('recording');

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }));
      }
      if (processor) { try { processor.disconnect(); } catch(e) {} processor = null; }
      if (audioCtx) { try { audioCtx.close(); } catch(e) {} audioCtx = null; }
      if (mediaStream) { mediaStream.getTracks().forEach(function(t) { t.stop(); }); mediaStream = null; }
      log('⏹ Detenido', 'default');
    }

    // Toggle mode: toque para iniciar, toque para detener
    var ptt = document.getElementById('btnPTT');
    ptt.addEventListener('click', function(e) {
      e.preventDefault();
      if (!ptt.classList.contains('enabled')) return;
      if (recording) {
        stopRec();
      } else {
        startRec();
      }
    });

    // Fallback touch para evitar double-tap zoom en iOS
    ptt.addEventListener('touchend', function(e) {
      e.preventDefault();
    }, { passive: false });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
