import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  ModulationConfig,
  FrequencyProfile,
  RxLinkState,
  TelemetryData,
  ReceivedMessage,
  LogEntry,
  VisualizerMode,
} from '../types';
import { AudioModemEngine } from '../services/audioEngine';
import { buildPacket } from '../services/packetCodec';

export const PROFILE_PRESETS: Record<
  FrequencyProfile,
  { name: string; description: string; freq0: number; freq1: number; bitDurationMs: number }
> = {
  ultrasonic: {
    name: 'Near-Ultrasound (Acoustic Stealth)',
    description: '18.5 kHz & 19.5 kHz — Inaudible to most adults; pristine over-the-air link.',
    freq0: 18500,
    freq1: 19500,
    bitDurationMs: 80,
  },
  'audible-hf': {
    name: 'High-Band Audio (Robust Edge)',
    description: '12.0 kHz & 14.0 kHz — High fidelity on all mobile device speakers and microphones.',
    freq0: 12000,
    freq1: 14000,
    bitDurationMs: 70,
  },
  'standard-af': {
    name: 'Standard Voice-Band (Bell 202)',
    description: '1.2 kHz & 2.2 kHz — Audible carrier chirps, maximum penetration and noise immunity.',
    freq0: 1200,
    freq1: 2200,
    bitDurationMs: 60,
  },
  'long-range': {
    name: 'Long-Range Deep Penetration',
    description: '800 Hz & 1.2 kHz @ 120ms — Ultra-low frequency and slow baud rate to penetrate walls and travel maximum acoustic distance.',
    freq0: 800,
    freq1: 1200,
    bitDurationMs: 120,
  },
  custom: {
    name: 'Custom Calibration',
    description: 'User-defined carrier tone pair for laboratory experimentation.',
    freq0: 18500,
    freq1: 19500,
    bitDurationMs: 80,
  },
};

const DEFAULT_CONFIG: ModulationConfig = {
  freq0: PROFILE_PRESETS.ultrasonic.freq0,
  freq1: PROFILE_PRESETS.ultrasonic.freq1,
  bitDurationMs: PROFILE_PRESETS.ultrasonic.bitDurationMs,
  subStepMs: 10,
  minRatio: 1.7,
  profile: 'ultrasonic',
  txVolume: 0.35,
  loopbackMode: false,
  rampEnvelope: true,
  channelKey: '',
};

const INITIAL_TELEMETRY: TelemetryData = {
  m0: 0,
  m1: 0,
  ratio: 1,
  snrDb: 0,
  detectedBit: '–',
  detectedFreq: 0,
  isConfident: false,
  signalStrengthPct: 0,
  correlationScore: 0,
  rollingBits: '',
  sampleRate: 48000,
  noiseFloor: 0,
  activeBytesProgress: { current: 0, total: 0 },
};

interface ModemContextType {
  config: ModulationConfig;
  rxState: RxLinkState;
  isListening: boolean;
  isTransmitting: boolean;
  txProgress: { percent: number; currentBit: string; bitIndex: number; totalBits: number };
  telemetry: TelemetryData;
  messages: ReceivedMessage[];
  logs: LogEntry[];
  engine: AudioModemEngine | null;
  activeTab: 'dashboard' | 'transmitter' | 'receiver' | 'tonelab' | 'history' | 'how-it-works';
  visualizerMode: VisualizerMode;
  isInspectorOpen: boolean;
  isSettingsOpen: boolean;
  testToneActive: boolean;
  activeToneFreq: number;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  transmitMessage: (text: string) => Promise<void>;
  stopTransmission: () => void;
  playTestTone: (freq: number) => void;
  stopTestTone: () => void;
  updateConfig: (newConfig: Partial<ModulationConfig>) => void;
  setFrequencyProfile: (profile: FrequencyProfile) => void;
  clearLogs: () => void;
  clearMessages: () => void;
  setActiveTab: (tab: 'dashboard' | 'transmitter' | 'receiver' | 'tonelab' | 'history' | 'how-it-works') => void;
  setVisualizerMode: (mode: VisualizerMode) => void;
  setIsInspectorOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  toggleLoopback: () => void;
}

const ModemContext = createContext<ModemContextType | null>(null);

