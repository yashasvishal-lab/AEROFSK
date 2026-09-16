import React, { useState } from 'react';
import { useModem } from '../context/ModemContext';
import { Play, Square, Volume2, Sliders, Activity, CheckCircle2 } from 'lucide-react';

export const ToneLabPanel: React.FC = () => {
  const {
    config,
    playTestTone,
    stopTestTone,
    testToneActive,
    activeToneFreq,
    telemetry,
    isListening,
    startListening,
  } = useModem();

  const [sliderFreq, setSliderFreq] = useState<number>(config.freq0);
  const [toneVolume, setToneVolume] = useState<number>(config.txVolume);

  const handlePlayCustom = () => {
    playTestTone(sliderFreq);
  };

  const handlePlayF0 = () => {
    setSliderFreq(config.freq0);
    playTestTone(config.freq0);
  };

  const handlePlayF1 = () => {
    setSliderFreq(config.freq1);
    playTestTone(config.freq1);
  };

  return (
    <div className="space-y-4">
      {/* Tone Generator Card */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
              Acoustic Calibration & Tone Lab
            </h2>
          </div>
          <span className="text-xs font-mono-code text-slate-400">
            {testToneActive ? 'EMITTING TONE' : 'CARRIER IDLE'}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Emit precise carrier tones to verify hardware speaker frequency response and test microphone pickup sensitivity before launching transmissions.
        </p>

        {/* Quick Tone Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={testToneActive && activeToneFreq === config.freq0 ? stopTestTone : handlePlayF0}
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              testToneActive && activeToneFreq === config.freq0
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-lg shadow-sky-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
            }`}
          >
            <div className="text-left">
              <span className="text-[11px] font-mono-code text-slate-400 block">CARRIER F0 (BIT 0)</span>
              <span className="font-display font-bold text-xl text-sky-400">{config.freq0} Hz</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              {testToneActive && activeToneFreq === config.freq0 ? (
                <Square className="w-4 h-4 text-sky-400" />
              ) : (
                <Play className="w-4 h-4 text-slate-300" />
              )}
            </div>
          </button>

          <button
            onClick={testToneActive && activeToneFreq === config.freq1 ? stopTestTone : handlePlayF1}
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              testToneActive && activeToneFreq === config.freq1
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
            }`}
          >
            <div className="text-left">
              <span className="text-[11px] font-mono-code text-slate-400 block">CARRIER F1 (BIT 1)</span>
              <span className="font-display font-bold text-xl text-emerald-400">{config.freq1} Hz</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              {testToneActive && activeToneFreq === config.freq1 ? (
                <Square className="w-4 h-4 text-emerald-400" />
              ) : (
                <Play className="w-4 h-4 text-slate-300" />
              )}
            </div>
          </button>
        </div>

        {/* Frequency Slider */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="freqSlider" className="text-xs font-medium text-slate-300">
              Custom Continuous Sweep Frequency
            </label>
            <span className="font-mono-code text-base font-bold text-cyan-400">{sliderFreq} Hz</span>
          </div>

          <input
            id="freqSlider"
            type="range"
            min="200"
            max="21500"
            step="50"
            value={sliderFreq}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSliderFreq(val);
              if (testToneActive) playTestTone(val);
            }}
            className="w-full accent-cyan-400 cursor-pointer"
          />

          <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-500">
            <span>200 Hz (Sub-audio)</span>
            <span>10 kHz (Audible)</span>
            <span>21.5 kHz (Near-ultrasound)</span>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            {!testToneActive ? (
              <button
                onClick={handlePlayCustom}
                className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Play Selected Tone</span>
              </button>
            ) : (
              <button
                onClick={stopTestTone}
                className="px-5 py-2.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 font-display font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Silence Tone</span>
              </button>
            )}

            {!isListening && (
              <button
                onClick={startListening}
                className="text-xs text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>Enable Mic to see spectrum response →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Acoustic Feedback Verification Card */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center space-x-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wide">
            Live Roundtrip Acoustic Telemetry
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">MICROPHONE STATUS</span>
            <span className={`text-xs font-mono-code font-bold ${isListening ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isListening ? 'STREAMING ACTIVE' : 'OFFLINE'}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">DETECTED DOMINANT PEAK</span>
            <span className="text-xs font-mono-code font-bold text-cyan-400">
              {isListening && telemetry.detectedFreq > 0 ? `${telemetry.detectedFreq} Hz` : 'Quiet / Noise'}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono-code text-slate-400 block">CONFIDENCE METRIC</span>
            <span className="text-xs font-mono-code font-bold text-slate-300">
              {isListening ? `${telemetry.signalStrengthPct}% (${telemetry.ratio.toFixed(1)}x)` : '0%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
