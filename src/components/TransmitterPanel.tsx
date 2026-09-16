import React, { useState } from 'react';
import { useModem } from '../context/ModemContext';
import { buildPacket } from '../services/packetCodec';
import { Send, Square, Sparkles, Layers, Volume2, Info, Check } from 'lucide-react';

const PRESET_MESSAGES = [
  'Hello World!',
  'Acoustic Telemetry Link OK',
  'GPS: 37.7749,-122.4194',
  'PING-200-ACK',
  'SOS-BEACON-3.1415',
];

export const TransmitterPanel: React.FC = () => {
  const { config, transmitMessage, stopTransmission, isTransmitting, txProgress } = useModem();
  const [message, setMessage] = useState<string>('Hello World!');

  const packet = buildPacket(message, config.bitDurationMs);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isTransmitting) return;
    await transmitMessage(message);
  };

  return (
    <div className="space-y-4">
      {/* Transmitter Composer Card */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
              Acoustic Packet Transmitter
            </h2>
          </div>
          <span className="text-xs font-mono-code text-slate-400">
            Carrier: {config.freq0}Hz / {config.freq1}Hz
          </span>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="payloadInput" className="text-xs font-medium text-slate-300">
                Payload Text
              </label>
              <span className="text-[11px] font-mono-code text-slate-400">
                {message.length} / 64 characters
              </span>
            </div>
            <div className="relative">
              <input
                id="payloadInput"
                type="text"
                value={message}
                maxLength={64}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type alphanumeric acoustic message..."
                disabled={isTransmitting}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono-code text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/40 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Quick Preset Badges */}
          <div>
            <span className="text-[11px] font-mono-code text-slate-500 uppercase tracking-wider block mb-2">
              Preset Payloads:
            </span>
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
          </div>

          {/* Transmission Action Button & Real-Time Progress */}
          <div className="pt-2">
            {!isTransmitting ? (
              <button
                type="submit"
                disabled={!message.trim()}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-display font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>Transmit Over Audio</span>
              </button>
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

      {/* Packet Serialization Breakdown */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wide">
              Packet Framing Architecture
            </h3>
          </div>
          <span className="text-xs font-mono-code text-slate-400">
            Duration: {(packet.totalDurationMs / 1000).toFixed(2)}s · {packet.full.length} bits
          </span>
        </div>

        {/* Structured Segment Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">PREAMBLE (16b)</span>
            <span className="text-xs font-mono-code font-bold text-amber-400 truncate block">10101010...</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">START (8b)</span>
            <span className="text-xs font-mono-code font-bold text-cyan-400 block">11111111 (0xFF)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">LENGTH (8b)</span>
            <span className="text-xs font-mono-code font-bold text-blue-400 block">
              {packet.lengthBits} ({packet.payloadLength}B)
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 sm:col-span-1">
            <span className="text-[10px] font-mono-code text-slate-400 block">PAYLOAD ({packet.payloadLength * 8}b)</span>
            <span className="text-xs font-mono-code font-bold text-emerald-400 truncate block">
              {packet.payloadLength} chars
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">CRC XOR (8b)</span>
            <span className="text-xs font-mono-code font-bold text-indigo-400 block">
              {packet.checksumBits} (0x{packet.checksum.toString(16).toUpperCase()})
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">END FLAG (8b)</span>
            <span className="text-xs font-mono-code font-bold text-slate-400 block">00000000 (0x00)</span>
          </div>
        </div>

        {/* Full Bitstream Raw Stream Preview */}
        <div>
          <span className="text-[11px] font-mono-code text-slate-400 uppercase tracking-wider block mb-1">
            Complete Transmit Bitstream:
          </span>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono-code text-xs tracking-wider text-slate-300 break-all max-h-24 overflow-y-auto leading-relaxed">
            <span className="text-amber-400">{packet.preamble}</span>
            <span className="text-cyan-400">{packet.startMarker}</span>
            <span className="text-blue-400">{packet.lengthBits}</span>
            <span className="text-emerald-300">{packet.dataBits}</span>
            <span className="text-indigo-400">{packet.checksumBits}</span>
            <span className="text-slate-500">{packet.endMarker}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
