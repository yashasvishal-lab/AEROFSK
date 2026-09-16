import React, { useEffect, useRef, useState } from 'react';
import { useModem } from '../context/ModemContext';
import { VisualizerMode } from '../types';
import { Eye, Layers, Waves, Activity, ZoomIn } from 'lucide-react';

export const SpectrumScope: React.FC = () => {
  const { engine, config, visualizerMode, setVisualizerMode, isListening } = useModem();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ freq: number; db: number; x: number } | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Waterfall off-screen canvas setup
    if (!waterfallCanvasRef.current) {
      waterfallCanvasRef.current = document.createElement('canvas');
      waterfallCanvasRef.current.width = 800;
      waterfallCanvasRef.current.height = 300;
    }
    const waterfallCanvas = waterfallCanvasRef.current;
    const wfCtx = waterfallCanvas.getContext('2d');

    const render = () => {
      const analyser = engine?.getAnalyser();
      const width = canvas.width;
      const height = canvas.height;

      if (!analyser || !isListening) {
        // Render idle grid and status when receiver is offline
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        // Ambient radar grid lines
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Offline message
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ACOUSTIC TRANSDUCER OFFLINE — ACTIVATE RECEIVER TO STREAM SPECTRUM', width / 2, height / 2);

        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const sampleRate = analyser.context.sampleRate || 48000;
      const binCount = analyser.frequencyBinCount;
      const binHz = sampleRate / analyser.fftSize;

      // Focus frequency window around the carrier pair
      const minFreq = Math.max(0, Math.min(config.freq0, config.freq1) - 2500);
      const maxFreq = Math.min(sampleRate / 2, Math.max(config.freq0, config.freq1) + 2500);
      const minBin = Math.floor(minFreq / binHz);
      const maxBin = Math.min(binCount - 1, Math.ceil(maxFreq / binHz));
      const rangeBins = Math.max(1, maxBin - minBin);

      if (visualizerMode === 'spectrum') {
        // --- 1. FFT Frequency Spectrum ---
        const floatData = new Float32Array(binCount);
        analyser.getFloatFrequencyData(floatData);

        // Dark obsidian background
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        // Subtle grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 1;
        for (let y = 20; y < height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          const dbVal = Math.round(-30 - ((y / height) * 70));
          ctx.fillText(`${dbVal}dB`, 6, y - 3);
        }

        // Spectrum Gradient Path
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.02)');
        gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)');
        gradient.addColorStop(1, 'rgba(45, 212, 191, 0.85)');

        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let i = 0; i < rangeBins; i++) {
          const binIndex = minBin + i;
          const db = floatData[binIndex] || -120;
          // Normalize from -110dB to -30dB
          const norm = Math.max(0, Math.min(1, (db + 105) / 75));
          const x = (i / rangeBins) * width;
          const y = height - norm * (height - 15);

          if (i === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // High-contrast line stroke
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < rangeBins; i++) {
          const binIndex = minBin + i;
          const db = floatData[binIndex] || -120;
          const norm = Math.max(0, Math.min(1, (db + 105) / 75));
          const x = (i / rangeBins) * width;
          const y = height - norm * (height - 15);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Mark Target Frequencies F0 and F1
        const drawTarget = (freq: number, label: string, color: string) => {
          if (freq < minFreq || freq > maxFreq) return;
          const normX = (freq - minFreq) / (maxFreq - minFreq);
          const x = normX * width;

          ctx.strokeStyle = color;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.setLineDash([]);

          // Flag pill
          ctx.fillStyle = color;
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${label}: ${freq}Hz`, x, 14);
        };

        drawTarget(config.freq0, 'F0 (0)', '#38bdf8');
        drawTarget(config.freq1, 'F1 (1)', '#34d399');
      } else if (visualizerMode === 'waterfall') {
        // --- 2. Spectrogram Waterfall ---
        const byteData = new Uint8Array(binCount);
        analyser.getByteFrequencyData(byteData);

        if (wfCtx && waterfallCanvas) {
          // Scroll off-screen canvas down by 1 row
          wfCtx.drawImage(waterfallCanvas, 0, 0, width, height - 2, 0, 2, width, height - 2);

          // Draw the newest row at top
          for (let i = 0; i < rangeBins; i++) {
            const binIndex = minBin + i;
            const val = byteData[binIndex] || 0;
            const x = Math.floor((i / rangeBins) * width);
            const w = Math.ceil(width / rangeBins) + 1;

            // Thermal color mapping: black -> navy -> cyan -> yellow -> white
            let r = 0,
              g = 0,
              b = 0;
            if (val < 64) {
              b = val * 4;
            } else if (val < 128) {
              g = (val - 64) * 4;
              b = 255;
            } else if (val < 192) {
              r = (val - 128) * 4;
              g = 255;
              b = 255 - (val - 128) * 4;
            } else {
              r = 255;
              g = 255;
              b = (val - 192) * 4;
            }

            wfCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            wfCtx.fillRect(x, 0, w, 2);
          }

          // Blit offscreen waterfall to main canvas
          ctx.drawImage(waterfallCanvas, 0, 0, width, height);

          // Overlay frequency guide lines
          [config.freq0, config.freq1].forEach((f, idx) => {
            const normX = (f - minFreq) / (maxFreq - minFreq);
            const x = normX * width;
            ctx.strokeStyle = idx === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(52, 211, 153, 0.4)';
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }
      } else {
        // --- 3. Time-Domain Oscilloscope ---
        const timeData = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(timeData);

        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        // Center line
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const sliceWidth = width / timeData.length;
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, config, visualizerMode, isListening]);

  // Handle ResizeObserver to maintain sharp pixel ratio
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);

        if (waterfallCanvasRef.current) {
          waterfallCanvasRef.current.width = Math.floor(width * dpr);
          waterfallCanvasRef.current.height = Math.floor(height * dpr);
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isListening) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const analyser = engine?.getAnalyser();
    if (!analyser) return;

    const sampleRate = analyser.context.sampleRate || 48000;
    const minFreq = Math.max(0, Math.min(config.freq0, config.freq1) - 2500);
    const maxFreq = Math.min(sampleRate / 2, Math.max(config.freq0, config.freq1) + 2500);
    const freq = Math.round(minFreq + (x / rect.width) * (maxFreq - minFreq));

    setHoverInfo({ freq, db: -60, x });
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wide">
            Real-Time Acoustic Telemetry
          </span>
          <span className="text-[11px] font-mono-code text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/50">
            {isListening ? '48.0 kS/s ACTIVE' : 'AWAITING MIC'}
          </span>
        </div>

        {/* Visualizer Mode Switcher */}
        <div className="flex items-center space-x-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
          <button
            onClick={() => setVisualizerMode('spectrum')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              visualizerMode === 'spectrum'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Spectrum</span>
          </button>
          <button
            onClick={() => setVisualizerMode('waterfall')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              visualizerMode === 'waterfall'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Waterfall</span>
          </button>
          <button
            onClick={() => setVisualizerMode('oscilloscope')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              visualizerMode === 'oscilloscope'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Oscilloscope</span>
          </button>
        </div>
      </div>

      {/* Scope Canvas Area */}
      <div ref={containerRef} className="relative w-full h-56 sm:h-64 bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Inspector Pill */}
        {hoverInfo && (
          <div
            className="absolute top-3 pointer-events-none transform -translate-x-1/2 bg-slate-900/90 border border-cyan-500/40 px-2.5 py-1 rounded-md text-[11px] font-mono-code text-cyan-300 backdrop-blur shadow-lg"
            style={{ left: hoverInfo.x }}
          >
            {hoverInfo.freq} Hz
          </div>
        )}

        {/* Footnote stats overlay */}
        <div className="absolute bottom-2 right-3 flex items-center space-x-3 text-[10px] font-mono-code text-slate-400 pointer-events-none bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
          <span>
            F0: <strong className="text-sky-400 font-semibold">{config.freq0} Hz</strong>
          </span>
          <span>
            F1: <strong className="text-emerald-400 font-semibold">{config.freq1} Hz</strong>
          </span>
          <span>
            ΔF: <strong className="text-slate-200">{Math.abs(config.freq1 - config.freq0)} Hz</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
