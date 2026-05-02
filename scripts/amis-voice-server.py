#!/usr/bin/env python3
"""
AMIS Voice Central Server v2.0 — Servidor HTTP de IA para Dictado Clínico
═══════════════════════════════════════════════════════════════════════════
Mac Mini M2 Pro como servidor central de IA para toda la red del hospital.
Recibe audio en bloques (batch), transcribe con Faster-Whisper y refina.

Endpoints:
  POST /transcribe  — Recibe audio blob → retorna transcripción
  POST /correct     — Aplica diccionario médico a texto
  GET  /health      — Estado del servidor

Uso:
  python3 scripts/amis-voice-server.py --model large-v3-turbo --compute int8
"""

import argparse
import io
import json
import time
import os
import re
import wave
import struct
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import numpy as np

# ─── Configuración ───────────────────────────────────────────────────────────
SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 120

# ─── Text-Bridge: Estado en memoria ─────────────────────────────────────────
import threading
import subprocess
import uuid

bridge_sessions = {}  # {session_id: {"text": str, "listeners": [], "connected": bool, "lastUpdate": float}}
bridge_lock = threading.Lock()

# ─── Diccionario Médico Radiológico ──────────────────────────────────────────
MEDICAL_DICTIONARY = {
    # Correcciones fonéticas comunes en español médico
    "esponja": "espondilolisis",
    "espondilolistesis": "espondilolistesis",
    "hernia tal": "hernial",
    "herniatal": "hernia hiatal",
    "parenquima": "parénquima",
    "parequima": "parénquima",
    "parenquimatoso": "parenquimatoso",
    "neumonia": "neumonía",
    "bronquectasia": "bronquiectasia",
    "hepato": "hépato",
    "esplenomegalia": "esplenomegalia",
    "colecistectomia": "colecistectomía",
    "nefrolitiasis": "nefrolitiasis",
    "ureterolitiasis": "ureterolitiasis",
    "adenopatia": "adenopatía",
    "adenopatias": "adenopatías",
    "linfadenopatia": "linfadenopatía",
    "aneurisma": "aneurisma",
    "aterosclerosis": "aterosclerosis",
    "calcificacion": "calcificación",
    "calcificaciones": "calcificaciones",
    "consolidacion": "consolidación",
    "atelectasia": "atelectasia",
    "derrame pleural": "derrame pleural",
    "neumotorax": "neumotórax",
    "hidrotorax": "hidrotórax",
    "cardiomegalia": "cardiomegalia",
    "escoliosis": "escoliosis",
    "cifosis": "cifosis",
    "lordosis": "lordosis",
    "osteofito": "osteofito",
    "osteofitos": "osteofitos",
    "pinzamiento": "pinzamiento",
    "protusion": "protrusión",
    "protrusion": "protrusión",
    "extrusion": "extrusión",
    "secuestro": "secuestro discal",
    "estenosis": "estenosis",
    "anterolistesis": "anterolistesis",
    "retrolistesis": "retrolistesis",
    "artrosis": "artrosis",
    "condromalacia": "condromalacia",
    "meniscopatia": "meniscopatía",
    "tendinopatia": "tendinopatía",
    "tendinosis": "tendinosis",
    "bursitis": "bursitis",
    "sinovitis": "sinovitis",
    "fractura": "fractura",
    "luxacion": "luxación",
    "subluxacion": "subluxación",
    "hipodensidad": "hipodensidad",
    "hiperdensidad": "hiperdensidad",
    "hipointensidad": "hipointensidad",
    "hiperintensidad": "hiperintensidad",
    "isointensidad": "isointensidad",
    "realce": "realce",
    "captacion": "captación",
    "nodulo": "nódulo",
    "nodulos": "nódulos",
    "masa": "masa",
    "lesion": "lesión",
    "lesiones": "lesiones",
    "quiste": "quiste",
    "lipoma": "lipoma",
    "hemangioma": "hemangioma",
    "metastasis": "metástasis",
    "displasia": "displasia",
    "neoplasia": "neoplasia",
    # Abreviaciones útiles
    "rm": "RM",
    "tac": "TAC",
    "tc": "TC",
    "rx": "RX",
    "eco": "ecografía",
    "pet": "PET",
    "pet ct": "PET-CT",
}

