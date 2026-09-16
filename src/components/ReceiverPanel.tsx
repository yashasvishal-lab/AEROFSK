import React, { useState } from 'react';
import { useModem } from '../context/ModemContext';
import {
  Mic,
  MicOff,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Radio,
  Binary,
  Cpu,
  ArrowRight,
  Clock,
  Sparkles,
  Trash2,
} from 'lucide-react';

export const ReceiverPanel: React.FC = () => {
  const {
    isListening,
    startListening,
    stopListening,
    rxState,
    telemetry,
    messages,
    clearMessages,
  } = useModem();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pipelineStages = [
    {
      id: 'detect',
      label: 'CARRIER DETECT',
      active: isListening,
      detail: isListening ? `${telemetry.detectedFreq || 0} Hz` : 'OFFLINE',
    },
    {
      id: 'sync',
      label: 'PREAMBLE SYNC',
      active: telemetry.correlationScore >= 14 || rxState !== 'HUNTING' && rxState !== 'OFFLINE',
      detail: `${telemetry.correlationScore}/16 bits`,
    },
    {
      id: 'frame',
      label: 'FRAME MARKER',
      active: ['READING_LENGTH', 'READING_DATA', 'READING_CHECKSUM', 'MESSAGE_OK'].includes(rxState),
      detail: ['READING_LENGTH', 'READING_DATA', 'READING_CHECKSUM', 'MESSAGE_OK'].includes(rxState)
        ? '0xFF DETECTED'
        : 'AWAITING',
    },
    {
      id: 'payload',
      label: 'PAYLOAD STREAM',
      active: ['READING_DATA', 'READING_CHECKSUM', 'MESSAGE_OK'].includes(rxState),
      detail:
        telemetry.activeBytesProgress.total > 0
          ? `${telemetry.activeBytesProgress.current}/${telemetry.activeBytesProgress.total} Bytes`
          : 'IDLE',
    },
    {
      id: 'checksum',
      label: 'CRC VALIDATION',
      active: rxState === 'MESSAGE_OK' || rxState === 'CHECKSUM_ERROR',
      detail:
        rxState === 'MESSAGE_OK'
          ? 'MATCHED OK'
          : rxState === 'CHECKSUM_ERROR'
          ? 'MISMATCH'
          : 'PENDING',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Control Card */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
                Acoustic Signal Receiver
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sample-accurate demodulator with dual-frequency Goertzel phase correlation.
            </p>
          </div>

          <button
            onClick={isListening ? stopListening : startListening}
            className={`px-6 py-3 rounded-xl font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg ${
              isListening
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:brightness-110 shadow-cyan-500/25'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Halt Receiver</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Activate Acoustic Link</span>
              </>
            )}
          </button>
        </div>

        {/* Demodulation Pipeline Flow */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <span className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 block mb-3">
            Hardware Demodulation Pipeline
          </span>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {pipelineStages.map((stage, idx) => (
              <div
                key={stage.id}
                className={`p-3 rounded-xl border text-center transition-all ${
                  stage.active
                    ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="text-[10px] font-mono-code text-slate-400 mb-1 flex items-center justify-center space-x-1">
                  <span>0{idx + 1}</span>
                  <span>·</span>
                  <span className="truncate">{stage.label}</span>
                </div>
                <div
                  className={`text-xs font-mono-code font-bold ${
                    stage.active ? 'text-cyan-300' : 'text-slate-500'
                  }`}
                >
                  {stage.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rolling Bitstream Inspector */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Binary className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
              Live Ring-Buffer Bitstream
            </span>
          </div>
          <span className="text-[11px] font-mono-code text-slate-400">
            {telemetry.rollingBits.length} bits captured
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono-code text-xs tracking-wider break-all min-h-[50px] max-h-24 overflow-y-auto leading-relaxed">
          {telemetry.rollingBits ? (
            <>
              <span className="text-slate-400">{telemetry.rollingBits.slice(0, -1)}</span>
              <span className="text-cyan-300 font-bold bg-cyan-500/20 px-0.5 rounded animate-pulse">
                {telemetry.rollingBits.slice(-1)}
              </span>
            </>
          ) : (
            <span className="text-slate-600 italic">No incoming carrier pulses detected...</span>
          )}
        </div>
      </div>

      {/* Decoded Packets Stream */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wide">
              Decoded Message Stream
            </h3>
            <span className="text-xs font-mono-code bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-full border border-slate-700">
              {messages.length} Packets
            </span>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-10 bg-slate-950/50 rounded-xl border border-dashed border-slate-800/80">
            <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Awaiting incoming transmissions</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Place the transmitter near this microphone, or toggle internal loopback mode to run a self-test.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    {msg.isValid ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-mono-code px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>CHECKSUM OK</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-mono-code px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>CRC MISMATCH</span>
                      </span>
                    )}

                    <span className="text-[11px] font-mono-code text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[11px] font-mono-code text-slate-500">·</span>
                    <span className="text-[11px] font-mono-code text-cyan-400/90">
                      SNR: {msg.snrSnapshotDb} dB
                    </span>
                  </div>

                  <p className="text-base font-semibold text-slate-100 font-mono-code select-all">
                    "{msg.text}"
                  </p>

                  <div className="text-[10px] font-mono-code text-slate-500">
                    Payload: {msg.length} Bytes · CRC: 0x{msg.receivedChecksum.toString(16).toUpperCase()}
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(msg.text, msg.id)}
                  className="self-start sm:self-center p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 transition-colors flex items-center space-x-1 text-xs"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
