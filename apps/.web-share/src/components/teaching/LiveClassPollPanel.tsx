'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, BarChart3, Timer, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { useLiveClassSocket } from '@/hooks/useLiveClassSocket';

type Socket = ReturnType<typeof useLiveClassSocket>;

export function PollPanel({ socket, isHost }: { socket: Socket; isHost: boolean }) {
  if (socket.currentPoll) {
    return <ActivePollView socket={socket} isHost={isHost} />;
  }
  if (socket.lastResults) {
    return <ResultsView socket={socket} isHost={isHost} />;
  }
  if (isHost) return <PollLauncher socket={socket} />;
  return (
    <div className="lc-poll-empty">
      <div className="lc-poll-empty-icon">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div className="lc-poll-empty-title">No active poll</div>
      <div className="lc-poll-empty-sub">
        The host can launch a quick poll for everyone in the room.
      </div>
      <PollStyles />
    </div>
  );
}

function PollLauncher({ socket }: { socket: Socket }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<'single' | 'multi'>('single');
  const [busy, setBusy] = useState(false);

  const updateOpt = (i: number, patch: Partial<{ text: string; isCorrect: boolean }>) => {
    setOptions((o) => o.map((opt, idx) => (idx === i ? { ...opt, ...patch } : opt)));
  };

  const launch = async () => {
    const cleaned = options
      .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
      .filter((o) => o.text);
    if (!question.trim() || cleaned.length < 2) {
      toast.error('Add a question and at least 2 options');
      return;
    }
    setBusy(true);
    const resp = await socket.launchPoll({
      question: question.trim(),
      options: cleaned,
      type,
      durationSec: duration,
    });
    setBusy(false);
    if (!resp.ok) {
      toast.error(resp.error || 'Failed to launch poll');
      return;
    }
    setQuestion('');
    setOptions([
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]);
  };

  return (
    <div className="lc-poll-launcher">
      <div className="lc-poll-headline">
        <Sparkles className="h-3.5 w-3.5" /> Launch a poll
      </div>

      <label className="lc-poll-label">Question</label>
      <input
        className="lc-poll-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask anything…"
      />

      <label className="lc-poll-label">
        Options <span className="lc-poll-hint">(toggle the correct ones)</span>
      </label>
      <div className="lc-poll-opts">
        {options.map((o, i) => (
          <div key={i} className="lc-poll-opt-row">
            <button
              type="button"
              onClick={() => updateOpt(i, { isCorrect: !o.isCorrect })}
              className={`lc-poll-correct${o.isCorrect ? ' is-on' : ''}`}
              aria-label={o.isCorrect ? 'Marked correct' : 'Mark correct'}
              title={o.isCorrect ? 'Marked correct' : 'Mark correct'}
            >
              {o.isCorrect && <span className="lc-poll-tick">✓</span>}
            </button>
            <input
              className="lc-poll-input lc-poll-input--inline"
              value={o.text}
              onChange={(e) => updateOpt(i, { text: e.target.value })}
              placeholder={`Option ${i + 1}`}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((o) => o.filter((_, idx) => idx !== i))}
                className="lc-poll-trash"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button
            onClick={() => setOptions((o) => [...o, { text: '', isCorrect: false }])}
            className="lc-poll-addopt"
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </button>
        )}
      </div>

      <div className="lc-poll-row2">
        <div>
          <label className="lc-poll-label">Type</label>
          <div className="lc-segctrl">
            <button
              onClick={() => setType('single')}
              className={`lc-segctrl-item${type === 'single' ? ' is-on' : ''}`}
            >
              Single
            </button>
            <button
              onClick={() => setType('multi')}
              className={`lc-segctrl-item${type === 'multi' ? ' is-on' : ''}`}
            >
              Multi
            </button>
          </div>
        </div>
        <div>
          <label className="lc-poll-label">Duration</label>
          <div className="lc-poll-duration">
            <input
              type="number"
              min={5}
              max={600}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              className="lc-poll-input lc-poll-input--num"
            />
            <span className="lc-poll-duration-suffix">sec</span>
          </div>
        </div>
      </div>

      <button onClick={launch} disabled={busy} className="lc-poll-launchbtn">
        {busy ? 'Launching…' : 'Launch poll'}
      </button>

      <PollStyles />
    </div>
  );
}