# ─── Anti-alucinación ────────────────────────────────────────────────────────
HALLUCINATION_BLACKLIST = [
    "subtítulos", "suscríbete", "gracias por ver", "like", "subscribe",
    "copyright", "music", "♪", "audiencia", "producido por",
    "MBC 뉴스", "이 뉴스", "시청해 주셔서", "www.",
    "thank you", "you", "bye", "the end", "Amara.org",
]

# ─── Globals ─────────────────────────────────────────────────────────────────
model = None
model_load_time = 0


def load_model(model_name: str, compute_type: str):
    """Carga el modelo Faster-Whisper"""
    global model, model_load_time
    from faster_whisper import WhisperModel
    
    print(f"🔄 Cargando modelo '{model_name}' (compute: {compute_type})...")
    t0 = time.time()
    model = WhisperModel(
        model_name,
        device="cpu",
        compute_type=compute_type,
        cpu_threads=8,
    )
    model_load_time = round(time.time() - t0, 1)
    print(f"✅ Modelo '{model_name}' cargado en {model_load_time}s ({compute_type})")


def transcribe_audio(audio_data: np.ndarray, language: str = "es") -> dict:
    """Transcribe un bloque de audio completo"""
    global model
    
    if model is None:
        return {"error": "Modelo no cargado", "text": ""}
    
    duration = len(audio_data) / SAMPLE_RATE
    if duration < 0.5:
        return {"text": "", "duration": duration, "warning": "Audio muy corto"}
    
    if duration > MAX_AUDIO_SECONDS:
        audio_data = audio_data[:int(MAX_AUDIO_SECONDS * SAMPLE_RATE)]
        duration = MAX_AUDIO_SECONDS
    
    t0 = time.time()
    
    segments, info = model.transcribe(
        audio_data,
        language=language,
        beam_size=5,           # Más preciso en batch (no hay urgencia de latencia)
        best_of=3,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=300,
            speech_pad_ms=200,
        ),
        word_timestamps=False,
        repetition_penalty=1.2,
        no_repeat_ngram_size=3,
        temperature=[0.0, 0.2, 0.4],
        condition_on_previous_text=True,
        suppress_tokens=[-1],
        initial_prompt="Informe radiológico clínico en español, con puntuación correcta. Ejemplo: Técnica de estudio. Se realiza tomografía computarizada de tórax con contraste endovenoso. Hallazgos: Parénquima pulmonar sin lesiones focales. No se observan adenopatías mediastínicas. Silueta cardíaca de tamaño normal. Impresión diagnóstica: Estudio dentro de límites normales.",
    )
    
    # Recopilar segmentos
    texts = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        # Filtrar alucinaciones
        lower = text.lower()
        if any(h in lower for h in HALLUCINATION_BLACKLIST):
            continue
        if len(text) < 3:
            continue
        texts.append(text)
    
    full_text = " ".join(texts)
    elapsed = round(time.time() - t0, 2)
    rtf = round(elapsed / duration, 2) if duration > 0 else 0
    
    print(f"📝 [{elapsed}s | RTF={rtf}x | {duration:.1f}s audio] {full_text[:80]}...")
    
    return {
        "text": full_text,
        "duration": round(duration, 2),
        "elapsed": elapsed,
        "rtf": rtf,
        "language": info.language if hasattr(info, 'language') else language,
        "probability": round(info.language_probability, 2) if hasattr(info, 'language_probability') else 0,
    }


