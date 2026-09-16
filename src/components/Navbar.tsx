import React from 'react';
import {
  Activity,
  Radio,
  Sliders,
  FileCode2,
  RefreshCw,
  Volume2,
  ShieldCheck,
  AlertCircle,
  Menu,
  X,
} from 'lucide-react';
import { useModem, PROFILE_PRESETS } from '../context/ModemContext';
import { Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    config,
    rxState,
    activeTab,
    setActiveTab,
    setIsSettingsOpen,
    setIsInspectorOpen,
    toggleLoopback,
  } = useModem();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const getStateBadge = () => {
    switch (rxState) {
      case 'OFFLINE':
        return { label: 'RX OFFLINE', bg: 'bg-slate-800/80 text-slate-400 border-slate-700' };
      case 'HUNTING':
        return { label: 'CARRIER HUNTING', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse' };
      case 'SYNCED':
      case 'READING_START':
        return { label: 'PREAMBLE LOCKED', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' };
      case 'READING_LENGTH':
      case 'READING_DATA':
        return { label: 'ACQUIRING PAYLOAD', bg: 'bg-blue-500/20 text-blue-300 border-blue-400/40' };
      case 'READING_CHECKSUM':
        return { label: 'VERIFYING CRC', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40' };
      case 'MESSAGE_OK':
        return { label: 'PACKET VALIDATED', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' };
      case 'CHECKSUM_ERROR':
        return { label: 'CHECKSUM ERROR', bg: 'bg-rose-500/20 text-rose-300 border-rose-400/40' };
      default:
        return { label: 'IDLE', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const badge = getStateBadge();
  const currentPreset = PROFILE_PRESETS[config.profile];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-[1px] shadow-lg shadow-cyan-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-lg tracking-wider text-slate-100 uppercase">
                AERO<span className="text-cyan-400">FSK</span>
              </span>
              <span className="text-[10px] uppercase font-mono-code px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300/80 border border-slate-700">
                v2.4 Core
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Acoustic Data Link · Over-the-Air Transceiver
            </p>
          </div>
        </div>

        {/* Center navigation tabs (desktop) */}
        <nav className="hidden md:flex items-center space-x-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('transmitter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'transmitter'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Transmitter
          </button>
          <button
            onClick={() => setActiveTab('receiver')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'receiver'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Receiver
          </button>
          <button
            onClick={() => setActiveTab('tonelab')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'tonelab'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Tone Lab
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Logs & History
          </button>
          <button
            onClick={() => setActiveTab('how-it-works')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'how-it-works'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            How It Works
          </button>
        </nav>

        {/* Right side controls & status */}
        <div className="flex items-center space-x-2.5">
          {/* Security Status Badge */}
          {config.channelKey && (
            <div title="Encrypted Channel Active" className="hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Secure</span>
            </div>
          )}

          {/* Loopback Mode Toggle */}
          <button
            onClick={toggleLoopback}
            title={config.loopbackMode ? 'Disable loopback (switch to microphone air mode)' : 'Enable internal loopback (single-device testing)'}
            className={`hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              config.loopbackMode
                ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 font-medium'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${config.loopbackMode ? 'text-teal-400' : ''}`} />
            <span className="hidden lg:inline">{config.loopbackMode ? 'Loopback ON' : 'Acoustic Air'}</span>
          </button>

          {/* Link Status Pill */}
          <div
            className={`flex items-center space-x-1.5 text-[11px] font-mono-code font-medium px-2.5 py-1 rounded-full border ${badge.bg}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span>{badge.label}</span>
          </div>

          {/* Packet Inspector Button */}
          <button
            onClick={() => setIsInspectorOpen(true)}
            title="Inspect packet protocol architecture"
            className="p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-cyan-300 transition-colors"
          >
            <FileCode2 className="w-4 h-4" />
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Configure modulation and frequencies"
            className="p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-cyan-300 transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-800/60">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 rounded-lg text-left text-xs font-medium ${
                activeTab === 'dashboard' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setActiveTab('transmitter');
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 rounded-lg text-left text-xs font-medium ${
                activeTab === 'transmitter' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
              }`}
            >
              Transmitter
            </button>
            <button
              onClick={() => {
                setActiveTab('receiver');
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 rounded-lg text-left text-xs font-medium ${
                activeTab === 'receiver' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
              }`}
            >
              Receiver
            </button>
            <button
              onClick={() => {
                setActiveTab('tonelab');
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 rounded-lg text-left text-xs font-medium ${
                activeTab === 'tonelab' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
              }`}
            >
              Tone Lab
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 rounded-lg text-left text-xs font-medium ${
                activeTab === 'history' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
              }`}
            >
              Logs
            </button>
            <button
              onClick={() => {
                setActiveTab('how-it-works');
                setMobileMenuOpen(false);
              }}
              className={`col-span-2 p-2.5 rounded-lg text-center text-xs font-medium ${
                activeTab === 'how-it-works' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
              }`}
            >
              How It Works
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Loopback Simulation</span>
            <button
              onClick={toggleLoopback}
              className={`text-xs px-3 py-1 rounded-md border ${
                config.loopbackMode
                  ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {config.loopbackMode ? 'Active (Internal Bus)' : 'Disabled (Air Mic)'}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono-code pt-2">
            Profile: {currentPreset.name} ({config.freq0}Hz / {config.freq1}Hz)
          </div>
        </div>
      )}
    </header>
  );
};
