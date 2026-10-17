'use client';

import { Hand, UserMinus } from 'lucide-react';
import type { useLiveClassSocket } from '@/hooks/useLiveClassSocket';

type Socket = ReturnType<typeof useLiveClassSocket>;

function initialsOf(name?: string) {
  return (name || '?')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  host: 'Host',
  cohost: 'Co-host',
  student: 'Student',
};

export function ParticipantsPanel({
  socket,
  hostDisplayName,
  isHost = false,
  onKick,
}: {
  socket: Socket;
  hostDisplayName?: string;
  isHost?: boolean;
  onKick?: (userId: string) => void | Promise<void>;
}) {
  const list = Object.values(socket.participants);
  const handsRaised = Object.keys(socket.raisedHands).length;

  return (
    <div className="lc-people">
      <div className="lc-people-header">
        <span className="lc-people-count">
          {list.length + 1} <span className="lc-people-count-label">in room</span>
        </span>
        {handsRaised > 0 && (
          <span className="lc-people-hands">
            <Hand className="h-3 w-3" />
            {handsRaised}
          </span>
        )}
      </div>

      <ul className="lc-people-list">
        <li className="lc-people-row lc-people-row--self">
          <div className="lc-people-avatar">{initialsOf(hostDisplayName) || 'YO'}</div>
          <div className="lc-people-meta">
            <div className="lc-people-name">{hostDisplayName ?? 'You'}</div>
            <div className="lc-people-sub">You</div>
          </div>
          {socket.role && (
            <span className={`lc-people-pill lc-people-pill--${socket.role}`}>
              {ROLE_LABELS[socket.role]}
            </span>
          )}
        </li>

        {list.map((p) => {
          const raised = !!socket.raisedHands[p.userId];
          const isStaff = p.role === 'host' || p.role === 'cohost';
          return (
            <li key={p.userId} className="lc-people-row">
              <div className={`lc-people-avatar${isStaff ? ' lc-people-avatar--staff' : ''}`}>
                {initialsOf(p.displayName)}
              </div>
              <div className="lc-people-meta">
                <div className="lc-people-name">
                  {p.displayName ?? 'Participant'}
                  {raised && (
                    <span className="lc-people-handicon" title="Hand raised">
                      <Hand className="h-3 w-3" />
                    </span>
                  )}
                </div>
                {raised && <div className="lc-people-sub lc-people-sub--amber">Hand raised</div>}
              </div>
              <span className={`lc-people-pill lc-people-pill--${p.role}`}>
                {ROLE_LABELS[p.role]}
              </span>
              {isHost && p.role === 'student' && onKick && (
                <button
                  type="button"
                  onClick={() => onKick(p.userId)}
                  className="lc-people-kick"
                  title="Remove from class"
                  aria-label={`Remove ${p.displayName ?? 'participant'}`}
                >
                  <UserMinus className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <style jsx global>{`
        .lc-people {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 14px 12px 12px;
        }
        .lc-people-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 6px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 8px;
        }
        .lc-people-count {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12px;
          font-weight: 600;
          color: #f5f5f7;
          font-variant-numeric: tabular-nums;
        }
        .lc-people-count-label {
          font-family: 'Hanken Grotesk', sans-serif;
          font-weight: 500;
          color: #8e8e96;
          margin-left: 5px;
          font-size: 11.5px;
        }
        .lc-people-hands {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fcd34d;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .lc-people-list {
          flex: 1;
          overflow-y: auto;
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .lc-people-list::-webkit-scrollbar {
          width: 8px;
        }
        .lc-people-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }

        .lc-people-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 8px;
          border-radius: 10px;
          transition: background 150ms;
        }
        .lc-people-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .lc-people-row--self {
          background: rgba(255, 255, 255, 0.02);
        }

        .lc-people-avatar {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #d4d4d8;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .lc-people-avatar--staff {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(99, 102, 241, 0.22));
          border-color: rgba(99, 102, 241, 0.45);
          color: #c7d2fe;
        }

        .lc-people-meta {
          flex: 1;
          min-width: 0;
        }
        .lc-people-name {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 500;
          color: #e4e4e7;
          letter-spacing: -0.005em;
        }
        .lc-people-handicon {
          color: #fcd34d;
          display: inline-flex;
        }
        .lc-people-sub {
          font-size: 10.5px;
          color: #71717a;
          margin-top: 1px;
        }
        .lc-people-sub--amber {
          color: #fcd34d;
        }

        .lc-people-pill {
          flex-shrink: 0;
          padding: 1px 7px 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #a1a1aa;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          border-radius: 4px;
          line-height: 1.6;
        }
        .lc-people-pill--host,
        .lc-people-pill--cohost {
          background: rgba(99, 102, 241, 0.16);
          border-color: rgba(99, 102, 241, 0.32);
          color: #c7d2fe;
        }

        .lc-people-kick {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          margin-left: 4px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 7px;
          color: #71717a;
          opacity: 0;
          transition:
            opacity 150ms,
            background 150ms,
            color 150ms,
            border-color 150ms;
          cursor: pointer;
        }
        .lc-people-row:hover .lc-people-kick {
          opacity: 1;
        }
        .lc-people-kick:hover {
          background: rgba(239, 68, 68, 0.13);
          border-color: rgba(239, 68, 68, 0.28);
          color: #fca5a5;
        }
      `}</style>
    </div>
  );
}
