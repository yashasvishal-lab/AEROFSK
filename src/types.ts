export type FrequencyProfile = 'ultrasonic' | 'audible-hf' | 'standard-af' | 'custom';

export interface ModulationConfig {
  freq0: number; // Hz for binary '0'
  freq1: number; // Hz for binary '1'
  bitDurationMs: number; // duration of each bit in ms (e.g. 50, 80, 100)
  subStepMs: number; // correlation sample resolution in ms
  minRatio: number; // SNR discrimination factor
  profile: FrequencyProfile;
  txVolume: number; // 0.05 to 1.0
  loopbackMode: boolean; // internal software loopback for single-device verification
  rampEnvelope: boolean; // anti-click Hann envelope on bit transitions
}

export type RxLinkState =
  | 'OFFLINE'
  | 'IDLE'
  | 'HUNTING'
  | 'SYNCED'
  | 'READING_START'
  | 'READING_LENGTH'
  | 'READING_DATA'
  | 'READING_CHECKSUM'
  | 'MESSAGE_OK'
  | 'CHECKSUM_ERROR';

export interface TelemetryData {
  m0: number;
  m1: number;
  ratio: number;
  snrDb: number;
  detectedBit: '0' | '1' | '–';
  detectedFreq: number;
  isConfident: boolean;
  signalStrengthPct: number;
  correlationScore: number; // out of 16
  rollingBits: string;
  sampleRate: number;
  noiseFloor: number;
  activeBytesProgress: { current: number; total: number };
}

export interface PacketBreakdown {
  full: string;
  preamble: string;
  startMarker: string;
  lengthBits: string;
  dataBits: string;
  checksumBits: string;
  endMarker: string;
  checksum: number;
  payloadLength: number;
  totalDurationMs: number;
  estimatedBps: number;
}

export interface ReceivedMessage {
  id: string;
  timestamp: number;
  text: string;
  length: number;
  receivedChecksum: number;
  expectedChecksum: number;
  isValid: boolean;
  rawBits: string;
  snrSnapshotDb: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'ok' | 'warn' | 'error';
}

export type VisualizerMode = 'spectrum' | 'waterfall' | 'oscilloscope';
