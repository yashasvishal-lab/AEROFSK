import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp, useEngine, bytes as fmtBytes, dur } from './hooks.ts';
import { Button, Chip, Field, Icon, Meter, Panel } from './atoms.tsx';
import { headerSymbols } from '../core/rx.ts';
import type { Plan } from '../core/types.ts';
import { FILE_LIMIT } from '../link/engine.ts';

/** Airtime of a frame carrying `bodyBytes`, without rendering it. */
function frameMsFor(plan: Plan, bodyBytes: number): number {
  const sym = plan.preSyms + headerSymbols(plan) + Math.ceil(((bodyBytes * 8) / plan.bitsPerSymbol) | 0);
  return ((sym * plan.L + plan.leadSamples + plan.tailSamples + 2 * plan.rampSamples) / plan.sr) * 1000;
}

export function ModemView(): ReactNode {
  const engine = useEngine();
  const { messages, tx, plan, crypto, peers, settings, stats, ready, playable, profile, fec } = useApp((m) => ({
    messages: m.messages,
    tx: m.tx,
    plan: m.plan,
    crypto: m.crypto,
    peers: m.peers,
    settings: m.settings,
    stats: m.stats,
    ready: m.ready,
    playable: m.playable,
    profile: m.profile,
    fec: m.fec,
  }));
  const scope = useApp((m) => m.scope);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState<number>(255);
  const [note, setNote] = useState<string>('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  const room = plan ? plan.chunkBody - (crypto.mode === 'open' ? 2 : 30) : 0;
  const est = useMemo(() => {
    if (!plan || !draft) return null;
    const len = new TextEncoder().encode(draft).length;
    const frames = Math.max(1, Math.ceil(len / Math.max(1, room - 3)));
    const per = frameMsFor(plan, Math.min(len, room) + 3);
    return { len, frames, airMs: per * frames };
  }, [draft, plan, room]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || tx.busy) return;
    setDraft('');
    setNote('');
    const r = await engine.sendText(text, target);
    if (!r.ok) setNote(`No acknowledgement after ${r.frames} frame(s). Move closer, or let the Signal Lab tune the air interface.`);
  }, [draft, engine, target, tx.busy]);

  const pickFile = useCallback(
    async (file: File) => {
      setNote('');
      if (file.size > FILE_LIMIT) {
        setNote(`"${file.name}" is ${fmtBytes(file.size)} - past the ${fmtBytes(FILE_LIMIT)} a loudspeaker should carry. Export it as a WAV instead, or pick a smaller file.`);
        return;
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      await engine.sendFile({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream', bytes: buf }, target === 255 ? undefined : target);
    },
    [engine, target],
  );

  const exportWav = useCallback(async () => {
    const text = draft.trim();
    if (!text) {
      setNote('Type something to encode first.');
      return;
    }
    try {
      const { bytes: wav, ms, frames } = await engine.encodeWavFor(text);
      const url = URL.createObjectURL(new Blob([wav as unknown as BlobPart], { type: 'audio/wav' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tonebridge-link.wav';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setNote(`Wrote ${frames} frame(s), ${(ms / 1000).toFixed(1)} s of audio. Play it into any device running Tonebridge in microphone mode.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'encode failed');
    }
  }, [draft, engine]);

  const testLink = useCallback(async () => {
    setNote('Round-tripping a frame through the modulator and demodulator…');
    const r = await engine.roundTrip(`link check ${Date.now()}`);
    setNote(`${r.ok ? 'Link verified: ' : 'Link problem: '}${r.detail}`);
  }, [engine]);

  return (
    <div className="grid grid-modem">
      <Panel
        title="Transcript"
        icon="radio"
        note={ready ? undefined : 'Press “Start the modem” above to open the audio path.'}
        right={
          <>
            <Chip tone={settings.capture === 'mic' ? (scope.state === 'idle' ? 'neutral' : 'live') : 'neutral'} title="Receiver state">
              {settings.capture === 'mic' ? 'mic' : settings.capture === 'loopback' ? 'loopback' : 'simulator'} · {scope.state}
            </Chip>
            <Button tone="ghost" onClick={() => engine.clearTranscripts()} title="Forget the transcript on this device">
              <Icon name="x" /> clear
            </Button>
          </>
        }
      >
        <div className="transcript" ref={listRef}>
          {messages.length === 0 ? (
            <div className="empty">
              <Icon name="wave" size={28} />
              <p>Nothing on the air yet. Type a message and press Send; with loopback capture the modem hears itself, so you will see the whole handshake complete.</p>
            </div>
          ) : null}
          {messages.map((m) => (
            <article key={m.id} className={`msg msg-${m.dir}${m.error ? ' msg-bad' : ''}`}>
              <header>
                <span className="msg-who">
                  {m.dir === 'tx' ? `node ${settings.node} → ${m.to === 255 ? 'all' : `node ${m.to}`}` : `node ${m.from} → me`}
                </span>
                <span className="msg-time">
                  {new Date(m.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {m.secure ? (
                  <Chip tone="ok" title="Sealed with AES-GCM under this session key">
                    <Icon name="lock" size={12} /> sealed
                  </Chip>
                ) : null}
                {m.kind === 'file' ? (
                  <Chip title="file transfer">
                    <Icon name="file" size={12} /> file
                  </Chip>
                ) : null}
                {m.stats?.snrDb !== undefined ? (
                  <Chip tone={m.stats.snrDb > 10 ? 'ok' : 'warn'} title="Signal-to-noise ratio over the frame">
                    {m.stats.snrDb.toFixed(1)} dB
                  </Chip>
                ) : null}
                {m.stats?.corrected !== undefined && m.stats?.corrected > 0 ? (
                  <Chip tone="warn" title="Reed-Solomon repaired these symbols">
                    FEC +{m.stats.corrected}
                  </Chip>
                ) : null}
                {m.stats?.airMs !== undefined ? <Chip title="airtime">{dur(m.stats.airMs)}</Chip> : null}
              </header>
              <p className="msg-body">{m.text}</p>
              {m.error ? <p className="msg-err">{m.error}</p> : null}
            </article>
          ))}
        </div>
      </Panel>

      <div className="col">
        <Panel
          title="Send"
          icon="send"
          right={
            tx.busy ? (
              <Button tone="danger" onClick={() => engine.abort()}>
                <Icon name="stop" /> stop
              </Button>
            ) : null
          }
        >
          <textarea
            className="composer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Message, address, key, or anything that must survive a room. ⌘/Ctrl+Enter to send."
            rows={4}
            spellCheck={false}
          />
          <div className="row">
            <Field label="Target" htmlFor="target">
              <select id="target" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                <option value={255}>Everyone (broadcast)</option>
                {peers.map((p) => (
                  <option key={p.node} value={p.node}>
                    node {p.node} · {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {est ? (
              <span className="est" title="Estimated from the current air interface, including FEC and the receive guard">
                {fmtBytes(est.len)} · {est.frames} frame{est.frames > 1 ? 's' : ''} · {dur(est.airMs)} of air
              </span>
            ) : null}
          </div>
          {tx.busy ? (
            <div className="txbar">
              <Meter value={(tx.done / Math.max(1, tx.total)) * 100} min={0} max={100} label={`${tx.label} · ${tx.done}/${tx.total}`} />
            </div>
          ) : null}
          {note ? <p className="note">{note}</p> : null}
          {!playable.ok ? (
            <p className="warn-inline">
              <Icon name="alert" /> {playable.warning}
            </p>
          ) : null}
          <div className="row row-btns">
            <Button tone="primary" onClick={() => void send()} disabled={tx.busy || !draft.trim()}>
              <Icon name="send" /> Send
            </Button>
            <Button onClick={() => void exportWav()} title="Encode to a .wav file you can play into another device">
              <Icon name="download" /> WAV
            </Button>
            <Button onClick={() => void testLink()} title="Modulate, add the selected room model, demodulate - no microphone needed">
              <Icon name="refresh" /> Round trip
            </Button>
            <Button onClick={() => void engine.announce()} title="Say hello so other devices list this node">
              <Icon name="speaker" /> Hello
            </Button>
          </div>
        </Panel>

        <Panel
          title="Files"
          icon="file"
          note={`Up to ${fmtBytes(FILE_LIMIT)} travels as Reed-Solomon-chunked frames. Everything is verified with SHA-256 before it is offered back to you.`}
        >
          <div
            className={`drop${drag ? ' drop-hot' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void pickFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fileRef.current?.click();
            }}
          >
            <Icon name="download" size={18} />
            <span>Drop a file, or click to choose</span>
            <input
              ref={fileRef}
              type="file"
              accept="*/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
                e.target.value = '';
              }}
            />
          </div>
          <TransferList />
        </Panel>

        <Panel title="Radio" icon="wave">
          <div className="kv">
            <span>Profile</span>
            <b>
              {profile?.name} · {fec?.name} FEC
            </b>
            <span>Tones</span>
            <b className="mono">{(plan?.tones ?? []).map((t) => Math.round(t)).join(' · ')} Hz</b>
            <span>Symbol</span>
            <b className="mono">
              {plan ? plan.symMs.toFixed(2) : '—'} ms · {plan?.mfsk} levels · {plan ? Math.round(plan.bitRate) : 0} bps gross
            </b>
            <span>Frame body</span>
            <b className="mono">
              {plan ? plan.maxBody : 0} B max · {room} B per chunk
            </b>
            <span>Level</span>
            <b>
              <Meter value={scope.levelDb} label={`${scope.levelDb <= -110 ? 'silent' : `${scope.levelDb.toFixed(1)} dBFS`}`} />
            </b>
            <span>Noise floor</span>
            <b className="mono">{scope.noiseFloorDb <= -110 ? '—' : `${scope.noiseFloorDb.toFixed(1)} dBFS · +${scope.excessDb.toFixed(1)} dB above floor`}</b>
            <span>Heard back</span>
            <b className="mono">
              {stats.echoes} self frame{stats.echoes === 1 ? '' : 's'} · {stats.acksSent} acks out · {stats.acksRecv} back
            </b>
            <span>Counters</span>
            <b className="mono">
              {stats.framesSent} sent · {stats.framesRecv} in · {stats.retries} retries · {stats.framesRejected} rejected
            </b>
            <span>FEC load</span>
            <b className="mono">
              {stats.fecSymbols + stats.erasureSymbols} symbol{stats.fecSymbols + stats.erasureSymbols === 1 ? '' : 's'} repaired · {stats.airSeconds.toFixed(1)} s of air
            </b>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TransferList(): ReactNode {
  const engine = useEngine();
  const transfers = useApp((m) => m.transfers);
  if (!transfers.length) return <p className="muted">No transfers yet.</p>;
  return (
    <ul className="transfers">
      {transfers.map((t) => {
        const pct = Math.round((t.have.length / Math.max(1, t.chunks)) * 100);
        return (
          <li key={t.id} className={`transfer transfer-${t.state}`}>
            <div className="transfer-top">
              <span className="transfer-name">
                {t.dir === 'tx' ? '→' : '←'} {t.name}
              </span>
              <Chip tone={t.state === 'done' ? 'ok' : t.state === 'failed' ? 'err' : t.state === 'cancelled' ? 'neutral' : 'live'}>{t.state}</Chip>
            </div>
            <Meter value={pct} min={0} max={100} label={`${t.have.length}/${t.chunks} chunks · ${fmtBytes(t.size)} · ${pct}%`} />
            <p className="transfer-sub mono">
              {t.sha256 ? `sha256 ${t.sha256.slice(0, 16)}…` : ''}
              {t.gotSha ? ` · got ${t.gotSha.slice(0, 16)}…` : ''}
              {t.error ? ` · ${t.error}` : ''}
              {t.endedAt ? ` · ${dur(t.endedAt - t.startedAt)}` : ''}
            </p>
            <div className="row row-btns">
              {t.dir === 'rx' && t.state === 'done' && t.url ? (
                <a className="btn btn-primary" href={t.url} download={t.name}>
                  <Icon name="download" size={14} /> save
                </a>
              ) : null}
              {t.dir === 'rx' && (t.state === 'failed' || t.state === 'active') ? (
                <Button onClick={() => void engine.resendMissing(t.id)} title="NACK every chunk we do not have">
                  <Icon name="refresh" size={14} /> re-request missing
                </Button>
              ) : null}
              {t.state === 'active' ? (
                <Button tone="ghost" onClick={() => engine.cancelTransfer(t.id)}>
                  <Icon name="x" size={14} /> cancel
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
