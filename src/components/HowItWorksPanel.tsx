import React from 'react';
import { BookOpen, Radio, Waves, Settings2, Cpu, Mic, Volume2, Info } from 'lucide-react';
import { useModem } from '../context/ModemContext';

export const HowItWorksPanel: React.FC = () => {
  const { config } = useModem();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-sm">
      <div className="bg-slate-800/50 p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-200">How It Works: Acoustic FSK Telemetry</h2>
        </div>
      </div>

      <div className="p-6 space-y-8 text-slate-300">
        
        {/* Section 1: Radio vs Sound */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2 text-cyan-300">
            <Radio className="w-5 h-5" />
            <h3 className="font-semibold text-base">Sound Waves vs. Radio Waves</h3>
          </div>
          <p className="leading-relaxed">
            Standard web browsers <strong>cannot directly transmit or receive raw radio waves (RF)</strong> because they don't have low-level access to the device's cellular, Wi-Fi, or Bluetooth antennas to broadcast custom signals.
          </p>
          <div className="bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-lg flex space-x-3 mt-4">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-cyan-100/90 text-sm leading-relaxed">
              To build a true point-to-point data link entirely in software, this platform uses <strong>Acoustic Waves (Sound)</strong>. Sound behaves exactly like radio telemetry—both are physical waves. We use your device's <strong>Speaker</strong> to transmit and the <strong>Microphone</strong> to receive. This acts as a perfect educational analog for radio frequency (RF) FSK modems without requiring external SDR (Software Defined Radio) hardware.
            </p>
          </div>
        </section>

        <div className="h-px bg-slate-800 w-full" />

        {/* Section 2: FSK Modulation */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Waves className="w-5 h-5" />
            <h3 className="font-semibold text-base">Frequency-Shift Keying (FSK)</h3>
          </div>
          <p className="leading-relaxed">
            Data is encoded into sound by rapidly switching between two distinct frequencies (tones). This is known as <strong>2-FSK (2-Frequency-Shift Keying)</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400 mt-2">
            <li><strong className="text-slate-200">Space (0):</strong> Represented by Frequency 0 ({config.freq0} Hz)</li>
            <li><strong className="text-slate-200">Mark (1):</strong> Represented by Frequency 1 ({config.freq1} Hz)</li>
            <li><strong className="text-slate-200">Baud Rate:</strong> The signal switches frequencies every {config.bitDurationMs} milliseconds, resulting in a baud rate of {Math.round(1000 / config.bitDurationMs)} bps.</li>
          </ul>
        </section>

        <div className="h-px bg-slate-800 w-full" />

        {/* Section 3: The Data Pipeline */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2 text-amber-400">
            <Settings2 className="w-5 h-5" />
            <h3 className="font-semibold text-base">Transmission & Packet Framing</h3>
          </div>
          <p className="leading-relaxed">
            To ensure the receiver can lock onto the signal in a noisy room, raw text is serialized into a highly structured binary packet:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-2 border-b border-slate-800 pb-2">1. Preamble & Sync</h4>
              <p className="text-slate-400 text-sm">
                The transmitter first sends an alternating pattern of 1s and 0s (e.g., <code>10101010</code>). This "wakes up" the receiver and lets it synchronize its timing. It is followed by a Start Delimiter (<code>0xFF</code>) to mark the beginning of the actual data.
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h4 className="font-semibold text-slate-200 mb-2 border-b border-slate-800 pb-2">2. Payload & Validation</h4>
              <p className="text-slate-400 text-sm">
                The text is converted to UTF-8 binary and transmitted. A simple XOR Parity Checksum is calculated and sent at the end, allowing the receiver to verify data integrity before accepting it.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-800 w-full" />

        {/* Section 4: DSP & Goertzel */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2 text-purple-400">
            <Cpu className="w-5 h-5" />
            <h3 className="font-semibold text-base">Digital Signal Processing (DSP)</h3>
          </div>
          <p className="leading-relaxed mb-4">
            The receiver uses the Web Audio API (<code>AudioWorklet</code>) to process microphone samples at precisely 48,000 times per second, ensuring zero Javascript timer jitter.
          </p>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-200 mb-1">The Goertzel Algorithm</h4>
              <p className="text-slate-400 text-sm">
                Instead of running a heavy Fast Fourier Transform (FFT) over the entire audio spectrum, the receiver uses the highly efficient Goertzel Algorithm. It mathematically measures the precise energy present at <em>only</em> our two target frequencies ({config.freq0} Hz and {config.freq1} Hz). The stronger frequency wins and determines if a '1' or '0' was sent.
              </p>
            </div>
            <div className="flex space-x-4">
              <div className="flex flex-col items-center justify-center p-3 bg-slate-900 rounded border border-slate-800">
                <Mic className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-xs text-slate-400 font-mono">Audio In</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-slate-900 rounded border border-slate-800">
                <Volume2 className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-xs text-slate-400 font-mono">Audio Out</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
