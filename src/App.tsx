import React from 'react';
import { ModemProvider, useModem } from './context/ModemContext';
import { Navbar } from './components/Navbar';
import { SpectrumScope } from './components/SpectrumScope';
import { TelemetryCards } from './components/TelemetryCards';
import { ReceiverPanel } from './components/ReceiverPanel';
import { TransmitterPanel } from './components/TransmitterPanel';
import { ToneLabPanel } from './components/ToneLabPanel';
import { HistoryDrawer } from './components/HistoryDrawer';
import { PacketInspectorModal } from './components/PacketInspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { Radio, ShieldAlert, Cpu, HeartHandshake } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { activeTab, config } = useModem();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-Time Acoustic Spectrogram & Scope (always visible on primary telemetry views) */}
        <SpectrumScope />

        {/* Live Demodulator Telemetry Stats Cards */}
        <TelemetryCards />

        {/* Tab Routing */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TransmitterPanel />
            <ReceiverPanel />
          </div>
        )}

        {activeTab === 'transmitter' && (
          <div className="max-w-3xl mx-auto w-full">
            <TransmitterPanel />
          </div>
        )}

        {activeTab === 'receiver' && (
          <div className="max-w-3xl mx-auto w-full">
            <ReceiverPanel />
          </div>
        )}

        {activeTab === 'tonelab' && (
          <div className="max-w-3xl mx-auto w-full">
            <ToneLabPanel />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto w-full">
            <HistoryDrawer />
          </div>
        )}
      </main>

      {/* Global Modals */}
      <PacketInspectorModal />
      <SettingsModal />

      {/* Modern High-Precision Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-4 sm:px-6 lg:px-8 text-xs font-mono-code text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>AERO-FSK Acoustic Transceiver Platform</span>
            <span>·</span>
            <span>Web Audio 2-FSK Standard</span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <span>F0: {config.freq0}Hz</span>
            <span>F1: {config.freq1}Hz</span>
            <span>Baud: ~{Math.round(1000 / config.bitDurationMs)} bps</span>
            <span className="text-cyan-400/80">{config.loopbackMode ? 'Loopback Bus' : 'Physical Air'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ModemProvider>
      <DashboardContent />
    </ModemProvider>
  );
}
