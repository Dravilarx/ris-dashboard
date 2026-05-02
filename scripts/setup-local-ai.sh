#!/bin/bash
# ═══════════════════════════════════════════════════════════
# setup-local-ai.sh — Configuración del Cerebro Local AMIS
# ═══════════════════════════════════════════════════════════
# Instala y configura Ollama + Faster-Whisper en Apple Silicon
# Optimizado para Mac mini M2 Pro
#
# Uso: bash scripts/setup-local-ai.sh
# ═══════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🧠 AMIS RIS 2030 — Setup Cerebro Local (M2 Pro)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── 1. OLLAMA ──────────────────────────────────────────────────────────────
echo "📦 [1/4] Verificando Ollama..."
if command -v ollama &> /dev/null; then
    echo "  ✅ Ollama ya está instalado: $(ollama --version 2>/dev/null || echo 'versión desconocida')"
else
    echo "  ⬇️  Instalando Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    echo "  ✅ Ollama instalado."
fi

echo ""
echo "🧠 [2/4] Descargando modelos de IA..."

echo "  📥 Descargando Gemma 2 — Motor exclusivo AMIS-Voice..."
ollama pull gemma2

echo "  📥 Descargando DeepSeek Coder V2 — Modelo fallback..."
ollama pull deepseek-coder-v2:latest

echo "  ✅ Modelos descargados."
echo ""

# ── 2. FASTER-WHISPER ──────────────────────────────────────────────────────
echo "🎙️ [3/4] Configurando Faster-Whisper..."

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "  ❌ Python 3 no encontrado. Instala con: brew install python3"
    exit 1
fi

echo "  📦 Instalando dependencias Python..."
pip3 install --upgrade faster-whisper websockets numpy 2>/dev/null || \
pip install --upgrade faster-whisper websockets numpy

echo "  ✅ Faster-Whisper instalado."
echo ""

# ── 3. VERIFICACIÓN ────────────────────────────────────────────────────────
echo "🔍 [4/4] Verificación final..."

echo "  • Ollama: $(command -v ollama && echo '✅' || echo '❌')"
echo "  • Python: $(python3 --version 2>/dev/null || echo '❌')"
echo "  • faster-whisper: $(python3 -c 'import faster_whisper; print("✅ v" + faster_whisper.__version__)' 2>/dev/null || echo '❌ No instalado')"
echo "  • websockets: $(python3 -c 'import websockets; print("✅")' 2>/dev/null || echo '❌ No instalado')"
echo ""

# ── INSTRUCCIONES DE INICIO ────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  🚀 CÓMO INICIAR EL CEREBRO LOCAL"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Terminal 1 — Ollama (GPU Metal):"
echo "    $ ollama serve"
echo ""
echo "  Terminal 2 — Whisper Server (Dictado Tiempo Real):"
echo "    $ python3 scripts/whisper-server.py --model medium"
echo "    (usa --model large-v3 para máxima calidad)"
echo ""
echo "  Terminal 3 — Next.js Dev Server:"
echo "    $ npm run dev"
echo ""
echo "  Atajos en el Editor de Dictado:"
echo "    F3 = Toggle Whisper Local (Dictado Instantáneo)"
echo "    F4 = 🪄 Refinar Informe (Ollama Gemma 2)"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ⚡ Optimización M2 Pro:"
echo "  • Ollama usa Metal/GPU automáticamente (num_gpu=99)"
echo "  • Whisper usa int8 + NEON para velocidad máxima"
echo "  • Objetivo: refinado < 1s, dictado < 100ms latencia"
echo "═══════════════════════════════════════════════════════════"
