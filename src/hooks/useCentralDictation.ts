/**
 * useCentralDictation — Hook universal para dictado por bloques
 * ═══════════════════════════════════════════════════════════════
 * 
 * Arquitectura: Graba localmente → envía blob al servidor central → recibe texto
 * 
 * Funciona en CUALQUIER PC de la red, delegando procesamiento al Mac Mini.
 * Usa MediaRecorder API nativa (no ScriptProcessorNode/AudioWorklet).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
export type DictationState = 'idle' | 'recording' | 'processing' | 'error';
export type ServerStatus = 'unknown' | 'online' | 'offline';

export interface CentralDictationResult {
  text: string;
  originalText?: string;
  corrections?: Array<{ from: string; to: string }>;
  correctionCount?: number;
  duration?: number;
  elapsed?: number;
  rtf?: number;
}

export interface UseCentralDictationProps {
  /** URL del servidor central AMIS Voice */
  serverUrl?: string;
  /** Callback cuando se obtiene una transcripción exitosa */
  onTranscriptionSuccess: (text: string, result: CentralDictationResult) => void;
  /** Callback de error */
  onError?: (error: string) => void;
  /** Idioma de transcripción */
  language?: string;
}

export interface UseCentralDictationReturn {
  /** Estado actual del dictado */
  state: DictationState;
  /** Estado del servidor central */
  serverStatus: ServerStatus;
  /** Si está grabando actualmente */
  isRecording: boolean;
  /** Si está procesando (enviando al servidor) */
  isProcessing: boolean;
  /** Duración de la grabación actual en segundos */
  recordingDuration: number;
  /** Último error */
  lastError: string | null;
  /** Último resultado */
  lastResult: CentralDictationResult | null;
  /** Nivel de audio (0-1) para visualización */
  audioLevel: number;
  /** Toggle: iniciar/detener grabación */
  toggleRecording: () => void;
  /** Iniciar grabación */
  startRecording: () => void;
  /** Detener grabación y enviar */
  stopRecording: () => void;
  /** Verificar estado del servidor */
  checkServer: () => Promise<boolean>;
}

// ─── Constants ──────────────────────────────────────────────────────────────
// Puerto 8769 = servidor AMIS-Voice local (Whisper en el Mac Mini).
// Si no está activo, el sistema redirige automáticamente al endpoint interno Next.js.
const DEFAULT_SERVER_URL = process.env.NEXT_PUBLIC_AMIS_VOICE_URL || 'http://localhost:8769';
const FALLBACK_SERVER_URL = '/api/dictado/transcribe-local'; // Usa Whisper vía API interna
const HEALTH_CHECK_INTERVAL_MS = 120_000; // 2 min (menos ruido en consola)
const MAX_RECORDING_SECONDS = 120;

