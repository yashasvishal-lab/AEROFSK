import { Component, StrictMode, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './link/engine.ts';
import { EngineContext } from './ui/hooks.ts';
import { ModemView } from './ui/Modem.tsx';
import { LabView } from './ui/Lab.tsx';
import { SecureView } from './ui/Secure.tsx';
import { SettingsView } from './ui/Settings.tsx';
import { Button, Chip, Icon } from './ui/atoms.tsx';
import { useApp, db } from './ui/hooks.ts';
import './ui/styles.css';

const g = globalThis as unknown as { __tonebridge?: Engine };
const engine = (g.__tonebridge ??= new Engine());

type Tab = 'modem' | 'lab' | 'secure' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'modem', label: 'Link', icon: 'radio' },
  { id: 'lab', label: 'Signal Lab', icon: 'lab' },
  { id: 'secure', label: 'Security', icon: 'shield' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

function useTab(): [Tab, (t: Tab) => void] {
  const read = (): Tab => {
    const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '');
    return (TABS.find((t) => t.id === h)?.id ?? 'modem') as Tab;
  };
  const [tab, setTab] = useState<Tab>(read);
  useEffect(() => {
    const on = (): void => setTab(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [tab, (t: Tab) => {
    if (typeof location !== 'undefined') location.hash = `/${t}`;
    setTab(t);
  }];
}

function StatusBar(): ReactNode {
  const m = useApp((x) => ({ ready: x.ready, scope: x.scope, crypto: x.crypto, settings: x.settings, graph: x.graph, profile: x.profile, fec: x.fec, plan: x.plan, tx: x.tx }));
  const tone = m.scope.state === 'locked' ? 'ok' : m.scope.state === 'idle' ? 'neutral' : 'live';
  return (
    <div className="status">
      <Chip tone={m.ready ? 'ok' : 'err'} title="Audio graph">
        <Icon name={m.ready ? 'check' : 'x'} size={12} /> {m.ready ? 'modem up' : 'not started'}
      </Chip>
      <Chip tone={tone} title="Receiver state">{m.settings.capture === 'mic' ? 'mic' : m.settings.capture === 'loopback' ? 'loopback' : 'sim'} · {m.scope.state}</Chip>
      <Chip tone={m.scope.snrDb > 12 ? 'ok' : 'neutral'} title="Signal to noise over the last frame">{db(m.scope.snrDb)}</Chip>
      <Chip tone={m.crypto.secure ? 'ok' : 'warn'} title={m.crypto.label}>
        <Icon name={m.crypto.secure ? 'lock' : 'unlock'} size={12} /> {m.crypto.mode}
      </Chip>
      <Chip title="This device's address">node {m.settings.node}</Chip>
      <Chip tone={m.tx.busy ? 'live' : 'neutral'} title="Transmit queue">{m.tx.busy ? m.tx.label : m.tx.done < m.tx.total && m.tx.total ? 'idle · last run failed' : 'idle'}</Chip>
      <span className="status-plan mono">
        {m.profile?.name} · {m.fec?.name} · {m.plan ? `${m.plan.mfsk}-FSK ${Math.round(m.plan.bitRate)} bps` : ''} · {m.graph.sampleRate / 1000} kHz
      </span>
    </div>
  );
}

function Cover(): ReactNode {
  const m = useApp((x) => ({ settings: x.settings, graph: x.graph }));
  void m;
  return (
    <div className="cover">
      <div className="cover-card">
        <h1>
          <Icon name="wave" size={26} /> Tonebridge
        </h1>
        <p className="cover-tag">A real acoustic modem. Data out of the speaker, back in through the microphone, with error correction and an authenticated encrypted channel. No server, no network, no telemetry — this page is the whole product.</p>
        <ol>
          <li>
            <b>Choose how it listens.</b> Microphone is the real thing. Loopback and the room simulator need no permission and run the identical codec, so
            you can try everything before you trust a room with it.
          </li>
          <li>
            <b>Tune to the room</b> in the Signal Lab. It measures every air interface against the model you pick and applies the winner.
          </li>
          <li>
            <b>Send.</b> Frames are acknowledged and retransmitted; anything that still cannot be delivered is reported, not hidden.
          </li>
        </ol>
        <p className="cover-note">
          Starting the modem opens an audio context (the browser will ask for the microphone if that is the capture mode) and holds it while the tab is open.
          Nothing is ever sent anywhere except out of the speaker.
        </p>
        <Button tone="primary" onClick={() => void engine.init()}>
          <Icon name="play" /> Start the modem
        </Button>
      </div>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    engine.log(`Interface error: ${error.message} (${info.componentStack?.split('\n')[1]?.trim() ?? 'no stack'})`, 'error');
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="cover">
          <div className="cover-card">
            <h1>
              <Icon name="alert" size={22} /> The interface stopped
            </h1>
            <p>{this.state.error.message}</p>
            <p className="muted">The modem itself is still intact; reloading the page brings the interface back. Anything that was mid-transfer will need re-requesting.</p>
            <Button tone="primary" onClick={() => location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App(): ReactNode {
  const [tab, setTab] = useTab();
  const ready = useApp((m) => m.ready);
  const error = useApp((m) => m.error);
  useEffect(() => {
    if (ready) return;
    // A keyboard-only path onto the modem: Enter on the cover starts it.
    const on = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.target as HTMLElement | null)?.tagName !== 'TEXTAREA' && (e.target as HTMLElement | null)?.tagName !== 'INPUT') void engine.init();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [ready]);

  return (
    <EngineContext.Provider value={engine}>
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => setTab('modem')} type="button">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 16c3 0 3-8 6-8s3 8 6 8 3-8 6-8" />
                <circle cx="4" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="20" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="brand-text">
              <b>Tonebridge</b>
              <em>TBP-1 acoustic modem</em>
            </span>
          </button>
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`tab${tab === t.id ? ' tab-on' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
                <Icon name={t.icon} size={15} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <StatusBar />
        </header>
        {error ? (
          <div className="banner">
            <Icon name="alert" /> {error}
          </div>
        ) : null}
        <main className="body">{ready ? (tab === 'modem' ? <ModemView /> : tab === 'lab' ? <LabView /> : tab === 'secure' ? <SecureView /> : <SettingsView />) : <Cover />}</main>
        <footer className="foot">
          <span>Reed-Solomon over GF(256) · confidence-driven erasures · CRC-32 end to end · AES-GCM-256 with the FEC header as AAD · zero network requests</span>
          <span className="mono">offline-first: this page and its audio path work with the radio off</span>
        </footer>
      </div>
    </EngineContext.Provider>
  );
}

const mount = document.getElementById('root');
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <Boundary>
        <App />
      </Boundary>
    </StrictMode>,
  );
}

// Offline after the first visit. Only on a secure origin: a plain http:// LAN host gets no
// worker, and that is the browser telling us the truth rather than something to work around.
const secureOrigin = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && secureOrigin) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* the app still runs; only offline reuse is lost */
    });
  });
}