function ActivePollView({ socket, isHost }: { socket: Socket; isHost: boolean }) {
  const poll = socket.currentPoll!;
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const total = Math.max(
    1,
    Math.floor((new Date(poll.closesAt).getTime() - new Date(poll.launchedAt).getTime()) / 1000)
  );
  const remaining = Math.max(0, Math.floor((new Date(poll.closesAt).getTime() - now) / 1000));
  const pct = (remaining / total) * 100;

  const toggle = (idx: number) => {
    if (submitted) return;
    if (poll.type === 'single') setSelected([idx]);
    else setSelected((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]));
  };

  const submit = async () => {
    if (selected.length === 0) return;
    const resp = await socket.respondPoll(poll.pollId, selected);
    if (!resp.ok) {
      toast.error(resp.error || 'Failed to submit');
      return;
    }
    setSubmitted(true);
    toast.success('Answer submitted');
  };

  return (
    <div className="lc-poll-active">
      <div className="lc-poll-tophead">
        <span className="lc-poll-livetag">
          <span className="lc-poll-livedot" /> LIVE POLL
        </span>
        <div className="lc-poll-timer">
          <Timer className="h-3.5 w-3.5" />
          <span className="lc-mono">{remaining}s</span>
        </div>
      </div>

      <div className="lc-poll-progressbar">
        <div className="lc-poll-progressfill" style={{ width: `${pct}%` }} />
      </div>

      <div className="lc-poll-question">{poll.question}</div>

      <div className="lc-poll-choices">
        {poll.options.map((o, i) => {
          const isSel = selected.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={submitted || remaining === 0 || isHost}
              className={`lc-poll-choice${isSel ? ' is-on' : ''}${submitted || remaining === 0 || isHost ? ' is-disabled' : ''}`}
            >
              <span className="lc-poll-choice-bullet">{String.fromCharCode(65 + i)}</span>
              <span className="lc-poll-choice-text">{o.text}</span>
            </button>
          );
        })}
      </div>

      {!isHost && !submitted && remaining > 0 && (
        <button onClick={submit} disabled={selected.length === 0} className="lc-poll-launchbtn">
          Submit answer
        </button>
      )}
      {isHost && (
        <button onClick={() => socket.closePoll(poll.pollId)} className="lc-poll-closebtn">
          Close poll
        </button>
      )}
      {submitted && (
        <div className="lc-poll-submitted">
          ✓ Answer submitted. Results show when the poll closes.
        </div>
      )}

      <PollStyles />
    </div>
  );
}

