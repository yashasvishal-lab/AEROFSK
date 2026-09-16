import React, { useState } from 'react';
import { Mic, MicOff, Activity, Copy, Check, Binary, Sparkles, CheckCircle2, XCircle, Trash2, Radio, Network, FileDown, ShieldCheck, Lock } from 'lucide-react';
import { useModem } from '../context/ModemContext';

export const ReceiverPanel: React.FC = () => {
  const {
    rxState,
    isListening,
    startListening,
    stopListening,
    telemetry,
    messages,
    fileTransfers,
    clearMessages,
    myNodeId,
    config
  } = useModem();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStageDetail = () => {
    switch (rxState) {
      case 'OFFLINE': return 'Offline';
      case 'IDLE': return 'Idle / No Signal';
      case 'HUNTING': return 'Scanning for Preamble...';
      case 'SYNCED': return 'Carrier Lock Achieved';
      case 'READING_START': return 'Start Delimiter Found';
      case 'READING_LENGTH': return 'Parsing Header...';
      case 'READING_DATA': return `Reading Payload...`;
      case 'READING_CHECKSUM': return 'Verifying Checksum...';
      case 'MESSAGE_OK': return 'Packet Received OK';
      case 'CHECKSUM_ERROR': return 'Packet CRC Failed';
      default: return rxState;
    }
  };

  const pipelineStages = [
    { id: 'hunt', label: 'PREAMBLE', active: ['HUNTING', 'SYNCED', 'READING_START', 'READING_LENGTH', 'READING_DATA', 'READING_CHECKSUM'].includes(rxState), detail: rxState === 'HUNTING' ? 'Scanning...' : 'Locked' },
    { id: 'start', label: 'START FLAG', active: ['READING_START', 'READING_LENGTH', 'READING_DATA', 'READING_CHECKSUM'].includes(rxState), detail: rxState === 'READING_START' ? '0xFF Found' : (rxState === 'HUNTING' ? 'Waiting' : 'Verified') },
    { id: 'data', label: 'PAYLOAD', active: ['READING_DATA', 'READING_CHECKSUM'].includes(rxState), detail: rxState === 'READING_DATA' ? `Reading...` : (rxState === 'HUNTING' || rxState === 'READING_START' || rxState === 'READING_LENGTH' ? 'Waiting' : 'Received') },
    { id: 'fec', label: 'AES-GCM/CRC', active: ['READING_CHECKSUM', 'MESSAGE_OK'].includes(rxState), detail: 'Decoding...' },
    { id: 'crc', label: 'VALIDATION', active: ['MESSAGE_OK', 'CHECKSUM_ERROR'].includes(rxState), detail: rxState === 'MESSAGE_OK' ? 'Valid' : (rxState === 'CHECKSUM_ERROR' ? 'Failed' : 'Pending') },
  ];

  return (
    <div className="space-y-4">
      {/* Primary DSP Control Module */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-bl from-cyan-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
                Acoustic Receiver
              </h2>
              <div className="flex items-center space-x-1.5 ml-4 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-mono-code text-cyan-400">Node {myNodeId}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sample-accurate dual-frequency Goertzel FSK demodulator.
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
                <span>Activate Link</span>
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

      {/* Active File Transfers (if any) */}
      {Object.values(fileTransfers).filter(f => !f.completed).length > 0 && (
         <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
            <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wide mb-3 flex items-center gap-2">
               <FileDown className="w-4 h-4 text-indigo-400" />
               Incoming File Transfers
            </h3>
            <div className="space-y-3">
              {Object.values(fileTransfers).filter(f => !f.completed).map(f => (
                 <div key={f.msgId} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex justify-between text-xs font-mono-code text-slate-300 mb-2">
                       <span>{f.filename}</span>
                       <span className="text-indigo-400">{Math.round(f.progress * 100)}% ({Object.keys(f.chunks).length}/{f.totalChunks})</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-indigo-500 transition-all" style={{width: `${f.progress * 100}%`}} />
                    </div>
                 </div>
              ))}
            </div>
         </div>
      )}

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
              Place the transmitter near this microphone. Addressing and AES-GCM encryption will be handled automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 w-full">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {msg.isFile ? <span className="inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30"><Network className="w-3 h-3" /><span>ARQ ACK SENT</span></span> : null}
                    {msg.senderId !== undefined && (
                       <span className="inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                          <Network className="w-3 h-3" />
                          <span>FROM: {msg.senderId}</span>
                       </span>
                    )}
                    {msg.text && msg.text.startsWith('[SECURE]') && (
    <span className="inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
      <Lock className="w-3 h-3 text-amber-400" />
      <span>AES-256 DECRYPTED</span>
    </span>
  )}
  {msg.isValid ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>CRC OK</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>CRC MISMATCH</span>
                      </span>
                    )}
                    
                    <span className="text-[10px] font-mono-code text-slate-500 ml-auto">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {msg.isFile ? (
                     <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                        <span className="text-sm font-semibold text-slate-200">{msg.text}</span>
                        <a href={msg.id} download="received_file.dat" className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-xs hover:bg-indigo-500/30">
                           Download
                        </a>
                     </div>
                  ) : (
                     <p className="text-base font-semibold text-slate-100 font-mono-code select-all break-all">
                       "{msg.text}"
                     </p>
                  )}
                  
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
