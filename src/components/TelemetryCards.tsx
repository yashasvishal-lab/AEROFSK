import React from 'react';
import { useModem } from '../context/ModemContext';
import { Zap, Gauge, Radio, Cpu, VolumeX } from 'lucide-react';

export const TelemetryCards: React.FC = () => {
  const { telemetry, config, isListening } = useModem();

  const m0Norm = Math.min(100, Math.round(telemetry.m0 * 5));
  const m1Norm = Math.min(100, Math.round(telemetry.m1 * 5));
  const effectiveBps = Math.round(1000 / config.bitDurationMs);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Tone Discrimination (F0 vs F1) */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Goertzel Discriminator</span>
          <Radio className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="my-3 space-y-2">
          {/* F0 bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono-code mb-1">
              <span className="text-sky-400">F0 ({config.freq0}Hz)</span>
              <span className="text-slate-300">{isListening ? telemetry.m0.toFixed(1) : '—'}</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-75"
                style={{ width: `${isListening ? m0Norm : 0}%` }}
              />
            </div>
          </div>

          {/* F1 bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono-code mb-1">
              <span className="text-emerald-400">F1 ({config.freq1}Hz)</span>
              <span className="text-slate-300">{isListening ? telemetry.m1.toFixed(1) : '—'}</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-75"
                style={{ width: `${isListening ? m1Norm : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400 pt-1 border-t border-slate-800/60">
          <span>Ratio: {isListening ? `${telemetry.ratio.toFixed(2)}x` : '1.00x'}</span>
          <span className={telemetry.isConfident ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
            {telemetry.isConfident ? 'DISCRIMINATED' : 'DIFFUSE'}
          </span>
        </div>
      </div>

      {/* Card 2: Current Decoded Bit */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Instant Bit Detection</span>
          <Cpu className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="flex items-baseline space-x-3 my-2">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center font-mono-code text-3xl font-bold border transition-all ${
              telemetry.detectedBit === '1'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-lg shadow-emerald-500/20'
                : telemetry.detectedBit === '0'
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 shadow-lg shadow-sky-500/20'
                : 'bg-slate-950 text-slate-600 border-slate-800'
            }`}
          >
            {isListening ? telemetry.detectedBit : '–'}
          </div>

          <div>
            <div className="text-xs font-mono-code text-slate-200">
              {isListening && telemetry.detectedFreq > 0 ? `${telemetry.detectedFreq} Hz` : 'Carrier Idle'}
            </div>
            <div className="text-[11px] text-slate-400">
              Confidence: {isListening ? `${telemetry.signalStrengthPct}%` : '0%'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400 pt-1 border-t border-slate-800/60">
          <span>Window: {config.bitDurationMs}ms</span>
          <span>~{effectiveBps} bps</span>
        </div>
      </div>

      {/* Card 3: Signal-to-Noise Ratio (SNR) */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Signal-to-Noise (SNR)</span>
          <Gauge className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="my-2">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-display font-bold text-slate-100">
              {isListening ? telemetry.snrDb : '0'}
            </span>
            <span className="text-xs font-mono-code text-slate-400">dB</span>
          </div>

          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-2">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                telemetry.snrDb > 15
                  ? 'bg-emerald-400'
                  : telemetry.snrDb > 8
                  ? 'bg-cyan-400'
                  : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(100, (telemetry.snrDb / 30) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400 pt-1 border-t border-slate-800/60">
          <span>Target: &gt;8 dB</span>
          <span className={telemetry.snrDb >= 12 ? 'text-emerald-400' : 'text-slate-400'}>
            {telemetry.snrDb >= 12 ? 'Optimal Margin' : 'Normal'}
          </span>
        </div>
      </div>

      {/* Card 4: Frame Sync & Correlation Score */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Preamble Sync Lock</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>

        <div className="my-2">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-display font-bold text-slate-100">
              {isListening ? telemetry.correlationScore : 0}
            </span>
            <span className="text-xs font-mono-code text-slate-400">/ 16 bits</span>
          </div>

          <div className="grid grid-cols-8 gap-1 mt-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-sm transition-all ${
                  isListening && i < telemetry.correlationScore
                    ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400 pt-1 border-t border-slate-800/60">
          <span>Lock Threshold: 14/16</span>
          <span className={telemetry.correlationScore >= 14 ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
            {telemetry.correlationScore >= 14 ? 'LOCKED' : 'SEEKING'}
          </span>
        </div>
      </div>
    </div>
  );
};