function ResultsView({ socket, isHost }: { socket: Socket; isHost: boolean }) {
  const r = socket.lastResults!;
  const max = Math.max(1, ...r.results.map((o) => o.count));
  return (
    <div className="lc-poll-active">
      <div className="lc-poll-tophead">
        <span className="lc-poll-resultstag">RESULTS</span>
        <span className="lc-mono lc-poll-totalresp">
          {r.totalResponses} response{r.totalResponses === 1 ? '' : 's'}
        </span>
      </div>

      <div className="lc-poll-results">
        {r.results.map((o, i) => {
          const pct = (o.count / max) * 100;
          return (
            <div key={i} className={`lc-poll-result${o.isCorrect ? ' is-correct' : ''}`}>
              <div className="lc-poll-result-head">
                <span className="lc-poll-result-label">
                  <span className="lc-poll-choice-bullet">{String.fromCharCode(65 + i)}</span>
                  {o.text}
                  {o.isCorrect && <span className="lc-poll-correctflag">CORRECT</span>}
                </span>
                <span className="lc-mono lc-poll-result-count">{o.count}</span>
              </div>
              <div className="lc-poll-bar">
                <div className="lc-poll-barfill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {isHost && (
        <button
          className="lc-poll-launchbtn"
          onClick={() => {
            // Force a re-render by clearing local results — service treats null state as launcher mode
            // Cheapest path: reload page; but better to expose a clearLastResults from the hook later.
            window.location.reload();
          }}
        >
          New poll
        </button>
      )}
      <PollStyles />
    </div>
  );
}

function PollStyles() {
  return (
    <style jsx global>{`
      .lc-poll-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 8px;
        height: 100%;
        padding: 50px 24px;
      }
      .lc-poll-empty-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), transparent 65%),
          rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: #71717a;
      }
      .lc-poll-empty-title {
        font-size: 14px;
        font-weight: 600;
        color: #d4d4d8;
        margin-top: 4px;
      }
      .lc-poll-empty-sub {
        font-size: 12px;
        color: #71717a;
        max-width: 240px;
      }

      .lc-poll-launcher,
      .lc-poll-active {
        padding: 16px 14px 14px;
        overflow-y: auto;
        height: 100%;
      }
      .lc-poll-launcher::-webkit-scrollbar,
      .lc-poll-active::-webkit-scrollbar {
        width: 8px;
      }
      .lc-poll-launcher::-webkit-scrollbar-thumb,
      .lc-poll-active::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 8px;
      }

      .lc-poll-headline {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: #c7d2fe;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-radius: 999px;
        margin-bottom: 14px;
      }

      .lc-poll-label {
        display: block;
        font-size: 10.5px;
        font-weight: 600;
        color: #a1a1aa;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 6px;
        margin-top: 12px;
      }
      .lc-poll-hint {
        text-transform: none;
        letter-spacing: 0;
        color: #71717a;
        font-weight: 400;
        margin-left: 2px;
      }

      .lc-poll-input {
        width: 100%;
        height: 36px;
        padding: 0 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 10px;
        color: #f5f5f7;
        font-size: 13px;
        outline: none;
        transition:
          border-color 150ms,
          background 150ms;
        font-family: inherit;
      }
      .lc-poll-input::placeholder {
        color: #71717a;
      }
      .lc-poll-input:focus {
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
      }
      .lc-poll-input--inline {
        height: 34px;
      }
      .lc-poll-input--num {
        width: 80px;
        padding-right: 32px;
      }

      .lc-poll-opts {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .lc-poll-opt-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .lc-poll-correct {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: transparent;
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        color: transparent;
        cursor: pointer;
        transition:
          background 150ms,
          border-color 150ms,
          color 150ms;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
      }
      .lc-poll-correct:hover {
        border-color: rgba(34, 197, 94, 0.5);
      }
      .lc-poll-correct.is-on {
        background: rgba(34, 197, 94, 0.18);
        border-color: rgba(34, 197, 94, 0.55);
        color: #86efac;
      }
      .lc-poll-trash {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        color: #71717a;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
          background 150ms,
          color 150ms,
          border-color 150ms;
      }
      .lc-poll-trash:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #fca5a5;
        border-color: rgba(239, 68, 68, 0.2);
      }

      .lc-poll-addopt {
        margin-top: 4px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 7px 10px;
        background: transparent;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #a1a1aa;
        font-size: 11.5px;
        font-weight: 500;
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms,
          border-color 150ms;
      }
      .lc-poll-addopt:hover {
        background: rgba(255, 255, 255, 0.04);
        color: #f5f5f7;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .lc-poll-row2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 4px;
      }
      .lc-segctrl {
        display: inline-flex;
        padding: 3px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
      }
      .lc-segctrl-item {
        flex: 1;
        padding: 5px 10px;
        background: transparent;
        border: none;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 500;
        border-radius: 6px;
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms;
      }
      .lc-segctrl-item.is-on {
        background: rgba(255, 255, 255, 0.08);
        color: #f5f5f7;
      }

      .lc-poll-duration {
        position: relative;
        display: inline-block;
      }
      .lc-poll-duration-suffix {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: #71717a;
        pointer-events: none;
      }

      .lc-poll-launchbtn {
        width: 100%;
        margin-top: 18px;
        height: 40px;
        background: linear-gradient(180deg, #f5f5f7 0%, #e4e4e7 100%);
        color: #0a0a0b;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.005em;
        cursor: pointer;
        transition:
          transform 120ms,
          box-shadow 150ms;
        box-shadow: 0 4px 14px -4px rgba(255, 255, 255, 0.15);
      }
      .lc-poll-launchbtn:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      .lc-poll-launchbtn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .lc-poll-closebtn {
        width: 100%;
        margin-top: 12px;
        height: 36px;
        background: rgba(239, 68, 68, 0.13);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms;
      }
      .lc-poll-closebtn:hover {
        background: rgba(239, 68, 68, 0.22);
        color: #fff;
      }

      .lc-poll-tophead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .lc-poll-livetag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        background: rgba(239, 68, 68, 0.13);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        border-radius: 999px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.14em;
      }
      .lc-poll-livedot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ef4444;
        animation: lc-livepulse 1.6s ease-out infinite;
      }
      .lc-poll-resultstag {
        display: inline-flex;
        padding: 3px 9px;
        background: rgba(99, 102, 241, 0.13);
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: #c7d2fe;
        border-radius: 999px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.14em;
      }
      .lc-poll-totalresp {
        color: #a1a1aa;
        font-size: 11px;
      }
      .lc-poll-timer {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #d4d4d8;
        font-size: 12px;
      }

      .lc-poll-progressbar {
        height: 3px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 999px;
        overflow: hidden;
        margin-bottom: 14px;
      }
      .lc-poll-progressfill {
        height: 100%;
        background: linear-gradient(90deg, #ef4444 0%, #f59e0b 100%);
        border-radius: 999px;
        transition: width 250ms linear;
      }

      .lc-poll-question {
        font-size: 16px;
        font-weight: 600;
        color: #f5f5f7;
        line-height: 1.35;
        letter-spacing: -0.01em;
        margin-bottom: 14px;
      }

      .lc-poll-choices {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .lc-poll-choice {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 11px;
        color: #d4d4d8;
        text-align: left;
        font-size: 13px;
        cursor: pointer;
        transition:
          background 150ms,
          border-color 150ms,
          color 150ms;
      }
      .lc-poll-choice:hover:not(.is-disabled) {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.14);
        color: #fff;
      }
      .lc-poll-choice.is-on {
        background: rgba(99, 102, 241, 0.16);
        border-color: rgba(99, 102, 241, 0.55);
        color: #fff;
      }
      .lc-poll-choice.is-disabled {
        cursor: not-allowed;
        opacity: 0.7;
      }
      .lc-poll-choice-bullet {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #d4d4d8;
        border-radius: 6px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 10px;
        font-weight: 700;
      }
      .lc-poll-choice.is-on .lc-poll-choice-bullet {
        background: rgba(99, 102, 241, 0.4);
        border-color: rgba(99, 102, 241, 0.7);
        color: #fff;
      }
      .lc-poll-choice-text {
        flex: 1;
      }

      .lc-poll-submitted {
        margin-top: 14px;
        padding: 8px 12px;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: #86efac;
        border-radius: 10px;
        font-size: 12px;
        text-align: center;
      }

      .lc-poll-results {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .lc-poll-result-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 5px;
      }
      .lc-poll-result-label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 13px;
        color: #d4d4d8;
        flex: 1;
        min-width: 0;
      }
      .lc-poll-result.is-correct .lc-poll-result-label {
        color: #86efac;
        font-weight: 600;
      }
      .lc-poll-correctflag {
        padding: 1px 6px 0;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.14em;
        background: rgba(34, 197, 94, 0.18);
        color: #86efac;
        border: 1px solid rgba(34, 197, 94, 0.4);
        border-radius: 4px;
        line-height: 1.5;
      }
      .lc-poll-result-count {
        color: #d4d4d8;
        font-size: 12.5px;
      }
      .lc-poll-bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 999px;
        overflow: hidden;
      }
      .lc-poll-barfill {
        height: 100%;
        background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
        border-radius: 999px;
        transition: width 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .lc-poll-result.is-correct .lc-poll-barfill {
        background: linear-gradient(90deg, #16a34a 0%, #22c55e 100%);
      }
    `}</style>
  );
}