def apply_spoken_punctuation(text: str) -> str:
    """Convierte comandos de puntuacion hablados a signos reales"""
    if not text:
        return text
    
    NL = chr(10)
    NL2 = chr(10) + chr(10)
    
    WB = r'\b'  # word boundary para regex
    
    # Mapeo de comandos hablados a signos de puntuacion
    replacements = [
        # Saltos de linea (procesar primero)
        (WB + r'(?:punto aparte|punto y aparte|punto parte)' + WB, '.' + NL),
        (WB + r'(?:nueva l[ií]nea|salto de l[ií]nea|siguiente l[ií]nea|l[ií]nea nueva|no a l[ií]nea)' + WB, NL),
        (WB + r'(?:nuevo p[aá]rrafo|p[aá]rrafo nuevo|siguiente p[aá]rrafo)' + WB, NL2),
        (WB + r'enter' + WB, NL),
        (WB + r'(?:punto y seguido)' + WB, '. '),
        # Puntuacion basica
        (WB + r'punto final' + WB, '.'),
        (WB + r'puntos suspensivos' + WB, '...'),
        (WB + r'dos puntos' + WB, ':'),
        (WB + r'punto y coma' + WB, ';'),
        (WB + r'punto' + WB, '. '),
        (WB + r'coma' + WB, ', '),
        (WB + r'gui[oó]n' + WB, ' - '),
        # Signos especiales
        (WB + r'abr[ei]r? par[eé]ntesis' + WB, ' ('),
        (WB + r'cierr[ae]r? par[eé]ntesis' + WB, ') '),
        (WB + r'signo de interrogaci[oó]n' + WB, '?'),
        (WB + r'signo de exclamaci[oó]n' + WB, '!'),
        (WB + r'barra' + WB, '/'),
    ]
    
    result = text
    for pattern, replacement in replacements:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    
    # Limpiar espacios multiples
    result = re.sub(r'  +', ' ', result)
    
    # Limpiar puntuacion duplicada (Whisper ya pone signos + comandos hablados)
    result = re.sub(r'([:.;,!?])\s*\.', r'\1', result)
    result = re.sub(r'\.\s*([:.;,])', r'\1', result)
    result = re.sub(r'([.!?])\1+', r'\1', result)
    result = re.sub(r',\s*,', ',', result)
    result = re.sub(r':\s*:', ':', result)
    
    # Capitalizar despues de punto + espacio o salto de linea
    result = re.sub(r'([.!?]\s+|\n)([a-záéíóúñ])', lambda m: m.group(1) + m.group(2).upper(), result)
    # Capitalizar primera letra
    if result and result[0].islower():
        result = result[0].upper() + result[1:]
    # Limpiar espacios antes de puntuacion
    result = re.sub(r'\s+([.,;:!?)])', r'\1', result)
    result = re.sub(r'([(])\s+', r'\1', result)
    result = re.sub(r'  +', ' ', result)
    
    return result.strip()

def apply_medical_dictionary(text: str, custom_dict: dict = None) -> dict:
    """Aplica diccionario médico al texto transcrito (word-boundary safe)"""
    corrections = []
    result = text
    
    # Combinar diccionario base + personalizado
    dictionary = dict(MEDICAL_DICTIONARY)
    if custom_dict:
        dictionary.update(custom_dict)
    
    # Ordenar por longitud descendente para que matches largos ganen primero
    sorted_items = sorted(dictionary.items(), key=lambda x: len(x[0]), reverse=True)
    
    for wrong, correct in sorted_items:
        # Usar word boundaries para evitar reemplazos parciales
        pattern = re.compile(r'\b' + re.escape(wrong) + r'\b', re.IGNORECASE)
        matches = pattern.findall(result)
        if matches:
            result = pattern.sub(correct, result)
            for m in matches:
                if m.lower() != correct.lower():  # Solo reportar si realmente cambió
                    corrections.append({"from": m, "to": correct})
    
    return {
        "text": result,
        "corrections": corrections,
        "correctionCount": len(corrections),
    }


