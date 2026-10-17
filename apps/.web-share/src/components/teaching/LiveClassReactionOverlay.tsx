'use client';

import { useMemo } from 'react';

interface Reaction {
  key: string;
  emoji: string;
  displayName?: string;
  at: number;
}

export function ReactionOverlay({ reactions }: { reactions: Reaction[] }) {
  const items = useMemo(
    () =>
      reactions.map((r) => ({
        ...r,
        left: 8 + (Math.abs(hash(r.key)) % 84),
        drift: ((Math.abs(hash(r.key + 'd')) % 60) - 30) | 0,
        delay: (Math.abs(hash(r.key + 'a')) % 280) | 0,
      })),
    [reactions]
  );

  return (
    <div className="lc-reactlayer" aria-hidden>
      {items.map((r) => (
        <div
          key={r.key}
          className="lc-react-item"
          style={{
            left: `${r.left}%`,
            animationDelay: `${r.delay}ms`,
            // @ts-expect-error custom CSS var
            '--lc-drift': `${r.drift}px`,
          }}
        >
          <span className="lc-react-emoji">{r.emoji}</span>
          {r.displayName && <span className="lc-react-name">{r.displayName}</span>}
        </div>
      ))}
      <style jsx global>{`
        .lc-reactlayer {
          position: absolute;
          inset: 0;
          z-index: 30;
          pointer-events: none;
          overflow: hidden;
        }
        .lc-react-item {
          position: absolute;
          bottom: 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          animation: lc-rise 2.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          opacity: 0;
          will-change: transform, opacity;
        }
        .lc-react-emoji {
          font-size: 30px;
          line-height: 1;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));
        }
        .lc-react-name {
          padding: 1px 6px;
          background: rgba(0, 0, 0, 0.55);
          color: rgba(255, 255, 255, 0.85);
          border-radius: 999px;
          font-family: 'Hanken Grotesk', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: -0.005em;
          backdrop-filter: blur(6px);
        }
        @keyframes lc-rise {
          0% {
            transform: translate3d(0, 0, 0) scale(0.85);
            opacity: 0;
          }
          15% {
            transform: translate3d(calc(var(--lc-drift) * 0.2), -40px, 0) scale(1.1);
            opacity: 1;
          }
          70% {
            transform: translate3d(calc(var(--lc-drift) * 0.8), -200px, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--lc-drift), -300px, 0) scale(0.95);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
