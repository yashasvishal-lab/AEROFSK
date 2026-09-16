import React, { useState } from 'react';
import { useModem, PROFILE_PRESETS } from '../context/ModemContext';
import { FrequencyProfile } from '../types';
import { X, Sliders, Volume2, Radio, Zap, RefreshCw, Check, Shield } from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    config,
    updateConfig,
    setFrequencyProfile,
    toggleLoopback,
  } = useModem();

  const [freq0Input, setFreq0Input] = useState<number>(config.freq0);
  const [freq1Input, setFreq1Input] = useState<number>(config.freq1);

  if (!isSettingsOpen) return null;

  const handleApplyCustomFreqs = () => {
    updateConfig({
      profile: 'custom',
      freq0: freq0Input,
      freq1: freq1Input,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
                Modulation Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Acoustic carrier profiles, bit timing, and discrimination sensitivity.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Profiles */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
            Frequency Profile Presets:
          </span>

          <div className="space-y-2">
            {(Object.keys(PROFILE_PRESETS) as FrequencyProfile[]).map((key) => {
              const preset = PROFILE_PRESETS[key];
              const isSelected = config.profile === key;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setFrequencyProfile(key);
                    setFreq0Input(preset.freq0);
                    setFreq1Input(preset.freq1);
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start justify-between ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-100 font-mono-code">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono-code bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{preset.description}</p>
                  </div>

                  <span className="text-xs font-mono-code text-cyan-400 font-bold shrink-0 ml-3">
                    {preset.freq0} / {preset.freq1} Hz
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel Security / Encryption */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
              Channel Security (Encryption PIN)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            When set, payloads are encrypted via XOR Stream Cipher. Only receivers with the exact same PIN can decode your transmissions, guaranteeing site exclusivity and privacy.
          </p>
          <input
            type="text"
            placeholder="Enter Secret PIN (e.g. 1234)..."
            value={config.channelKey}
            onChange={(e) => updateConfig({ channelKey: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono-code text-xs focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Custom Frequency Tuning */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase block">
            Custom Carrier Pair Tuning
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="freq0Input" className="text-[11px] font-mono-code text-slate-400 block mb-1">
                F0 (Bit 0) Frequency (Hz):
              </label>
              <input
                id="freq0Input"
                type="number"
                min={300}
                max={22000}
                step={50}
                value={freq0Input}
                onChange={(e) => setFreq0Input(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono-code text-xs"
              />
            </div>
            <div>
              <label htmlFor="freq1Input" className="text-[11px] font-mono-code text-slate-400 block mb-1">
                F1 (Bit 1) Frequency (Hz):
              </label>
              <input
                id="freq1Input"
                type="number"
                min={300}
                max={22000}
                step={50}
                value={freq1Input}
                onChange={(e) => setFreq1Input(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono-code text-xs"
              />
            </div>
          </div>
          <button
            onClick={handleApplyCustomFreqs}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono-code text-cyan-300"
          >
            Apply Custom Frequency Pair
          </button>
        </div>

        {/* Bit Duration Timing */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
              Bit Window Duration:
            </span>
            <span className="text-xs font-mono-code font-bold text-cyan-400">
              {config.bitDurationMs} ms (~{Math.round(1000 / config.bitDurationMs)} baud)
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="140"
            step="10"
            value={config.bitDurationMs}
            onChange={(e) => updateConfig({ bitDurationMs: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono-code text-slate-500">
            <span>40 ms (High Speed: 25 bps)</span>
            <span>80 ms (Balanced: 12.5 bps)</span>
            <span>140 ms (Max Robustness: 7 bps)</span>
          </div>
        </div>

        {/* Discrimination Ratio */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 font-mono-code uppercase">
              Goertzel Ratio Threshold:
            </span>
            <span className="text-xs font-mono-code font-bold text-cyan-400">
              {config.minRatio.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="1.2"
            max="3.0"
            step="0.1"
            value={config.minRatio}
            onChange={(e) => updateConfig({ minRatio: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <p className="text-[11px] text-slate-400">
            Higher values require cleaner acoustic separation to register a bit, rejecting noisy ambient sounds.
          </p>
        </div>

        {/* Loopback Mode Quick Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div>
            <span className="text-xs font-semibold text-slate-200 block">Internal Loopback Bridge</span>
            <span className="text-[11px] text-slate-400">
              Direct internal audio routing for single-device self-verification.
            </span>
          </div>
          <button
            onClick={toggleLoopback}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono-code border transition-all ${
              config.loopbackMode
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {config.loopbackMode ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Save & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
