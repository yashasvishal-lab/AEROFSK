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
import { buildPacket, buildTransportPacket, textToBytes, bytesToText, generateECDH, deriveAES, encryptWithKey, decryptWithKey } from '../services/packetCodec';

export const PROFILE_PRESETS: Record<
  FrequencyProfile,
  { name: string; description: string; freq0: number; freq1: number; bitDurationMs: number }
> = {
  ultrasonic: {
    name: 'Near-Ultrasound (Acoustic Stealth)',
    description: '18.5 kHz & 19.5 kHz — Inaudible to most adults; pristine over-the-air link.',
    freq0: 18500,
    freq1: 19500,
    bitDurationMs: 40,
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
  const [myNodeId] = useState<number>(() => Math.floor(Math.random() * 254) + 1);
  const [fileTransfers, setFileTransfers] = useState<Record<number, import('../types').FileTransferState>>({});
  const [activeToneFreq, setActiveToneFreq] = useState<number>(DEFAULT_CONFIG.freq0);

  
  const engineRef = useRef<AudioModemEngine | null>(null);
  const abortTxRef = useRef<boolean>(false);
  
  // Cryptographic State
  const ecdhKeysRef = useRef<{ [nodeId: number]: CryptoKey }>({});
  const myEphemeralKeys = useRef<{ [nodeId: number]: CryptoKeyPair }>({});


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
      onMessageReceived: async (msg) => {
        if (!msg.bytes || msg.bytes.length < 6) return;
        const decrypted = msg.bytes;

        const type = decrypted[0];
        const targetId = decrypted[1];
        const senderId = decrypted[2];
        const msgId = decrypted[3];
        const chunkIdx = decrypted[4];
        const totalChunks = decrypted[5];
        const data = decrypted.slice(6);

        if (type === 2) {
          addLog(`[ARQ] Received ACK for Msg ${msgId}`, 'ok');
          window.dispatchEvent(new CustomEvent('modem_ack', { detail: { msgId, chunkIdx } }));
          return;
        }

        if (targetId !== 0 && targetId !== myNodeId) {
          addLog(`Ignored packet addressed to Node ${targetId}`, "info");
          return;
        }

        // ACK standard targeted packets
        if (targetId === myNodeId && type !== 2) {
          setTimeout(async () => {
             if (!engineRef.current) return;
             const ackPkt = await buildTransportPacket(2, senderId, myNodeId, msgId, chunkIdx, 1, new Uint8Array(0), config.bitDurationMs);
             await engineRef.current.transmitBitstream(ackPkt.full);
          }, 300);
        }

        // ECDH KEY OFFER (Type 3)
        if (type === 3) {
           addLog(`[ECDH] Received Key Offer from Node ${senderId}. Generating ephemeral key...`, "info");
           const { keyPair, pubRaw } = await generateECDH();
           const sharedAes = await deriveAES(keyPair.privateKey, data);
           ecdhKeysRef.current[senderId] = sharedAes;
           addLog(`[ECDH] Shared AES-256 Secret derived. Replying with Key Accept...`, "ok");
           
           setTimeout(async () => {
              if (!engineRef.current) return;
              const acceptPkt = await buildTransportPacket(4, senderId, myNodeId, Math.floor(Math.random()*255), 1, 1, pubRaw, config.bitDurationMs);
              await engineRef.current.transmitBitstream(acceptPkt.full);
           }, 800);
           return;
        }

        // ECDH KEY ACCEPT (Type 4)
        if (type === 4) {
           addLog(`[ECDH] Received Key Accept from Node ${senderId}.`, "info");
           const myPriv = myEphemeralKeys.current[senderId];
           if (myPriv) {
              const sharedAes = await deriveAES(myPriv.privateKey, data);
              ecdhKeysRef.current[senderId] = sharedAes;
              addLog(`[ECDH] Handshake Complete. Secure Tunnel Established.`, "ok");
              window.dispatchEvent(new CustomEvent(`ecdh_ready_${senderId}`));
           }
           return;
        }

        // SECURE PAYLOAD (Type 5)
        if (type === 5) {
           const aesKey = ecdhKeysRef.current[senderId];
           if (!aesKey) {
              addLog(`[SECURE] Received encrypted data from Node ${senderId} but no keys exist!`, "error");
              return;
           }
           try {
              const plaintext = await decryptWithKey(data, aesKey);
              setMessages(prev => [{...msg, text: `[SECURE] ${bytesToText(plaintext)}`, senderId, targetId}, ...prev]);
              addLog(`[SECURE] Decrypted AES-256 payload from Node ${senderId}`, 'ok');
           } catch(e) {
              addLog(`[SECURE] Failed to decrypt payload from Node ${senderId}`, 'error');
           }
           return;
        }

        // DEFAULT (Type 1 - Unencrypted/Files)
        if (totalChunks > 1) {
          setFileTransfers(prev => {
             const existing = prev[msgId] || { msgId, filename: 'file.dat', mimeType: 'application/octet-stream', totalChunks, chunks: {}, completed: false, progress: 0 };
             existing.chunks[chunkIdx] = data;
             existing.progress = Object.keys(existing.chunks).length / totalChunks;
             if (existing.progress === 1 && !existing.completed) {
                existing.completed = true;
                let totalLen = 0;
                for(let i=1; i<=totalChunks; i++) totalLen += existing.chunks[i].length;
                const fullArray = new Uint8Array(totalLen);
                let offset = 0;
                for(let i=1; i<=totalChunks; i++) {
                   fullArray.set(existing.chunks[i], offset);
                   offset += existing.chunks[i].length;
                }
                const blob = new Blob([fullArray], { type: 'application/octet-stream' });
                existing.dataUrl = URL.createObjectURL(blob);
                addLog(`File reception complete (Msg ${msgId})`, 'ok');
                setMessages(m => [{...msg, text: `[FILE RECEIVED] ${totalChunks} chunks`, senderId, targetId, isFile: true, id: existing.dataUrl}, ...m]);
             }
             return {...prev, [msgId]: existing};
          });
        } else {
          setMessages(prev => [{...msg, text: bytesToText(data), senderId, targetId}, ...prev]);
        }
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

  const runAutoCalibration = useCallback(async () => {
    if (!engineRef.current) return;
    addLog("Starting Auto-Calibration (2 seconds)... please remain quiet.", "info");
    try {
      const res = await engineRef.current.runAutoCalibration(2000, (p) => {});
      addLog(`Auto-Calibrated! Found quiet floor (${res.noiseFloor.toFixed(1)}dB). Using F0=${res.freq0}Hz, F1=${res.freq1}Hz`, "ok");
      setConfig(prev => ({...prev, freq0: res.freq0, freq1: res.freq1, profile: 'custom'}));
    } catch (e) {
      addLog("Auto-calibration failed. Mic active?", "error");
    }
  }, [addLog]);

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

  
  const transmitSecureMessage = useCallback(
    async (text: string, targetId: number) => {
      if (!engineRef.current || isTransmitting || targetId === 0) return;
      abortTxRef.current = false;
      setIsTransmitting(true);
      
      try {
        let aesKey = ecdhKeysRef.current[targetId];
        
        if (!aesKey) {
           addLog(`[ECDH] Initiating Military-Grade Handshake with Node ${targetId}...`, "info");
           const { keyPair, pubRaw } = await generateECDH();
           myEphemeralKeys.current[targetId] = keyPair;
           
           const offerPkt = await buildTransportPacket(3, targetId, myNodeId, Math.floor(Math.random()*255), 1, 1, pubRaw, config.bitDurationMs);
           
           setTxProgress({ percent: 0, currentBit: offerPkt.full[0], bitIndex: 0, totalBits: offerPkt.full.length });
           await engineRef.current.transmitBitstream(offerPkt.full, (p, b, i) => setTxProgress({ percent: p, currentBit: b, bitIndex: i, totalBits: offerPkt.full.length }));
           
           addLog(`[ECDH] Key Offer Sent. Waiting for Accept...`, "warn");
           
           const accepted = await new Promise(resolve => {
              const h = () => resolve(true);
              window.addEventListener(`ecdh_ready_${targetId}`, h);
              setTimeout(() => { window.removeEventListener(`ecdh_ready_${targetId}`, h); resolve(false); }, 15000);
           });
           
           if (!accepted) throw new Error("ECDH Handshake Timeout");
           aesKey = ecdhKeysRef.current[targetId];
        }

        addLog(`[SECURE] Encrypting payload with AES-256-GCM...`, "info");
        const ciphertext = await encryptWithKey(textToBytes(text), aesKey);
        const msgId = Math.floor(Math.random() * 255);
        const securePkt = await buildTransportPacket(5, targetId, myNodeId, msgId, 1, 1, ciphertext, config.bitDurationMs);
        
        await engineRef.current.transmitBitstream(securePkt.full, (p, b, i) => setTxProgress({ percent: p, currentBit: b, bitIndex: i, totalBits: securePkt.full.length }));
        addLog(`[SECURE] Encrypted payload delivered.`, "ok");
        
      } catch (err: any) {
        addLog(`Secure transmission failed: ${err.message}`, 'error');
      } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
      }
    },
    [config.bitDurationMs, isTransmitting, addLog, myNodeId]
  );


  const transmitMessage = useCallback(
    async (text: string, targetId: number = 0) => {
      if (!engineRef.current || isTransmitting) return;
      const msgId = Math.floor(Math.random() * 255);
      abortTxRef.current = false;
      const pkt = await buildTransportPacket(0, targetId, myNodeId, msgId, 1, 1, textToBytes(text), config.bitDurationMs);

      setIsTransmitting(true);
      setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
      addLog(
        `Transmitting "${text}" to Node ${targetId} (${pkt.payloadLength} B, ${pkt.full.length} bits)...`,
        'info'
      );

      try {
        await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
          setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
        });
        addLog(`Burst completed for "${text}".`, 'ok');
      } catch (err) {
        addLog(`Transmission error`, 'error');
      } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
      }
    },
    [config.bitDurationMs, config.channelKey, isTransmitting, addLog, myNodeId]
  );
  
  const transmitFile = useCallback(async (file: File, targetId: number) => {
     if (!engineRef.current || isTransmitting) return;
     const msgId = Math.floor(Math.random() * 255);
     const buffer = await file.arrayBuffer();
     const uint8 = new Uint8Array(buffer);
     
     const chunkSize = 256; 
     const totalChunks = Math.ceil(uint8.length / chunkSize);
     
     if (totalChunks > 255) {
       addLog("File too large. Max 64KB allowed.", "error");
       return;
     }

     abortTxRef.current = false;
     setIsTransmitting(true);
     addLog(`Starting file transfer: ${file.name} (${totalChunks} chunks)`, "info");
     
     try {
       for(let chunkIdx=1; chunkIdx<=totalChunks; chunkIdx++) {
         if (abortTxRef.current) throw new Error('Aborted');
         const data = uint8.slice((chunkIdx-1)*chunkSize, chunkIdx*chunkSize);
         const pkt = await buildTransportPacket(1, targetId, myNodeId, msgId, chunkIdx, totalChunks, data, config.bitDurationMs);
         
         let success = false;
         for (let attempt = 1; attempt <= 3; attempt++) {
            if (abortTxRef.current) throw new Error('Aborted');
            setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
            await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
              setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
            });
            
            if (targetId === 0) {
               // Broadcasts do not request ACKs to avoid ACK storms
               await new Promise(r => setTimeout(r, 400));
               success = true;
               break;
            }

            addLog(`[ARQ] Waiting for ACK on chunk ${chunkIdx} (Attempt ${attempt}/3)...`, 'info');
            const acked = await new Promise(resolve => {
               const handler = (e) => {
                  if (e.detail.msgId === msgId && e.detail.chunkIdx === chunkIdx) {
                     window.removeEventListener('modem_ack', handler);
                     resolve(true);
                  }
               };
               window.addEventListener('modem_ack', handler);
               setTimeout(() => {
                  window.removeEventListener('modem_ack', handler);
                  resolve(false);
               }, 4000); // 4s timeout for ACK
            });

            if (acked) {
               success = true;
               break;
            } else {
               addLog(`[ARQ] Timeout on chunk ${chunkIdx}. Retrying...`, 'warn');
            }
         }
         
         if (!success) {
            throw new Error(`Failed to deliver chunk ${chunkIdx} after 3 attempts.`);
         }
         if (abortTxRef.current) throw new Error('Aborted');
       }
       addLog(`File ${file.name} sent successfully.`, 'ok');
     } catch(e) {
        addLog("File transfer aborted.", "error");
     } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
     }
  }, [config.bitDurationMs, config.channelKey, isTransmitting, addLog, myNodeId]);
  

  const stopTransmission = useCallback(() => {
    abortTxRef.current = true;
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
    transmitSecureMessage,
        transmitFile,
        runAutoCalibration,
        myNodeId,
        fileTransfers,
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