export function useCentralDictation({
  serverUrl = DEFAULT_SERVER_URL,
  onTranscriptionSuccess,
  onError,
  language = 'es',
}: UseCentralDictationProps): UseCentralDictationReturn {
  
  const [state, setState] = useState<DictationState>('idle');
  const [serverStatus, setServerStatus] = useState<ServerStatus>('unknown');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CentralDictationResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const levelAnimRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendToServerRef = useRef<(blob: Blob) => void>(() => {});

  const [useLocalFallback, setUseLocalFallback] = useState(false);

  // ── Health Check ──────────────────────────────────────────────────────────
  const checkServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${serverUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        if (isMountedRef.current) { setServerStatus('online'); setUseLocalFallback(false); }
        return true;
      }
      // Server responded but with error — still use local fallback
      if (isMountedRef.current) { setServerStatus('offline'); setUseLocalFallback(true); }
      return false;
    } catch {
      // Silently mark as offline — no console spam for ERR_CONNECTION_REFUSED
      if (isMountedRef.current) { setServerStatus('offline'); setUseLocalFallback(true); }
      return false;
    }
  }, [serverUrl]);

  // Health check al montar + intervalo
  useEffect(() => {
    isMountedRef.current = true;
    checkServer();
    healthTimerRef.current = setInterval(checkServer, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, [checkServer]);

  // ── Audio Level Visualization ─────────────────────────────────────────────
  const startLevelMonitor = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const tick = () => {
      if (!isMountedRef.current || state !== 'recording') return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length / 255;
      setAudioLevel(Math.min(1, avg * 3)); // Amplify for UI
      levelAnimRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [state]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    durationRef.current = 0;
    setRecordingDuration(0);
    setAudioLevel(0);
  }, []);

  // ── Start Recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (state === 'recording' || state === 'processing') return;
    
    setLastError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Audio analysis for level visualization
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Direct PCM capture — sends WAV to avoid ffmpeg dependency
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const pcmChunks: Float32Array[] = [];
      
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        pcmChunks.push(new Float32Array(input));
      };
      
      source.connect(processor);
      processor.connect(ctx.destination);
      
      // Store references for cleanup
      audioChunksRef.current = []; // Not used for PCM, but reset anyway
      mediaRecorderRef.current = null;
      
      // Store processor and pcmChunks in a ref-accessible way
      (streamRef as any)._processor = processor;
      (streamRef as any)._pcmChunks = pcmChunks;
      (streamRef as any)._sampleRate = ctx.sampleRate;

      setState('recording');

      // Timer de duración
      durationRef.current = 0;
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        durationRef.current += 0.1;
        setRecordingDuration(Math.round(durationRef.current * 10) / 10);
        if (durationRef.current >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 100);

      startLevelMonitor();

    } catch (err: any) {
      const msg = err?.message || 'Error al acceder al micrófono';
      setLastError(msg);
      setState('error');
      onError?.(msg);
      cleanup();
    }
  }, [state, cleanup, onError, startLevelMonitor]);

  // ── Stop Recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (state !== 'recording') return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (levelAnimRef.current) cancelAnimationFrame(levelAnimRef.current);
    setAudioLevel(0);
    
    setState('processing');

    // Collect PCM data and build WAV
    const pcmChunks: Float32Array[] = (streamRef as any)?._pcmChunks || [];
    const sampleRate: number = (streamRef as any)?._sampleRate || 16000;
    const processor = (streamRef as any)?._processor;
    
    // Disconnect processor
    if (processor) {
      try { processor.disconnect(); } catch {}
    }
    
    // Stop mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Build WAV blob from PCM chunks
    if (pcmChunks.length > 0) {
      const totalLength = pcmChunks.reduce((acc, c) => acc + c.length, 0);
      const pcm = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of pcmChunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Downsample to 16kHz for Whisper
      const TARGET_RATE = 16000;
      let finalPcm: Float32Array;
      let finalRate: number;
      
      if (sampleRate !== TARGET_RATE) {
        const ratio = sampleRate / TARGET_RATE;
        const newLength = Math.round(pcm.length / ratio);
        finalPcm = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const srcIdx = Math.min(Math.round(i * ratio), pcm.length - 1);
          finalPcm[i] = pcm[srcIdx];
        }
        finalRate = TARGET_RATE;
        console.info(`[AMIS Voice] 🔊 Resample ${sampleRate}Hz → ${TARGET_RATE}Hz (${pcm.length} → ${newLength} samples)`);
      } else {
        finalPcm = pcm;
        finalRate = sampleRate;
      }
      
      // Convert float32 → int16
      const int16 = new Int16Array(finalPcm.length);
      for (let i = 0; i < finalPcm.length; i++) {
        const s = Math.max(-1, Math.min(1, finalPcm[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Build WAV header
      const wavBuffer = new ArrayBuffer(44 + int16.byteLength);
      const view = new DataView(wavBuffer);
      const writeStr = (off: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + int16.byteLength, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, finalRate, true);
      view.setUint32(28, finalRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, int16.byteLength, true);
      new Uint8Array(wavBuffer, 44).set(new Uint8Array(int16.buffer));
      
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      console.info(`[AMIS Voice] 📤 WAV listo: ${(wavBlob.size / 1024).toFixed(0)}KB, ${finalRate}Hz, ${(finalPcm.length / finalRate).toFixed(1)}s`);
      sendToServerRef.current(wavBlob);
    } else {
      setState('idle');
    }
  }, [state]);

  // ── Send to Server ────────────────────────────────────────────────────────
  const sendToServer = useCallback(async (blob: Blob) => {
    if (!isMountedRef.current) return;
    
    try {
      // Use local fallback if voice server is unavailable
      const endpoint = useLocalFallback
        ? FALLBACK_SERVER_URL
        : `${serverUrl}/transcribe`;
      console.info(`[AMIS Voice] 📤 Enviando ${(blob.size / 1024).toFixed(0)}KB a ${useLocalFallback ? 'API interna' : 'servidor voz'}...`);
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        throw new Error(`Servidor HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error as string);
      }

      const result: CentralDictationResult = data;

      if (result.text?.trim()) {
        console.info(`[AMIS Voice] ✅ "${result.text.substring(0, 60)}..." (${result.elapsed}s, RTF=${result.rtf}x)`);
        if (result.correctionCount && result.correctionCount > 0) {
          console.info(`[AMIS Voice] 📖 ${result.correctionCount} correcciones médicas aplicadas`);
        }
        setLastResult(result);
        onTranscriptionSuccess(result.text, result);
        setServerStatus('online');
      } else {
        console.warn('[AMIS Voice] ⚠️ Sin texto reconocido');
      }

      if (isMountedRef.current) setState('idle');

    } catch (err: any) {
      const msg = err?.message || 'Error al comunicar con servidor central';
      console.error('[AMIS Voice]', msg);
      if (isMountedRef.current) {
        setLastError(msg);
        setState('error');
        onError?.(msg);
        setTimeout(() => { if (isMountedRef.current) setState('idle'); }, 3000);
      }
    }
  }, [serverUrl, onTranscriptionSuccess, onError]);

  // Keep ref in sync
  sendToServerRef.current = sendToServer;

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggleRecording = useCallback(() => {
    if (state === 'recording') stopRecording();
    else if (state === 'idle' || state === 'error') startRecording();
  }, [state, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    serverStatus,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
    recordingDuration,
    lastError,
    lastResult,
    audioLevel,
    toggleRecording,
    startRecording,
    stopRecording,
    checkServer,
  };
}
