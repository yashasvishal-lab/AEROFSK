import { ModulationConfig, RxLinkState, TelemetryData, ReceivedMessage } from '../types';
import { PROTOCOL, bitsToBytes, crc16 } from './packetCodec';

export class AudioModemEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private loopbackGain: GainNode | null = null;
  private activeTxOsc: OscillatorNode | null = null;
  private testToneOsc: OscillatorNode | null = null;

  // Ring buffer variables
  private ring: Float32Array | null = null;
  private ringLen: number = 0;
  private totalWritten: number = 0;
  private sampleRate: number = 48000;
  private bitSamples: number = 0;
  private subStepSamples: number = 0;

  // Demodulator state
  private mode: 'HUNTING' | 'LOCKED' = 'HUNTING';
  private huntNextEnd: number = 0;
  private subTrace: Array<{ bit: string; ratio: number; end: number; m0: number; m1: number }> = [];
  private lockNextEnd: number = 0;
  private lockWatchdog: number = 0;

  // Packet parser state
  private rxState: RxLinkState = 'OFFLINE';
  private rxRollingBits: string = '';
  private rxByteBuffer: string = '';
  private rxExpectedLen: number = 0;
  private rxDataBits: string = '';
  private rxByteCount: number = 0;
  private currentSnrSum: number = 0;
  private currentSnrSamples: number = 0;

  // Config & Callbacks
  private config: ModulationConfig;
  private onTelemetryUpdate?: (data: TelemetryData) => void;
  private onStateChange?: (state: RxLinkState) => void;
  private onMessageReceived?: (msg: ReceivedMessage) => void;
  private onLog?: (msg: string, level: 'info' | 'ok' | 'warn' | 'error') => void;

  constructor(
    config: ModulationConfig,
    handlers: {
      onTelemetryUpdate?: (data: TelemetryData) => void;
      onStateChange?: (state: RxLinkState) => void;
      onMessageReceived?: (msg: ReceivedMessage) => void;
      onLog?: (msg: string, level: 'info' | 'ok' | 'warn' | 'error') => void;
    }
  ) {
    this.config = { ...config };
    this.onTelemetryUpdate = handlers.onTelemetryUpdate;
    this.onStateChange = handlers.onStateChange;
    this.onMessageReceived = handlers.onMessageReceived;
    this.onLog = handlers.onLog;
  }

  public updateConfig(newConfig: Partial<ModulationConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.ctx) {
      this.recomputeSampleMetrics();
    }
  }

  public getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private recomputeSampleMetrics() {
    if (!this.ctx) return;
    this.sampleRate = this.ctx.sampleRate;
    this.bitSamples = Math.round((this.sampleRate * this.config.bitDurationMs) / 1000);
    this.subStepSamples = Math.round((this.sampleRate * this.config.subStepMs) / 1000);
    this.ringLen = this.sampleRate * 3; // 3 seconds buffer
    if (!this.ring || this.ring.length !== this.ringLen) {
      this.ring = new Float32Array(this.ringLen);
      this.totalWritten = 0;
    }
  }

  // ------------------ RECEIVER INITIALIZATION ------------------
  public async startListening(): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.recomputeSampleMetrics();

      // Acquire clean microphone input with disabled browser voice processing filters
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSource = ctx.createMediaStreamSource(this.micStream);

      // Fast Fourier Transform analyser for visual telemetry
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.2;
      this.micSource.connect(this.analyser);

      // Audio loopback bridge (for instant single-browser simulation/testing)
      if (!this.loopbackGain) {
        this.loopbackGain = ctx.createGain();
        this.loopbackGain.gain.value = 1.0;
      }
      this.loopbackGain.connect(this.analyser);

      // Sample-accurate script processor for demodulation ring-buffer
      const BUFFER_SIZE = 2048;
      this.processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0; // Prevent microphone acoustic feedback loop
      this.micSource.connect(this.processor);
      this.loopbackGain.connect(this.processor);
      this.processor.connect(muteGain);
      muteGain.connect(ctx.destination);

      this.processor.onaudioprocess = (e) => this.onAudioProcess(e);

      this.resetDemod();
      this.setRxState('HUNTING');
      this.onLog?.(
        `Acoustic receiver active. F0: ${this.config.freq0}Hz, F1: ${this.config.freq1}Hz @ ${this.sampleRate}Hz sample rate.`,
        'info'
      );
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown audio error';
      this.onLog?.(`Failed to access microphone: ${errorMsg}`, 'error');
      this.setRxState('OFFLINE');
      return false;
    }
  }

  public stopListening() {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    this.resetDemod();
    this.setRxState('OFFLINE');
    this.onLog?.('Acoustic receiver offline.', 'info');
  }

  private setRxState(state: RxLinkState) {
    this.rxState = state;
    this.onStateChange?.(state);
  }

  private resetDemod() {
    this.mode = 'HUNTING';
    this.huntNextEnd = this.bitSamples;
    this.subTrace = [];
    this.lockNextEnd = 0;
    this.lockWatchdog = 0;
    this.rxByteBuffer = '';
    this.rxDataBits = '';
    this.rxExpectedLen = 0;
    this.rxByteCount = 0;
    this.currentSnrSum = 0;
    this.currentSnrSamples = 0;
  }

  private onAudioProcess(e: AudioProcessingEvent) {
    if (!this.ring) return;
    const input = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) {
      this.ring[this.totalWritten % this.ringLen] = input[i];
      this.totalWritten++;
    }
    this.stepDemod();
  }

  // ------------------ GOERTZEL & SAMPLE EXTRACTION ------------------
  private goertzelMag(samples: Float32Array, targetFreq: number): number {
    const N = samples.length;
    const k = Math.round((N * targetFreq) / this.sampleRate);
    const w = ((2 * Math.PI) / N) * k;
    const cosine = Math.cos(w);
    const coeff = 2 * cosine;
    const sine = Math.sin(w);
    let q0 = 0,
      q1 = 0,
      q2 = 0;
    for (let i = 0; i < N; i++) {
      q0 = coeff * q1 - q2 + samples[i];
      q2 = q1;
      q1 = q0;
    }
    const real = q1 - q2 * cosine;
    const imag = q2 * sine;
    return Math.sqrt(real * real + imag * imag);
  }

  private getWindow(end: number, len: number): Float32Array | null {
    if (!this.ring) return null;
    const start = end - len;
    if (start < 0 || end > this.totalWritten || this.totalWritten - start > this.ringLen) {
      return null;
    }
    const out = new Float32Array(len);
    const base = start % this.ringLen;
    if (base + len <= this.ringLen) {
      out.set(this.ring.subarray(base, base + len));
    } else {
      const firstPart = this.ringLen - base;
      out.set(this.ring.subarray(base, this.ringLen), 0);
      out.set(this.ring.subarray(0, len - firstPart), firstPart);
    }
    return out;
  }

  // ------------------ DEMODULATOR DISCRIMINATION ------------------
  private stepDemod() {
    if (this.mode === 'HUNTING') {
      while (this.totalWritten >= this.huntNextEnd) {
        const win = this.getWindow(this.huntNextEnd, this.bitSamples);
        if (win) {
          const m0 = this.goertzelMag(win, this.config.freq0);
          const m1 = this.goertzelMag(win, this.config.freq1);
          const bit = m1 > m0 ? '1' : '0';
          const ratio = Math.max(m0, m1) / (Math.min(m0, m1) + 1e-9);

          this.subTrace.push({ bit, ratio, end: this.huntNextEnd, m0, m1 });
          if (this.subTrace.length > 400) this.subTrace.shift();

          this.dispatchTelemetry(m0, m1, bit, ratio);

          if (this.tryLockPreamble()) {
            break;
          }
        }
        this.huntNextEnd += this.subStepSamples;
      }
    } else {
      // LOCKED MODE
      while (this.totalWritten >= this.lockNextEnd) {
        const win = this.getWindow(this.lockNextEnd, this.bitSamples);
        if (win) {
          const m0 = this.goertzelMag(win, this.config.freq0);
          const m1 = this.goertzelMag(win, this.config.freq1);
          const bit = m1 > m0 ? '1' : '0';
          const ratio = Math.max(m0, m1) / (Math.min(m0, m1) + 1e-9);

          this.dispatchTelemetry(m0, m1, bit, ratio);
          this.processBit(bit, ratio);
        }

        this.lockNextEnd += this.bitSamples;
        if (this.lockNextEnd > this.lockWatchdog) {
          this.onLog?.('Acoustic lock timeout: Packet stream lost. Re-hunting carrier.', 'warn');
          this.resetDemod();
          this.setRxState('HUNTING');
          break;
        }
      }
    }
  }

  private tryLockPreamble(): boolean {
    const oversample = Math.max(1, Math.round(this.bitSamples / this.subStepSamples));
    const need = PROTOCOL.PREAMBLE.length * oversample;
    if (this.subTrace.length < need) return false;

    let bestScore = -1;
    let bestPhase = 0;
    let bestEndIdx = -1;

    for (let phase = 0; phase < oversample; phase++) {
      let score = 0;
      let count = 0;
      let idx = this.subTrace.length - 1 - phase;
      const picks: number[] = [];

      for (let b = PROTOCOL.PREAMBLE.length - 1; b >= 0 && idx >= 0; b--, idx -= oversample) {
        picks.push(idx);
        count++;
      }
      if (count < PROTOCOL.PREAMBLE.length) continue;
      picks.reverse();

      for (let b = 0; b < PROTOCOL.PREAMBLE.length; b++) {
        const entry = this.subTrace[picks[b]];
        if (entry.bit === PROTOCOL.PREAMBLE[b] && entry.ratio >= this.config.minRatio) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPhase = phase;
        bestEndIdx = picks[picks.length - 1];
      }
    }

    // Allow 2 bit tolerance out of 16 bits for room reverberation or mic noise
    if (bestScore >= PROTOCOL.PREAMBLE.length - 2) {
      const lastPreambleEntry = this.subTrace[bestEndIdx];
      this.mode = 'LOCKED';
      this.lockNextEnd = lastPreambleEntry.end + this.bitSamples;
      // Maximum allowance: 8 (start) + 8 (len) + 64*8 (data) + 8 (chk) + 8 (end) + margin
      this.lockWatchdog = this.lockNextEnd + this.bitSamples * (8 + 8 + 64 * 8 + 8 + 8 + 32);
      this.rxByteBuffer = '';
      this.setRxState('SYNCED');
      this.onLog?.(
        `Carrier locked onto preamble [Score: ${bestScore}/16, Phase: ${bestPhase}]. Awaiting start flag...`,
        'ok'
      );
      return true;
    }

    return false;
  }

  private dispatchTelemetry(m0: number, m1: number, bit: '0' | '1', ratio: number) {
    const isConfident = ratio >= this.config.minRatio;
    const winnerFreq = bit === '1' ? this.config.freq1 : this.config.freq0;
    const snrDb = Math.max(0, Math.round(20 * Math.log10(ratio)));
    const signalStrengthPct = Math.min(
      100,
      Math.max(0, Math.round((Math.log10(Math.max(1, ratio)) / Math.log10(8)) * 100))
    );

    let correlationScore = 0;
    if (this.subTrace.length >= PROTOCOL.PREAMBLE.length) {
      for (let i = 0; i < PROTOCOL.PREAMBLE.length; i++) {
        const entry = this.subTrace[this.subTrace.length - PROTOCOL.PREAMBLE.length + i];
        if (entry && entry.bit === PROTOCOL.PREAMBLE[i]) correlationScore++;
      }
    }

    this.onTelemetryUpdate?.({
      m0,
      m1,
      ratio,
      snrDb,
      detectedBit: isConfident ? bit : '–',
      detectedFreq: isConfident ? winnerFreq : 0,
      isConfident,
      signalStrengthPct,
      correlationScore: this.mode === 'LOCKED' ? 16 : correlationScore,
      rollingBits: this.rxRollingBits,
      sampleRate: this.sampleRate,
      noiseFloor: Math.min(m0, m1),
      activeBytesProgress: { current: this.rxByteCount, total: this.rxExpectedLen },
    });
  }

  private processBit(bit: '0' | '1', ratio: number) {
    this.rxRollingBits += bit;
    if (this.rxRollingBits.length > 256) {
      this.rxRollingBits = this.rxRollingBits.slice(-256);
    }

    this.rxByteBuffer += bit;
    this.currentSnrSum += 20 * Math.log10(Math.max(1, ratio));
    this.currentSnrSamples++;

    if (this.rxState === 'SYNCED' || this.rxState === 'READING_START') {
      this.setRxState('READING_START');
      if (this.rxByteBuffer.length === 8) {
        if (this.rxByteBuffer === PROTOCOL.START_MARKER) {
          this.setRxState('READING_LENGTH');
          this.rxByteBuffer = '';
          this.onLog?.('Start marker detected (0xFF). Reading payload length...', 'info');
        } else {
          this.onLog?.('Start marker mismatch. Resetting preamble hunt.', 'warn');
          this.reHunt();
        }
      }
      return;
    }

    if (this.rxState === 'READING_LENGTH') {
      if (this.rxByteBuffer.length === 16) {
        this.rxExpectedLen = parseInt(this.rxByteBuffer, 2);
        this.rxByteBuffer = '';
        this.rxDataBits = '';
        this.rxByteCount = 0;

        if (this.rxExpectedLen === 0 || this.rxExpectedLen > PROTOCOL.MAX_PAYLOAD_LEN) {
          this.onLog?.(`Corrupt length header (${this.rxExpectedLen} B). Discarding packet.`, 'warn');
          this.reHunt();
          return;
        }

        this.setRxState('READING_DATA');
        this.onLog?.(`Reading payload (${this.rxExpectedLen} bytes)...`, 'info');
      }
      return;
    }

    if (this.rxState === 'READING_DATA') {
      this.rxDataBits += bit;
      if (this.rxByteBuffer.length === 8) {
        this.rxByteCount++;
        this.rxByteBuffer = '';

        if (this.rxByteCount === this.rxExpectedLen) {
          this.setRxState('READING_CHECKSUM');
          this.rxByteBuffer = '';
          this.onLog?.('All payload bytes received. Verifying XOR checksum...', 'info');
        }
      }
      return;
    }

    if (this.rxState === 'READING_CHECKSUM') {
      if (this.rxByteBuffer.length === 16) {
        const receivedChecksum = parseInt(this.rxByteBuffer, 2);
        const processedBytes = bitsToBytes(this.rxDataBits);
        const expectedChecksum = crc16(processedBytes);
        const isValid = receivedChecksum === expectedChecksum;
        const avgSnrDb =
          this.currentSnrSamples > 0 ? Math.round(this.currentSnrSum / this.currentSnrSamples) : 0;

        (async () => {
          try {
            const plaintextBytes = processedBytes;
            
            const messageRecord = {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: Date.now(),
              text: "BINARY_PAYLOAD", 
              bytes: plaintextBytes,
              length: plaintextBytes.length,
              receivedChecksum,
              expectedChecksum,
              isValid,
              rawBits: this.rxDataBits,
              snrSnapshotDb: avgSnrDb,
            };

            if (isValid) {
              this.setRxState('MESSAGE_OK');
              this.onLog?.(
                `Packet CRC-16 matched. Forwarding to transport layer... [SNR: ${avgSnrDb}dB]`,
                'ok'
              );
            } else {
              this.setRxState('CHECKSUM_ERROR');
              this.onLog?.(
                `CRC-16 mismatch! R: 0x${receivedChecksum.toString(16)} E: 0x${expectedChecksum.toString(16)}`,
                'error'
              );
            }

            this.onMessageReceived?.(messageRecord);
          } catch(e) {
             this.onLog?.("Decryption failed (AES-GCM). Wrong PIN?", "error");
          }
        })();
        
        this.rxByteBuffer = '';
        setTimeout(() => this.reHunt(), 500);
      }
      return;
    }
  }

  private reHunt() {
    this.resetDemod();
    this.setRxState('HUNTING');
  }

  // ------------------ TRANSMITTER ------------------
  public async checkChannelClear(): Promise<boolean> {
    if (!this.analyser) return true;
    const data = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(data);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const getEnergy = (freq) => data[Math.round(freq / binHz)];
    return getEnergy(this.config.freq0) < -55 && getEnergy(this.config.freq1) < -55;
  }

  public async transmitBitstream(
    bits: string,
    onProgress?: (progress: number, currentBit: string, bitIndex: number) => void
  ): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    let isClear = false;
    let attempts = 0;
    while (!isClear && attempts < 8) {
      isClear = await this.checkChannelClear();
      if (!isClear) {
         this.onLog?.('CSMA/CA: Channel busy (Carrier detected). Backing off...', 'warn');
         await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
         attempts++;
      }
    }
    const bitDurSec = this.config.bitDurationMs / 1000;
    const startTime = ctx.currentTime + 0.1; // 100ms lead-in
    const totalDurationSec = bits.length * bitDurSec;

    const osc = ctx.createOscillator();
    const masterGain = ctx.createGain();

    // Smooth entry and exit envelope
    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.exponentialRampToValueAtTime(this.config.txVolume, startTime + 0.02);
    masterGain.gain.setValueAtTime(this.config.txVolume, startTime + totalDurationSec - 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + totalDurationSec);

    // Schedule frequency changes
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i];
      const freq = bit === '0' ? this.config.freq0 : this.config.freq1;
      const t = startTime + i * bitDurSec;
      osc.frequency.setValueAtTime(freq, t);
    }

    // Connect to speakers
    osc.connect(masterGain);
    masterGain.connect(ctx.destination);

    // If loopback is enabled, route internally to the receiver
    if (this.config.loopbackMode && this.loopbackGain) {
      masterGain.connect(this.loopbackGain);
    }

    this.activeTxOsc = osc;
    osc.start(startTime);
    osc.stop(startTime + totalDurationSec + 0.05);

    // Track real-time progress callbacks
    const intervalMs = 25;
    const tracker = setInterval(() => {
      const elapsed = ctx.currentTime - startTime;
      if (elapsed < 0) {
        onProgress?.(0, bits[0], 0);
        return;
      }
      const bitIndex = Math.min(bits.length - 1, Math.floor(elapsed / bitDurSec));
      const pct = Math.min(100, Math.round((elapsed / totalDurationSec) * 100));
      onProgress?.(pct, bits[bitIndex] || '0', bitIndex);

      if (elapsed >= totalDurationSec) {
        clearInterval(tracker);
        onProgress?.(100, bits[bits.length - 1], bits.length);
      }
    }, intervalMs);

    return new Promise((resolve) => {
      osc.onended = () => {
        clearInterval(tracker);
        this.activeTxOsc = null;
        resolve();
      };
    });
  }

  public stopTransmission() {
    if (this.activeTxOsc) {
      try {
        this.activeTxOsc.stop();
        this.activeTxOsc.disconnect();
      } catch {
        // Ignored if already stopped
      }
      this.activeTxOsc = null;
    }
  }

  // ------------------ TONE LAB & CALIBRATION ------------------
  public playTestTone(frequency: number, gainLevel: number = 0.25) {
    this.stopTestTone();
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    this.testToneOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = gainLevel;
    this.testToneOsc.frequency.setValueAtTime(frequency, ctx.currentTime);

    this.testToneOsc.connect(gain);
    gain.connect(ctx.destination);

    if (this.config.loopbackMode && this.loopbackGain) {
      gain.connect(this.loopbackGain);
    }

    this.testToneOsc.start();
  }

  public setTestToneFrequency(freq: number) {
    if (this.testToneOsc && this.ctx) {
      this.testToneOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    }
  }

  public stopTestTone() {
    if (this.testToneOsc) {
      try {
        this.testToneOsc.stop();
        this.testToneOsc.disconnect();
      } catch {
        // Safe disconnect
      }
      this.testToneOsc = null;
    }
  }

  public async runAutoCalibration(durationMs: number = 2000, onProgress: (p: number) => void): Promise<{freq0: number, freq1: number, noiseFloor: number}> {
    return new Promise((resolve, reject) => {
      if (!this.analyser || !this.ctx) { 
        reject(new Error("Microphone not active")); 
        return; 
      }
      
      const binCount = this.analyser.frequencyBinCount;
      const floatData = new Float32Array(binCount);
      const averages = new Float32Array(binCount);
      let samples = 0;
      
      const startTime = Date.now();
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        onProgress(Math.min(100, (elapsed / durationMs) * 100));
        
        this.analyser!.getFloatFrequencyData(floatData);
        for(let i=0; i<binCount; i++) {
          const linear = Math.pow(10, floatData[i] / 20);
          averages[i] += linear;
        }
        samples++;
        
        if (elapsed >= durationMs) {
          clearInterval(interval);
          for(let i=0; i<binCount; i++) averages[i] /= samples;
          
          const sampleRate = this.ctx!.sampleRate;
          const binHz = sampleRate / this.analyser!.fftSize;
          
          let bestStartFreq = 0;
          let minNoise = Infinity;
          
          const startBinLimit = Math.floor(2000 / binHz); // Start looking at 2kHz
          const endBinLimit = Math.floor(18000 / binHz); // Stop looking at 18kHz
          const bandBins = Math.floor(1500 / binHz); // Looking for a quiet 1.5kHz spread
          
          for (let i = startBinLimit; i < endBinLimit - bandBins; i++) {
            let currentNoise = 0;
            for(let j=0; j<bandBins; j++) currentNoise += averages[i+j];
            if (currentNoise < minNoise) {
              minNoise = currentNoise;
              bestStartFreq = i * binHz;
            }
          }
          
          const noiseFloorDb = 20 * Math.log10(minNoise / bandBins);
          resolve({
            freq0: Math.round(bestStartFreq + 200),
            freq1: Math.round(bestStartFreq + 1200), // 1kHz separation
            noiseFloor: noiseFloorDb
          });
        }
      }, 50);
    });
  }
}
