import React, { useState, useRef } from 'react';
import { Send, Square, TerminalSquare, Layers, Search, FileUp, Network, LockKeyhole } from 'lucide-react';
import { useModem } from '../context/ModemContext';
import { buildPacket, buildTransportPacket } from '../services/packetCodec';

const PRESET_MESSAGES = ['PING', 'ACK', 'TELEMETRY_DATA_SYNC', 'HELLO_WORLD'];

export const TransmitterPanel: React.FC = () => {
  const { transmitMessage, transmitSecureMessage, transmitFile, isTransmitting, txProgress, config, myNodeId, stopTransmission } = useModem();
  const [message, setMessage] = useState<string>('PING');
  const [targetId, setTargetId] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isTransmitting) {
      transmitMessage(message.trim(), targetId);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      transmitFile(file, targetId);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Only for UI preview purposes
  // packet preview removed because it is now async
  const packet = null; // buildTransportPacket(targetId, myNodeId, 0, 1, 1, message, config.channelKey, config.bitDurationMs);

  return (
    <div className="space-y-4">
      {/* Primary Input Container */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
              <TerminalSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="font-display font-semibold text-lg text-slate-100">Transmitter Console</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Network className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono-code text-cyan-400">My Node ID: {myNodeId}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
             {/* Target Addressing */}
             <div className="sm:col-span-1">
              <label htmlFor="targetInput" className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Node ID
              </label>
              <select
                id="targetInput"
                value={targetId}
                onChange={(e) => setTargetId(Number(e.target.value))}
                disabled={isTransmitting}
                className="w-full px-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono-code text-sm focus:outline-none focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/40 disabled:opacity-50"
              >
                <option value={0}>0 (Broadcast)</option>
                {Array.from({length: 254}).map((_, i) => (
                   <option key={i+1} value={i+1}>{i+1}</option>
                ))}
              </select>
            </div>

            {/* Main Text Input */}
            <div className="sm:col-span-3">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="payloadInput" className="text-xs font-medium text-slate-300">
                  Payload Text
                </label>
                <span className="text-[11px] font-mono-code text-slate-400">
                  {message.length} / 64 characters
                </span>
              </div>
              <input
                id="payloadInput"
                type="text"
                value={message}
                maxLength={64}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type alphanumeric message..."
                disabled={isTransmitting}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono-code text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/40 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Quick Preset Badges */}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {PRESET_MESSAGES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMessage(preset)}
                  disabled={isTransmitting}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono-code bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 transition-colors disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>
            
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
                disabled={isTransmitting}
              />
              <button 
                type="button" 
                disabled={isTransmitting}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Send File (Max 64KB)</span>
              </button>
            </div>
          </div>

          {/* Transmission Action Button & Real-Time Progress */}
          
          {/* Transmission Action Button & Real-Time Progress */}
          <div className="pt-2">
            {!isTransmitting ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => transmitMessage(message.trim(), targetId)}
                  disabled={!message.trim()}
                  className="flex-1 px-6 py-3.5 rounded-xl font-display font-bold text-sm tracking-wider uppercase bg-slate-800 text-slate-100 hover:bg-slate-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>Transmit Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => transmitSecureMessage(message.trim(), targetId)}
                  disabled={!message.trim() || targetId === 0}
                  className="flex-1 px-6 py-3.5 rounded-xl font-display font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={targetId === 0 ? "Target an explicit Node ID to use ECDH Security" : "Initiate ECDH Handshake and transmit encrypted"}
                >
                  <LockKeyhole className="w-4 h-4" />
                  <span>Transmit Secure</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs font-mono-code">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>ACOUSTIC BURST IN PROGRESS</span>
                  </div>
                  <span className="text-slate-300">
                    {txProgress.bitIndex} / {txProgress.totalBits} Bits ({txProgress.percent}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-75"
                    style={{ width: `${txProgress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono-code pt-1">
                  <span className="text-slate-400">
                    Active Carrier:{' '}
                    <strong className="text-cyan-300">
                      {txProgress.currentBit === '1' ? config.freq1 : config.freq0} Hz (Bit '{txProgress.currentBit}')
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={stopTransmission}
                    className="px-3 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs flex items-center space-x-1"
                  >
                    <Square className="w-3 h-3" />
                    <span>Halt</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
