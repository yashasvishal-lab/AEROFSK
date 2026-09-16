import React from 'react';
import { useModem } from '../context/ModemContext';
import { Info, Waves, Cpu, Settings2, SignalHigh, Shield, LockKeyhole, Radio, Network, FileCode2 } from 'lucide-react';

export const HowItWorksPanel: React.FC = () => {
  const { config } = useModem();

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-l border-slate-800/80 p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-slate-800/80 sticky top-0 bg-slate-900/90 z-10">
        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <Info className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-slate-100 tracking-tight">System Architecture</h2>
          <p className="text-xs text-slate-400 font-mono-code mt-1">ACOUSTIC MODEM SPECIFICATION v2.0</p>
        </div>
      </div>

      <div className="space-y-8 text-sm text-slate-300">
        
        {/* Intro */}
        <section className="space-y-3">
          <p className="leading-relaxed text-slate-300 text-sm">
            This workstation is a software-defined acoustic telemetry platform. It allows computers to form a completely offline, vacuum-gapped Mesh Network using only sound waves. It replicates the exact behavior of Radio Frequency (RF) modems without requiring external hardware.
          </p>
        </section>

        <div className="h-px bg-slate-800/60 w-full" />

        {/* 1. Physical Layer */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Waves className="w-5 h-5" />
            <h3 className="font-semibold text-base font-display tracking-wide">Layer 1: Physical (FSK)</h3>
          </div>
          <p className="leading-relaxed">
            Data is serialized into sound using <strong>2-Frequency-Shift Keying (2-FSK)</strong>. The transmitter rapidly alternates between two isolated frequencies to encode binary data into the air.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400 mt-2 font-mono-code text-xs">
            <li><strong className="text-slate-200">Space (0):</strong> {config.freq0} Hz</li>
            <li><strong className="text-slate-200">Mark (1):</strong> {config.freq1} Hz</li>
            <li><strong className="text-slate-200">Baud Rate:</strong> {Math.round(1000 / config.bitDurationMs)} bps ({config.bitDurationMs}ms window)</li>
          </ul>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mt-3">
            <div className="flex items-center space-x-2 mb-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">The Goertzel Demodulator</h4>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Instead of computing heavy full-spectrum FFTs, the receiver uses the highly efficient mathematical <strong>Goertzel Algorithm</strong> to isolate and measure energy exclusively at our two target frequencies. The stronger frequency determines the bit.
            </p>
          </div>
        </section>

        <div className="h-px bg-slate-800/60 w-full" />

        {/* 2. MAC Layer (CSMA) */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-amber-400">
            <Radio className="w-5 h-5" />
            <h3 className="font-semibold text-base font-display tracking-wide">Layer 2: MAC (CSMA/CA)</h3>
          </div>
          <p className="leading-relaxed">
            To prevent packet collisions in a multi-node room, the protocol enforces <strong>Carrier-Sense Multiple Access (Listen-Before-Talk)</strong>. 
          </p>
          <p className="text-xs text-slate-400 leading-relaxed bg-amber-950/20 p-3 rounded-lg border border-amber-900/30">
            Before engaging the oscillator, the transmitter sweeps the room's noise floor using an FFT. If it detects acoustic energy at $F_0$ or $F_1$ above -55dB, it assumes another node is transmitting, enters a randomized exponential backoff, and queues the packet.
          </p>
        </section>

        <div className="h-px bg-slate-800/60 w-full" />

        {/* 3. Transport Layer */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-blue-400">
            <Network className="w-5 h-5" />
            <h3 className="font-semibold text-base font-display tracking-wide">Layer 3: Transport (ARQ & CRC-16)</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
              <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider mb-2">Mathematical Integrity (CRC-16)</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Every packet includes a 16-bit Cyclic Redundancy Check (CRC-16-CCITT). If acoustic interference flips a single audio bit in transit, the checksum validation fails instantly, guaranteeing zero corrupted data is processed.
              </p>
            </div>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
              <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider mb-2">Guaranteed Delivery (ARQ)</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                File transfers utilize Automatic Repeat reQuest. The transmitter sends a data chunk and pauses. The receiver validates the CRC-16 and fires back a targeted Acoustic ACK tone. If the ACK is destroyed by room noise, the transmitter auto-retries the chunk.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-800/60 w-full" />

        {/* 4. Security Layer */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Shield className="w-5 h-5" />
            <h3 className="font-semibold text-base font-display tracking-wide">Layer 4: Military-Grade Security</h3>
          </div>
          <p className="leading-relaxed mb-4">
            If you utilize the <strong>Transmit Secure</strong> feature, the modem performs an autonomous, over-the-air cryptographic handshake establishing Perfect Forward Secrecy.
          </p>
          <div className="bg-emerald-950/10 border border-emerald-900/40 p-4 rounded-xl">
             <div className="flex items-center space-x-2 mb-3">
               <LockKeyhole className="w-4 h-4 text-emerald-400" />
               <span className="font-mono-code text-xs text-emerald-400 font-bold">ELLIPTIC-CURVE DIFFIE-HELLMAN (P-256)</span>
             </div>
             <ul className="text-xs text-slate-400 space-y-2 list-none">
                <li className="flex space-x-2"><span className="text-emerald-500">1.</span><span>Nodes autonomously generate ephemeral P-256 Keypairs.</span></li>
                <li className="flex space-x-2"><span className="text-emerald-500">2.</span><span>Public keys are exchanged as raw binary over sound waves.</span></li>
                <li className="flex space-x-2"><span className="text-emerald-500">3.</span><span>Both nodes derive the identical AES-256 secret.</span></li>
                <li className="flex space-x-2"><span className="text-emerald-500">4.</span><span>Payload is encrypted via AES-256-GCM and transmitted.</span></li>
             </ul>
             <p className="mt-3 text-[10px] text-emerald-500/70 uppercase tracking-wider">Even if the audio is recorded, the math is virtually uncrackable.</p>
          </div>
        </section>

        <div className="h-px bg-slate-800/60 w-full" />

        {/* 5. Future Roadmap */}
        <section className="space-y-4 pb-8">
          <div className="flex items-center space-x-2 text-rose-400">
            <FileCode2 className="w-5 h-5" />
            <h3 className="font-semibold text-base font-display tracking-wide">The Future Frontier</h3>
          </div>
          <p className="leading-relaxed">
            The web browser environment limits digital signal processing due to JavaScript garbage collection jitter. To push the boundaries of acoustic telemetry further, the next evolution requires a structural paradigm shift:
          </p>
          <div className="space-y-3 mt-3">
             <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="block text-slate-200 text-xs uppercase mb-1">Native Rust SIMD Core</strong>
                <p className="text-[11px] text-slate-500">Abandoning JS for a low-level Systems language utilizing Single Instruction Multiple Data (SIMD) hardware acceleration for deterministic, zero-latency audio driver access.</p>
             </div>
             <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="block text-slate-200 text-xs uppercase mb-1">OFDM Modulation</strong>
                <p className="text-[11px] text-slate-500">Orthogonal Frequency-Division Multiplexing. Calculating heavy Fast Fourier Transforms to transmit on 64+ simultaneous frequencies, pushing bandwidth from bytes/sec to kilobytes/sec.</p>
             </div>
             <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <strong className="block text-slate-200 text-xs uppercase mb-1">Chirp Spread Spectrum (CSS)</strong>
                <p className="text-[11px] text-slate-500">Transitioning from static tones to sweeping ultrasonic chirps (LoRa/Sonar) to completely eliminate multipath fading (echoes) and maximize range.</p>
             </div>
          </div>
        </section>

      </div>
    </div>
  );
};
