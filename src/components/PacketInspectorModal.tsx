import React, { useState } from 'react';
import { useModem } from '../context/ModemContext';
import { buildPacket, xorChecksum, textToBits } from '../services/packetCodec';
import { X, FileCode2, Binary, ShieldCheck, Check, Sparkles } from 'lucide-react';

export const PacketInspectorModal: React.FC = () => {
  const { isInspectorOpen, setIsInspectorOpen, config } = useModem();
  const [sampleText, setSampleText] = useState<string>('SOS');

  if (!isInspectorOpen) return null;

  const packet = buildPacket(sampleText, config.bitDurationMs);
  const sampleBits = textToBits(sampleText);
  const calculatedChecksum = xorChecksum(sampleText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <FileCode2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
                Acoustic Protocol Architecture
              </h2>
              <p className="text-xs text-slate-400">
                Binary framing, Goertzel tone discrimination, and XOR parity validation.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInspectorOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Packet Sandbox */}
        <div className="space-y-3">
          <label htmlFor="sampleInput" className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
            Test Payload Simulator:
          </label>
          <input
            id="sampleInput"
            type="text"
            value={sampleText}
            maxLength={16}
            onChange={(e) => setSampleText(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono-code text-sm focus:outline-none focus:border-cyan-400"
            placeholder="Type word..."
          />
        </div>

        {/* Frame Structure Graph */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
            Layer-1 Frame Structure:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-[11px] font-mono-code">
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <span className="block font-bold">PREAMBLE</span>
              <span>16 Bits</span>
              <span className="block text-[10px] opacity-75 mt-1">101010...</span>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <span className="block font-bold">START</span>
              <span>8 Bits</span>
              <span className="block text-[10px] opacity-75 mt-1">11111111</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300">
              <span className="block font-bold">LENGTH</span>
              <span>8 Bits</span>
              <span className="block text-[10px] opacity-75 mt-1">{packet.lengthBits}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <span className="block font-bold">DATA</span>
              <span>{sampleText.length * 8} Bits</span>
              <span className="block text-[10px] opacity-75 mt-1">{sampleText.length} Bytes</span>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              <span className="block font-bold">CRC XOR</span>
              <span>8 Bits</span>
              <span className="block text-[10px] opacity-75 mt-1">0x{calculatedChecksum.toString(16).toUpperCase()}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
              <span className="block font-bold">END</span>
              <span>8 Bits</span>
              <span className="block text-[10px] opacity-75 mt-1">00000000</span>
            </div>
          </div>
        </div>

        {/* Binary Byte Translation */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
            ASCII Character Byte Breakdown:
          </span>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono-code text-xs">
            {sampleText.split('').map((char, i) => {
              const code = char.charCodeAt(0);
              const bits = code.toString(2).padStart(8, '0');
              return (
                <div key={i} className="flex items-center justify-between border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-cyan-300 font-bold">Char: '{char}'</span>
                  <span className="text-slate-400">ASCII Dec: {code}</span>
                  <span className="text-slate-400">Hex: 0x{code.toString(16).toUpperCase()}</span>
                  <span className="text-emerald-400 font-bold">{bits}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goertzel Demodulation explanation */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2 leading-relaxed">
          <div className="font-semibold text-slate-200 font-mono-code uppercase">
            Goertzel Frequency-Shift Keying:
          </div>
          <p>
            Unlike a full discrete Fourier Transform (FFT) which calculates hundreds of frequency bins, the Goertzel algorithm computes exact second-order IIR filtering targeting only two carrier frequencies: <strong className="text-sky-300">F0 ({config.freq0} Hz)</strong> for bit '0' and <strong className="text-emerald-300">F1 ({config.freq1} Hz)</strong> for bit '1'.
          </p>
          <p>
            A sample-accurate ring buffer prevents JavaScript event loop jitter from dropping clock sync, allowing consistent synchronization over physical room air.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => setIsInspectorOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-semibold text-xs uppercase tracking-wider"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
