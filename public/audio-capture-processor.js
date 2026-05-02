/**
 * audio-capture-processor.js — AudioWorklet para AMIS-Voice
 *
 * Reemplaza ScriptProcessorNode (depreciado) con un procesador
 * de audio en hilo separado. Cero bloqueo del hilo principal.
 *
 * Funciones:
 * - Captura PCM Float32 → Int16
 * - Noise Gate con auto-threshold
 * - Métricas de nivel RMS en tiempo real
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._isActive = false;
    this._noiseThreshold = 0.008; // Umbral inicial muy bajo (se auto-calibra)
    this._calibrating = true;
    this._calibrationSamples = [];
    this._calibrationStartTime = currentTime;
    this._calibrationDuration = 2.0; // 2 segundos de calibración
    this._gateOpen = false;
    this._gateHoldSamples = 0;
    this._gateHoldMax = 4800; // ~300ms a 16kHz

    // Escuchar mensajes del hilo principal
    this.port.onmessage = (e) => {
      if (e.data.type === 'activate') {
        this._isActive = true;
        // Reset calibración cada vez que se activa
        this._calibrating = true;
        this._calibrationSamples = [];
        this._calibrationStartTime = currentTime;
        console.log('[AudioWorklet] Activado — calibrando ruido ambiental...');
      } else if (e.data.type === 'deactivate') {
        this._isActive = false;
        this._gateOpen = false;
        console.log('[AudioWorklet] Desactivado');
      } else if (e.data.type === 'setThreshold') {
        this._noiseThreshold = e.data.value;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0]; // Canal mono

    // Calcular RMS
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    // ── Auto-calibración del umbral (primeros 2 segundos) ──
    if (this._calibrating) {
      this._calibrationSamples.push(rms);
      const elapsed = currentTime - this._calibrationStartTime;

      if (elapsed >= this._calibrationDuration) {
        // Calcular umbral como 2x el ruido promedio + 1 desviación estándar
        const avgNoise = this._calibrationSamples.reduce((a, b) => a + b, 0) / this._calibrationSamples.length;
        const variance = this._calibrationSamples.reduce((a, b) => a + (b - avgNoise) ** 2, 0) / this._calibrationSamples.length;
        const stdDev = Math.sqrt(variance);

        // Umbral = promedio de ruido + 2 * desviación estándar (pero mínimo 0.005)
        this._noiseThreshold = Math.max(0.005, avgNoise + 2 * stdDev);
        this._calibrating = false;

        this.port.postMessage({
          type: 'calibrated',
          threshold: this._noiseThreshold,
          avgNoise: avgNoise,
        });
      }
    }

    // Siempre enviar nivel de audio para la barra visual
    const voiceDetected = rms > this._noiseThreshold;

    // Gate hold: mantener abierto un poco después de detectar voz
    if (voiceDetected) {
      this._gateOpen = true;
      this._gateHoldSamples = this._gateHoldMax;
    } else if (this._gateHoldSamples > 0) {
      this._gateHoldSamples -= channelData.length;
      if (this._gateHoldSamples <= 0) {
        this._gateOpen = false;
      }
    }

    // Enviar métricas al hilo principal
    this.port.postMessage({
      type: 'levels',
      rms: rms,
      gateOpen: this._gateOpen,
      threshold: this._noiseThreshold,
      calibrating: this._calibrating,
    });

    // Solo enviar audio si está activo (PTT presionado) Y gate abierto
    if (this._isActive && this._gateOpen) {
      // Convertir Float32 → Int16
      const int16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      // Transferir buffer al hilo principal
      this.port.postMessage(
        { type: 'audio', buffer: int16.buffer },
        [int16.buffer] // Transfer ownership para cero copia
      );
    }

    return true; // Mantener el procesador vivo
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
