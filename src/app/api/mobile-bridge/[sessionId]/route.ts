import { NextRequest, NextResponse } from 'next/server';

// Serve the mobile bridge as pure static HTML — no React, no hydration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const origin = request.headers.get('host') || 'localhost:3000';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <title>AMIS Text-Bridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100dvh; background: #0a0a0a;
      display: flex; flex-direction: column; padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    #header { display:flex; align-items:center; justify-content:space-between; padding:8px 4px; margin-bottom:4px; }
    #statusArea { display:flex; align-items:center; gap:8px; }
    #statusDot { width:12px; height:12px; border-radius:50%; background:#ef4444; box-shadow:0 0 10px #ef4444; }
    #statusLabel { font-size:13px; font-weight:900; letter-spacing:0.1em; color:#ef4444; }
    #clearBtn {
      background:#7f1d1d; color:#fca5a5; border:1px solid #991b1b;
      border-radius:10px; padding:10px 18px; font-size:12px; font-weight:800; cursor:pointer;
    }
    #sessionLabel { font-size:9px; color:#374151; text-align:center; margin-bottom:6px; font-family:monospace; }
    #mainInput {
      flex:1; width:100%; background:#111; color:#f59e0b;
      border:2px solid #dc262644; border-radius:16px; padding:20px;
      font-size:20px; line-height:1.6;
      font-family:-apple-system, BlinkMacSystemFont, sans-serif;
      resize:none; outline:none; caret-color:#f59e0b;
      min-height:35vh; -webkit-appearance:none;
    }
    #mainInput::placeholder { color:#4a5568; font-style:italic; }
    #sendBtn {
      margin-top:12px; width:100%; padding:22px;
      background:#1e293b; color:#fff; border:none; border-radius:18px;
      font-size:18px; font-weight:900; letter-spacing:0.12em;
      cursor:pointer; transition:all 0.3s ease;
    }
    #sendBtn.pending {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #000; box-shadow: 0 0 30px rgba(245,158,11,0.4);
    }
    #sendBtn.sent { background: #16a34a; color: #fff; }
    #footer { display:flex; align-items:center; justify-content:center; padding:10px; margin-top:4px; }
    #charCount { font-size:11px; color:#4b5563; font-weight:600; }
  </style>
</head>
<body>
  <div id="header">
    <div id="statusArea">
      <div id="statusDot"></div>
      <span id="statusLabel">⏳ CONECTANDO...</span>
    </div>
    <button id="clearBtn">🗑️ BORRAR</button>
  </div>
  <div id="sessionLabel">${sessionId}</div>
  <textarea id="mainInput" placeholder="Toque aquí y use el micrófono 🎙️ del teclado para dictar..." autocomplete="off" autocorrect="on" spellcheck="true"></textarea>
  <button id="sendBtn">🎙️  DICTE ARRIBA</button>
  <div id="footer">
    <span id="charCount">AMIS Text-Bridge • 0 caracteres</span>
  </div>

  <script>
    (function() {
      var API = '/api/bridge/${sessionId}';
      var textarea = document.getElementById('mainInput');
      var sendBtn = document.getElementById('sendBtn');
      var clearBtn = document.getElementById('clearBtn');
      var statusDot = document.getElementById('statusDot');
      var statusLabel = document.getElementById('statusLabel');
      var charCount = document.getElementById('charCount');

      var lastSent = '';
      var sending = false;

      function setConnected() {
        statusDot.style.background = '#22c55e';
        statusDot.style.boxShadow = '0 0 10px #22c55e';
        statusLabel.textContent = '✅ CONECTADO';
        statusLabel.style.color = '#22c55e';
        textarea.style.borderColor = '#16a34a44';
      }

      function setDisconnected() {
        statusDot.style.background = '#ef4444';
        statusDot.style.boxShadow = '0 0 10px #ef4444';
        statusLabel.textContent = '❌ SIN CONEXIÓN';
        statusLabel.style.color = '#ef4444';
        textarea.style.borderColor = '#dc262644';
      }

      function sendToPC(text) {
        sending = true;
        sendBtn.textContent = '⏳ ENVIANDO...';
        sendBtn.className = '';

        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text })
        })
        .then(function(res) {
          sending = false;
          if (res.ok) {
            setConnected();
            lastSent = text;
            if (text.trim()) {
              sendBtn.textContent = '✅  TEXTO ENVIADO';
              sendBtn.className = 'sent';
            }
          } else {
            setDisconnected();
          }
        })
        .catch(function() {
          sending = false;
          setDisconnected();
        });
      }

      // Poll textarea value every 250ms
      setInterval(function() {
        var val = textarea.value;
        var len = val.length;
        charCount.textContent = 'AMIS Text-Bridge • ' + len + ' caracteres';

        if (!sending) {
          if (len > 0 && val !== lastSent) {
            sendBtn.textContent = '📤  ENVIAR AL PC';
            sendBtn.className = 'pending';
          } else if (len === 0) {
            sendBtn.textContent = '🎙️  DICTE ARRIBA';
            sendBtn.className = '';
          }
        }
      }, 250);

      // Auto-send every 3s
      setInterval(function() {
        var val = textarea.value;
        if (val.trim() && val !== lastSent && !sending) {
          sendToPC(val);
        }
      }, 3000);

      // Send button
      sendBtn.addEventListener('click', function() {
        var val = textarea.value;
        if (val.trim()) sendToPC(val);
      });

      // Clear button
      clearBtn.addEventListener('click', function() {
        textarea.value = '';
        lastSent = '';
        sendToPC('');
        textarea.focus();
      });

      // Initial ping
      sendToPC('');
      setTimeout(function() { textarea.focus(); }, 500);
    })();
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
