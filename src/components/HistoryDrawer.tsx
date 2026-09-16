import React from 'react';
import { useModem } from '../context/ModemContext';
import { Terminal, Download, Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const HistoryDrawer: React.FC = () => {
  const { logs, messages, clearLogs, clearMessages } = useModem();

  const exportLogs = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      messages,
      logs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aerofsk-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Event Logs Terminal */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
              Hardware Telemetry & Event Journal
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 text-xs font-mono-code flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Telemetry</span>
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-300 hover:border-slate-700 text-xs font-mono-code flex items-center space-x-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>
          </div>
        </div>

        {/* Terminal Window */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 font-mono-code text-xs space-y-1.5 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-4">No events logged yet. Activate receiver or transmitter to stream events.</div>
          ) : (
            logs.map((log) => {
              let badgeColor = 'text-cyan-400';
              if (log.level === 'ok') badgeColor = 'text-emerald-400';
              if (log.level === 'warn') badgeColor = 'text-amber-400';
              if (log.level === 'error') badgeColor = 'text-rose-400';

              return (
                <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span className={`uppercase text-[10px] px-1 py-0.2 rounded bg-slate-900 font-bold shrink-0 ${badgeColor}`}>
                    {log.level}
                  </span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Received Packets Archive */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display font-semibold text-sm text-slate-200 uppercase tracking-wide">
              Historical Packet Ledger
            </h3>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs font-mono-code text-slate-400 hover:text-rose-300"
            >
              Clear Messages ({messages.length})
            </button>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono-code text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
            No received packets in session history.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono-code"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {m.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="font-bold text-slate-100">"{m.text}"</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Received at {new Date(m.timestamp).toLocaleTimeString()} · SNR: {m.snrSnapshotDb}dB · CRC: 0x{m.receivedChecksum.toString(16).toUpperCase()}
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <span>{m.length} Bytes</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