export const ModemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ModulationConfig>(DEFAULT_CONFIG);
  const [rxState, setRxState] = useState<RxLinkState>('OFFLINE');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [txProgress, setTxProgress] = useState({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transmitter' | 'receiver' | 'tonelab' | 'history' | 'how-it-works'>('dashboard');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('spectrum');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [testToneActive, setTestToneActive] = useState<boolean>(false);
  const [activeToneFreq, setActiveToneFreq] = useState<number>(DEFAULT_CONFIG.freq0);

  const engineRef = useRef<AudioModemEngine | null>(null);

  const addLog = useCallback((message: string, level: 'info' | 'ok' | 'warn' | 'error' = 'info') => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      level,
    };
    setLogs((prev) => [newEntry, ...prev].slice(0, 100));
  }, []);

  // Initialize AudioModemEngine once
  useEffect(() => {
    const engine = new AudioModemEngine(config, {
      onTelemetryUpdate: (data) => setTelemetry(data),
      onStateChange: (state) => setRxState(state),
      onMessageReceived: (msg) => {
        setMessages((prev) => [msg, ...prev].slice(0, 50));
      },
      onLog: (msg, level) => addLog(msg, level),
    });

    engineRef.current = engine;

    addLog('Acoustic FSK modem core initialized. Ready for air transmission.', 'info');

    return () => {
      engine.stopListening();
      engine.stopTestTone();
      engine.stopTransmission();
    };
  }, [addLog]);

  // Sync config updates to engine
  const updateConfig = useCallback((newConfig: Partial<ModulationConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      if (engineRef.current) {
        engineRef.current.updateConfig(updated);
      }
      return updated;
    });
  }, []);

  const setFrequencyProfile = useCallback(
    (profile: FrequencyProfile) => {
      const preset = PROFILE_PRESETS[profile];
      updateConfig({
        profile,
        freq0: preset.freq0,
        freq1: preset.freq1,
        bitDurationMs: preset.bitDurationMs,
      });
      addLog(`Profile switched to: ${preset.name} (${preset.freq0}Hz / ${preset.freq1}Hz)`, 'info');
    },
    [updateConfig, addLog]
  );

  const toggleLoopback = useCallback(() => {
    setConfig((prev) => {
      const nextLoopback = !prev.loopbackMode;
      const updated = { ...prev, loopbackMode: nextLoopback };
      if (engineRef.current) {
        engineRef.current.updateConfig(updated);
      }
      addLog(
        nextLoopback
          ? 'Internal loopback bridge ENGAGED. Transmitter feeds directly into receiver for single-device verification.'
          : 'Internal loopback bridge DISENGAGED. Modem operates over physical room acoustics.',
        nextLoopback ? 'ok' : 'info'
      );
      return updated;
    });
  }, [addLog]);

  const startListening = useCallback(async () => {
    if (!engineRef.current) return false;
    const ok = await engineRef.current.startListening();
    setIsListening(ok);
    return ok;
  }, []);

  const stopListening = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stopListening();
    setIsListening(false);
  }, []);

  const transmitMessage = useCallback(
    async (text: string) => {
      if (!engineRef.current || isTransmitting) return;
      const pkt = buildPacket(text, config.bitDurationMs, config.channelKey);

      setIsTransmitting(true);
      setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
      addLog(
        `Transmitting "${text}" (${pkt.payloadLength} B, ${pkt.full.length} bits @ ${config.bitDurationMs}ms/bit)...`,
        'info'
      );

      try {
        await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
          setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
        });
        addLog(`Burst transmission completed for "${text}".`, 'ok');
      } catch (err) {
        addLog(`Transmission error: ${err instanceof Error ? err.message : 'aborted'}`, 'error');
      } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
      }
    },
    [config.bitDurationMs, isTransmitting, addLog]
  );

  const stopTransmission = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stopTransmission();
      setIsTransmitting(false);
      setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
      addLog('Transmission aborted by operator.', 'warn');
    }
  }, [addLog]);

  const playTestTone = useCallback(
    (freq: number) => {
      if (!engineRef.current) return;
      setActiveToneFreq(freq);
      engineRef.current.playTestTone(freq, config.txVolume);
      setTestToneActive(true);
      addLog(`Emitting continuous carrier tone at ${freq} Hz`, 'info');
    },
    [config.txVolume, addLog]
  );

  const stopTestTone = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stopTestTone();
    setTestToneActive(false);
    addLog('Test carrier tone halted.', 'info');
  }, [addLog]);

  const clearLogs = useCallback(() => setLogs([]), []);
  const clearMessages = useCallback(() => setMessages([]), []);

  return (
    <ModemContext.Provider
      value={{
        config,
        rxState,
        isListening,
        isTransmitting,
        txProgress,
        telemetry,
        messages,
        logs,
        engine: engineRef.current,
        activeTab,
        visualizerMode,
        isInspectorOpen,
        isSettingsOpen,
        testToneActive,
        activeToneFreq,
        startListening,
        stopListening,
        transmitMessage,
        stopTransmission,
        playTestTone,
        stopTestTone,
        updateConfig,
        setFrequencyProfile,
        clearLogs,
        clearMessages,
        setActiveTab,
        setVisualizerMode,
        setIsInspectorOpen,
        setIsSettingsOpen,
        toggleLoopback,
      }}
    >
      {children}
    </ModemContext.Provider>
  );
};

export const useModem = () => {
  const ctx = useContext(ModemContext);
  if (!ctx) throw new Error('useModem must be used within ModemProvider');
  return ctx;
};
