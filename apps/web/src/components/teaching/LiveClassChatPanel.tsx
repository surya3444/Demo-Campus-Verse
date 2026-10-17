'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import type { useLiveClassSocket } from '@/hooks/useLiveClassSocket';

type Socket = ReturnType<typeof useLiveClassSocket>;

export function ChatPanel({ socket }: { socket: Socket }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const isModerator = socket.role === 'host' || socket.role === 'cohost';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [socket.messages.length]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    const resp = await socket.sendChat(value);
    setSending(false);
    if (!resp.ok) {
      toast.error(
        resp.error === 'RATE_LIMITED' ? 'Slow down — too many messages' : 'Failed to send'
      );
      return;
    }
    setText('');
  };

  return (
    <div className="lc-chat">
      <div ref={scrollRef} className="lc-chat-scroll">
        {socket.messages.length === 0 ? (
          <div className="lc-chat-empty">
            <div className="lc-chat-empty-icon">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="lc-chat-empty-title">No messages yet</div>
            <div className="lc-chat-empty-sub">Be the first to say hello.</div>
          </div>
        ) : (
          <div className="lc-chat-list">
            {socket.messages.map((m, idx) => {
              const canDelete = isModerator || m.senderUserId === userId;
              const isStaff = m.senderRole === 'host' || m.senderRole === 'cohost';
              const prev = idx > 0 ? socket.messages[idx - 1] : null;
              const grouped = prev && prev.senderUserId === m.senderUserId;
              const initials = (m.senderName || '?')
                .split(' ')
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div key={m._id} className={`lc-msg${grouped ? ' lc-msg--grouped' : ''}`}>
                  {!grouped ? (
                    <div className={`lc-avatar${isStaff ? ' lc-avatar--staff' : ''}`}>
                      {initials || '?'}
                    </div>
                  ) : (
                    <div className="lc-avatar-spacer" />
                  )}
                  <div className="lc-msg-body">
                    {!grouped && (
                      <div className="lc-msg-meta">
                        <span className={`lc-msg-author${isStaff ? ' lc-msg-author--staff' : ''}`}>
                          {m.senderName}
                        </span>
                        {isStaff && (
                          <span className="lc-rolechip">
                            {m.senderRole === 'host' ? 'Host' : 'Co-host'}
                          </span>
                        )}
                        <span className="lc-msg-time">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {canDelete && (
                          <button
                            onClick={async () => {
                              const r = await socket.deleteChat(m._id);
                              if (!r.ok) toast.error(r.error || 'Failed to delete');
                            }}
                            className="lc-msg-del"
                            title="Delete message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="lc-msg-text">{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="lc-composer">
        <input
          type="text"
          className="lc-composer-input"
          placeholder={socket.joined ? 'Send a message…' : 'Connecting…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={!socket.joined}
        />
        <button
          onClick={send}
          disabled={!socket.joined || sending || !text.trim()}
          className="lc-composer-send"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <style jsx global>{`
        .lc-chat {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: transparent;
        }
        .lc-chat-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 18px 16px 8px;
        }
        .lc-chat-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .lc-chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }
        .lc-chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }

        .lc-chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 24px 36px;
          text-align: center;
          gap: 8px;
        }
        .lc-chat-empty-icon {
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
          margin-bottom: 4px;
        }
        .lc-chat-empty-title {
          font-size: 14px;
          font-weight: 600;
          color: #d4d4d8;
          letter-spacing: -0.005em;
        }
        .lc-chat-empty-sub {
          font-size: 12px;
          color: #71717a;
        }

        .lc-chat-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lc-msg {
          display: flex;
          gap: 10px;
        }
        .lc-msg--grouped {
          margin-top: -6px;
        }

        .lc-avatar {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #d4d4d8;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          margin-top: 2px;
        }
        .lc-avatar--staff {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2));
          border-color: rgba(99, 102, 241, 0.45);
          color: #c7d2fe;
        }
        .lc-avatar-spacer {
          width: 28px;
          flex-shrink: 0;
        }

        .lc-msg-body {
          flex: 1;
          min-width: 0;
        }
        .lc-msg-meta {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 1px;
        }
        .lc-msg-author {
          font-size: 12px;
          font-weight: 600;
          color: #e4e4e7;
          letter-spacing: -0.005em;
        }
        .lc-msg-author--staff {
          color: #c7d2fe;
        }
        .lc-rolechip {
          padding: 1px 5px 0;
          background: rgba(99, 102, 241, 0.16);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #c7d2fe;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-radius: 4px;
          line-height: 1.5;
        }
        .lc-msg-time {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 9.5px;
          color: #71717a;
          font-variant-numeric: tabular-nums;
        }
        .lc-msg-del {
          margin-left: auto;
          padding: 2px;
          background: transparent;
          border: none;
          color: #71717a;
          opacity: 0;
          transition:
            opacity 120ms,
            color 120ms;
          cursor: pointer;
        }
        .lc-msg:hover .lc-msg-del {
          opacity: 1;
        }
        .lc-msg-del:hover {
          color: #f87171;
        }

        .lc-msg-text {
          font-size: 13px;
          line-height: 1.5;
          color: #d4d4d8;
          word-break: break-word;
        }

        /* Composer */
        .lc-composer {
          flex-shrink: 0;
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          gap: 8px;
          align-items: center;
          background: rgba(255, 255, 255, 0.012);
        }
        .lc-composer-input {
          flex: 1;
          height: 38px;
          padding: 0 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 999px;
          color: #f5f5f7;
          font-size: 13px;
          letter-spacing: -0.005em;
          outline: none;
          transition:
            border-color 150ms,
            background 150ms;
        }
        .lc-composer-input::placeholder {
          color: #71717a;
        }
        .lc-composer-input:focus {
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
        }
        .lc-composer-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .lc-composer-send {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 999px;
          background: #f5f5f7;
          color: #0a0a0b;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition:
            transform 120ms,
            background 150ms;
        }
        .lc-composer-send:hover:not(:disabled) {
          transform: scale(1.04);
        }
        .lc-composer-send:disabled {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