def decode_audio_blob(data: bytes, content_type: str = "") -> np.ndarray:
    """Decodifica audio desde diferentes formatos a float32 numpy array"""
    
    # Si es WAV raw (PCM 16-bit)
    if content_type == "audio/wav" or data[:4] == b'RIFF':
        with io.BytesIO(data) as f:
            with wave.open(f, 'rb') as wf:
                frames = wf.readframes(wf.getnframes())
                dtype = np.int16 if wf.getsampwidth() == 2 else np.float32
                audio = np.frombuffer(frames, dtype=dtype)
                if dtype == np.int16:
                    audio = audio.astype(np.float32) / 32768.0
                return audio
    
    # Si es PCM raw (int16 little-endian)
    if content_type == "audio/pcm" or content_type == "application/octet-stream":
        audio = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        return audio
    
    # WebM/OGG — necesita ffmpeg para decodificar
    try:
        import subprocess
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp_in:
            tmp_in.write(data)
            tmp_in.flush()
            tmp_in_path = tmp_in.name
        
        tmp_out_path = tmp_in_path.replace('.webm', '.wav')
        
        result = subprocess.run([
            'ffmpeg', '-y', '-i', tmp_in_path,
            '-ar', str(SAMPLE_RATE), '-ac', '1', '-f', 'wav',
            tmp_out_path
        ], capture_output=True, timeout=10)
        
        if result.returncode != 0:
            raise Exception(f"ffmpeg error: {result.stderr.decode()[:200]}")
        
        with wave.open(tmp_out_path, 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        
        os.unlink(tmp_in_path)
        os.unlink(tmp_out_path)
        return audio
        
    except Exception as e:
        print(f"❌ Error decodificando audio: {e}")
        raise


class AMISVoiceHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler para el servidor AMIS Voice"""
    
    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def _json_response(self, data: dict, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._cors_headers()
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()
    
    def do_GET(self):
        path = urlparse(self.path).path
        
        if path == '/health':
            self._json_response({
                "status": "online",
                "model": "large-v3-turbo" if model else "not_loaded",
                "modelLoadTime": model_load_time,
                "server": "amis-voice-bridge-v3",
                "sampleRate": SAMPLE_RATE,
                "maxAudioSeconds": MAX_AUDIO_SECONDS,
                "dictionarySize": len(MEDICAL_DICTIONARY),
                "activeBridgeSessions": len(bridge_sessions),
            })
        elif path.startswith('/bridge/stream/'):
            self._handle_bridge_stream(path)
        elif path.startswith('/bridge/status/'):
            session_id = path.split('/')[-1]
            with bridge_lock:
                session = bridge_sessions.get(session_id)
            if session:
                self._json_response({"connected": session["connected"], "text": session["text"], "lastUpdate": session["lastUpdate"]})
            else:
                self._json_response({"connected": False, "text": "", "lastUpdate": 0})
        else:
            self._json_response({"error": "Not found"}, 404)
    
    def do_POST(self):
        path = urlparse(self.path).path
        content_length = int(self.headers.get('Content-Length', 0))
        content_type = self.headers.get('Content-Type', '')
        
        if path == '/transcribe':
            self._handle_transcribe(content_length, content_type)
        elif path == '/correct':
            self._handle_correct(content_length)
        elif path.startswith('/bridge/text/'):
            self._handle_bridge_text(path, content_length)
        elif path.startswith('/bridge/refine/'):
            self._handle_bridge_refine(path, content_length)
        elif path == '/bridge/create':
            self._handle_bridge_create()
        else:
            self._json_response({"error": "Not found"}, 404)
    
    def _handle_transcribe(self, content_length: int, content_type: str):
        """POST /transcribe — Recibe audio blob, retorna transcripción"""
        try:
            if content_length == 0:
                self._json_response({"error": "No audio data"}, 400)
                return
            
            if content_length > 50 * 1024 * 1024:  # 50MB max
                self._json_response({"error": "Audio too large (max 50MB)"}, 413)
                return
            
            body = self.rfile.read(content_length)
            
            # Determinar formato del audio
            audio_format = "unknown"
            if "wav" in content_type:
                audio_format = "audio/wav"
            elif "webm" in content_type:
                audio_format = "audio/webm"
            elif "ogg" in content_type:
                audio_format = "audio/ogg"
            elif "octet-stream" in content_type:
                audio_format = "application/octet-stream"
            elif body[:4] == b'RIFF':
                audio_format = "audio/wav"
            else:
                audio_format = content_type or "audio/webm"
            
            print(f"📥 Audio recibido: {len(body)} bytes, formato: {audio_format}")
            
            # Decodificar
            audio_data = decode_audio_blob(body, audio_format)
            
            # Transcribir
            result = transcribe_audio(audio_data)
            
            # Aplicar puntuación hablada + diccionario médico
            if result.get("text"):
                print(f"🔤 RAW: {repr(result['text'])}")
                # Paso 1: Convertir comandos de puntuación hablados
                punctuated = apply_spoken_punctuation(result["text"])
                if punctuated != result["text"]:
                    print(f"✏️  PUNCT: {repr(punctuated)}")
                # Paso 2: Aplicar diccionario médico
                corrected = apply_medical_dictionary(punctuated)
                result["originalText"] = result["text"]
                result["text"] = corrected["text"]
                result["corrections"] = corrected["corrections"]
                result["correctionCount"] = corrected["correctionCount"]
            
            self._json_response(result)
            
        except Exception as e:
            print(f"❌ Error en /transcribe: {e}")
            self._json_response({"error": str(e), "text": ""}, 500)
    
    def _handle_correct(self, content_length: int):
        """POST /correct — Aplica diccionario médico a texto"""
        try:
            body = self.rfile.read(content_length)
            data = json.loads(body)
            text = data.get("text", "")
            custom_dict = data.get("dictionary", {})
            
            result = apply_medical_dictionary(text, custom_dict)
            self._json_response(result)
            
        except Exception as e:
            self._json_response({"error": str(e)}, 500)
    
    def log_message(self, format, *args):
        """Silenciar logs estándar de HTTP"""
        pass
    
    # ─── Bridge Handlers ─────────────────────────────────────────────────────
    
    def _handle_bridge_create(self):
        """POST /bridge/create — Crea una sesión de bridge"""
        session_id = uuid.uuid4().hex[:12]
        with bridge_lock:
            bridge_sessions[session_id] = {
                "text": "",
                "listeners": [],
                "connected": False,
                "lastUpdate": time.time(),
            }
        print(f"🌉 Bridge session creada: {session_id}")
        self._json_response({"sessionId": session_id})
    
    def _handle_bridge_text(self, path: str, content_length: int):
        """POST /bridge/text/:sessionId — Móvil envía texto"""
        session_id = path.split('/')[-1]
        body = self.rfile.read(content_length)
        data = json.loads(body)
        text = data.get("text", "")
        
        with bridge_lock:
            if session_id not in bridge_sessions:
                bridge_sessions[session_id] = {"text": "", "listeners": [], "connected": True, "lastUpdate": time.time()}
            bridge_sessions[session_id]["text"] = text
            bridge_sessions[session_id]["connected"] = True
            bridge_sessions[session_id]["lastUpdate"] = time.time()
            listeners = list(bridge_sessions[session_id]["listeners"])
        
        # Enviar a todos los listeners SSE
        event_data = json.dumps({"text": text, "timestamp": time.time()})
        dead = []
        for wfile in listeners:
            try:
                wfile.write(f"data: {event_data}\n\n".encode())
                wfile.flush()
            except:
                dead.append(wfile)
        
        if dead:
            with bridge_lock:
                for d in dead:
                    if d in bridge_sessions.get(session_id, {}).get("listeners", []):
                        bridge_sessions[session_id]["listeners"].remove(d)
        
        self._json_response({"ok": True})
    
    def _handle_bridge_stream(self, path: str):
        """GET /bridge/stream/:sessionId — SSE stream para el PC"""
        session_id = path.split('/')[-1]
        
        with bridge_lock:
            if session_id not in bridge_sessions:
                bridge_sessions[session_id] = {"text": "", "listeners": [], "connected": False, "lastUpdate": time.time()}
        
        # Headers SSE
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        # Registrar este cliente como listener
        with bridge_lock:
            bridge_sessions[session_id]["listeners"].append(self.wfile)
        
        print(f"📡 PC conectado a bridge session: {session_id}")
        
        # Enviar estado actual
        init_data = json.dumps({"text": bridge_sessions[session_id]["text"], "timestamp": time.time(), "init": True})
        try:
            self.wfile.write(f"data: {init_data}\n\n".encode())
            self.wfile.flush()
        except:
            return
        
        # Mantener conexión abierta
        try:
            while True:
                time.sleep(5)
                self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
        except:
            with bridge_lock:
                if session_id in bridge_sessions:
                    if self.wfile in bridge_sessions[session_id]["listeners"]:
                        bridge_sessions[session_id]["listeners"].remove(self.wfile)
            print(f"📡 PC desconectado de bridge session: {session_id}")
    
    def _handle_bridge_refine(self, path: str, content_length: int):
        """POST /bridge/refine/:sessionId — Refina texto con Gemma 2 via Ollama"""
        session_id = path.split('/')[-1]
        body = self.rfile.read(content_length)
        data = json.loads(body)
        text = data.get("text", "")
        modality = data.get("modality", "")
        study_desc = data.get("studyDescription", "")
        
        if not text.strip():
            self._json_response({"error": "No text to refine"}, 400)
            return
        
        try:
            # Paso 1: Diccionario médico
            corrected = apply_medical_dictionary(text)
            text_after_dict = corrected["text"]
            
            # Paso 2: Puntuación hablada
            text_after_punct = apply_spoken_punctuation(text_after_dict)
            
            # Paso 3: Gemma 2 via Ollama
            prompt = f"""Eres un radiólogo experto. Refina este texto dictado para un informe radiológico profesional.

Modalidad: {modality}
Estudio: {study_desc}

Texto dictado (puede tener errores de dictado del celular):
{text_after_punct}

Instrucciones:
- Corrige errores ortográficos y gramaticales
- Aplica terminología médica correcta
- Mantén formato de informe radiológico
- Usa puntuación profesional
- NO inventes hallazgos, solo refina lo dictado
- Responde SOLO con el texto refinado, sin explicaciones"""
            
            result = subprocess.run(
                ["ollama", "run", "gemma2:2b", prompt],
                capture_output=True, text=True, timeout=30
            )
            
            refined = result.stdout.strip() if result.returncode == 0 else text_after_punct
            
            print(f"🧠 Refinado: {text[:40]}... → {refined[:40]}...")
            
            self._json_response({
                "original": text,
                "refined": refined,
                "corrections": corrected["corrections"],
                "correctionCount": corrected["correctionCount"],
            })
            
        except subprocess.TimeoutExpired:
            # Fallback: solo diccionario + puntuación sin Gemma
            self._json_response({
                "original": text,
                "refined": text_after_punct,
                "corrections": corrected["corrections"],
                "correctionCount": corrected["correctionCount"],
                "warning": "Gemma 2 timeout, usando solo diccionario"
            })
        except Exception as e:
            print(f"❌ Error en /bridge/refine: {e}")
            self._json_response({"error": str(e)}, 500)


def main(model_name: str, host: str, port: int, compute_type: str):
    load_model(model_name, compute_type)
    
    # Usar ThreadingHTTPServer para SSE concurrente
    from http.server import ThreadingHTTPServer
    server = ThreadingHTTPServer((host, port), AMISVoiceHandler)
    
    print(f"\n{'═' * 64}")
    print(f"  🏥  AMIS Voice + Text-Bridge Server v3.0")
    print(f"  📡  HTTP: http://{host}:{port}")
    print(f"  🧠  Modelo: {model_name} ({compute_type})")
    print(f"  📖  Diccionario médico: {len(MEDICAL_DICTIONARY)} entradas")
    print(f"  🍎  Optimizado para Apple Silicon M2 Pro")
    print(f"  📋  Endpoints:")
    print(f"       POST /transcribe        — Audio → Texto")
    print(f"       POST /correct           — Texto → Texto corregido")
    print(f"       POST /bridge/create     — Crear sesión de bridge")
    print(f"       POST /bridge/text/:id   — Móvil envía texto")
    print(f"       GET  /bridge/stream/:id — PC recibe SSE")
    print(f"       POST /bridge/refine/:id — Refinar con Gemma 2")
    print(f"       GET  /health            — Estado del servidor")
    print(f"{'═' * 64}\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido")
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AMIS Voice + Text-Bridge Server v3.0 🏥")
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8769)
    parser.add_argument("--compute", default="int8", choices=["int8", "int8_float16", "float32"])
    args = parser.parse_args()

    main(args.model, args.host, args.port, args.compute)
