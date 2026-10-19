'use client';

/**
 * cInsurance hero art: a protective dome being built over campus life.
 * Rain falls everywhere except under the dome; the outline is solid only
 * for the approval stages completed so far (`progress`, 0–1).
 */

const CX = 200;
const BASE = 270;
const RX = 170;
const RY = 190;
const DOME = `M${CX - RX} ${BASE} A${RX} ${RY} 0 0 1 ${CX + RX} ${BASE} Z`;
const ARC = `M${CX - RX} ${BASE} A${RX} ${RY} 0 0 1 ${CX + RX} ${BASE}`;
const onDome = (deg: number) => [CX + RX * Math.cos((deg * Math.PI) / 180), BASE - RY * Math.sin((deg * Math.PI) / 180)];

const RAIN = Array.from({ length: 72 }, (_, i) => ({
  x: Math.round(((i * 0.618034) % 1) * 430),
  delay: ((i * 0.137) % 1.3).toFixed(2),
  dur: (0.9 + ((i * 7) % 5) * 0.09).toFixed(2),
  len: 10 + ((i * 3) % 4) * 3,
}));
const SPLASH = [160, 142, 124, 106, 90, 74, 56, 38, 22].map((d, i) => ({ p: onDome(d), delay: (i * 0.37) % 1.6 }));
const STARS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 71 + 13) % 400, y: 8 + ((i * 37) % 70), r: i % 3 ? 0.9 : 1.5, d: (i * 0.4) % 3 }));
const WINDOWS = [
  [92, 232], [104, 232], [118, 232], [92, 248], [118, 248],
  [262, 226], [276, 226], [290, 226], [262, 242], [290, 242], [276, 242],
  [119, 200], [119, 214],
] as const;

function Student({ x, flip, delay }: { x: number; flip?: boolean; delay: string }) {
  return (
    <g transform={`translate(${x} ${BASE}) scale(${flip ? -1 : 1} 1)`}>
      <g className="hp-bob" style={{ animationDelay: delay }}>
        <ellipse cx="0" cy="0" rx="10" ry="2" fill="rgba(0,0,0,.35)" />
        {/* legs */}
        <path d="M-3 -16 L-5 -1 M3 -16 L5 -1" stroke="#c7d2fe" strokeWidth="3.2" strokeLinecap="round" />
        {/* backpack */}
        <rect x="-11" y="-33" width="7" height="13" rx="2.5" fill="#f59e0b" />
        {/* body */}
        <rect x="-6" y="-35" width="12" height="20" rx="5" fill="#e0e7ff" />
        {/* head */}
        <circle cx="0" cy="-41" r="5.5" fill="#fde7d4" />
        <path d="M-5.6 -42 C-5 -48 5 -48 5.6 -42 C3 -45 -3 -45 -5.6 -42 Z" fill="#1e1b4b" />
        {/* arm */}
        <path d="M5 -30 L8 -20" stroke="#e0e7ff" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  );
}

export function CampusDome({ progress = 0.25 }: { progress?: number }) {
  const [bx, by] = onDome(180 - 180 * progress);
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full overflow-visible" role="img" aria-label="A protective dome forming over students on campus">
      <defs>
        <pattern id="cdHex" width="18" height="31.2" patternUnits="userSpaceOnUse">
          <path d="M9 0 L18 5.2 L18 15.6 L9 20.8 L0 15.6 L0 5.2 Z M9 20.8 V31.2" fill="none" stroke="#a5b4fc" strokeWidth=".8" />
        </pattern>
        <linearGradient id="cdArc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#c4b5fd" />
        </linearGradient>
        <radialGradient id="cdInner" cx=".5" cy="1" r=".9">
          <stop offset="0" stopColor="#6366f1" stopOpacity=".38" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cdMoon">
          <stop offset="0" stopColor="#fef9c3" />
          <stop offset="1" stopColor="#fde68a" />
        </radialGradient>
        <linearGradient id="cdBeam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="cdCrescent">
          <rect x="330" y="10" width="60" height="60" fill="#fff" />
          <circle cx="363" cy="33" r="13" fill="#000" />
        </mask>
        <clipPath id="cdClip">
          <path d={DOME} />
        </clipPath>
        <mask id="cdOutside">
          <rect x="-40" y="-60" width="480" height="420" fill="#fff" />
          <path d={DOME} fill="#000" />
          <rect x="-40" y={BASE} width="480" height="80" fill="#000" />
        </mask>
        <mask id="cdBeamMask">
          <path
            className="hp-sweep"
            style={{ transformOrigin: `${CX}px ${BASE}px`, transformBox: 'view-box' }}
            d={`M${CX} ${BASE} L${CX + 260} ${BASE - 70} L${CX + 260} ${BASE + 70} Z`}
            fill="url(#cdBeam)"
          />
        </mask>
      </defs>

      {/* sky */}
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="hp-twinkle" style={{ animationDelay: `${s.d}s` }} />
      ))}
      <circle cx="356" cy="38" r="26" fill="#fde68a" opacity=".12" />
      <circle cx="356" cy="38" r="15" fill="url(#cdMoon)" mask="url(#cdCrescent)" />

      {/* rain, everywhere except under the dome */}
      <g mask="url(#cdOutside)" stroke="#93c5fd" strokeLinecap="round" strokeWidth="1.2" opacity=".45">
        {RAIN.map((r, i) => (
          <line key={i} x1={r.x} y1={-r.len} x2={r.x - 3} y2={0} className="hp-rain" style={{ animationDelay: `${r.delay}s`, animationDuration: `${r.dur}s` }} />
        ))}
      </g>

      {/* the dome */}
      <path d={DOME} fill="url(#cdInner)" />
      <g clipPath="url(#cdClip)">
        <rect x="0" y="60" width="400" height="220" fill="url(#cdHex)" opacity=".16" />
        <rect x="0" y="60" width="400" height="220" fill="url(#cdHex)" mask="url(#cdBeamMask)" opacity=".9" />
        {/* the part already built glows brighter */}
        <rect x="0" y="60" width={bx} height="220" fill="url(#cdHex)" opacity=".5" />
      </g>
      <path d={ARC} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" strokeDasharray="4 7" />
      <path d={ARC} pathLength={100} fill="none" stroke="url(#cdArc)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${progress * 100} 100`} style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }} />
      <path d={DOME} fill="none" stroke="#a5b4fc" strokeWidth="1" className="hp-ripple" style={{ transformOrigin: `${CX}px ${BASE}px`, transformBox: 'view-box' }} />
      {/* builder spark at the edge of what is done */}
      <circle cx={bx} cy={by} r="10" fill="#fcd34d" opacity=".25" className="hp-glow" />
      <circle cx={bx} cy={by} r="4" fill="#fde68a" style={{ filter: 'drop-shadow(0 0 6px #fcd34d)' }} />

      {/* splashes where rain meets the dome */}
      {SPLASH.map((s, i) => (
        <circle
          key={i}
          cx={s.p[0]}
          cy={s.p[1] - 2}
          r="4"
          fill="none"
          stroke="#bfdbfe"
          strokeWidth="1"
          className="hp-splash"
          style={{ animationDelay: `${s.delay}s`, transformOrigin: `${s.p[0]}px ${s.p[1] - 2}px`, transformBox: 'view-box' }}
        />
      ))}

      {/* campus */}
      <g>
        {/* trees */}
        {[58, 342].map((x) => (
          <g key={x}>
            <rect x={x - 1.5} y={BASE - 18} width="3" height="18" fill="#1e2a5a" />
            <circle cx={x} cy={BASE - 26} r="13" fill="#1f3a5f" />
            <circle cx={x - 6} cy={BASE - 20} r="8" fill="#22426b" />
          </g>
        ))}
        {/* wings */}
        <rect x="84" y="222" width="66" height="48" rx="2" fill="#1c2657" />
        <rect x="252" y="216" width="66" height="54" rx="2" fill="#1c2657" />
        {/* clock tower */}
        <rect x="110" y="190" width="24" height="80" fill="#222d66" />
        <path d="M106 190 L122 166 L138 190 Z" fill="#2b3780" />
        <circle cx="122" cy="183" r="4" fill="#fde68a" opacity=".9" />
        {/* main hall */}
        <rect x="150" y="206" width="102" height="64" fill="#26327a" />
        <path d="M144 207 L201 178 L258 207 Z" fill="#303e94" />
        <rect x="144" y="205" width="114" height="4" fill="#3a49a8" />
        {[158, 174, 190, 206, 222, 238].map((x) => (
          <rect key={x} x={x} y="212" width="6" height="50" rx="1" fill="#3f4fb3" />
        ))}
        <rect x="146" y="262" width="110" height="8" fill="#3a49a8" />
        <path d="M201 178 V160" stroke="#a5b4fc" strokeWidth="1.2" />
        <path d="M201 160 L214 164 L201 168 Z" fill="#38bdf8" className="hp-wave" style={{ transformOrigin: '201px 164px', transformBox: 'view-box' }} />
        {WINDOWS.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="7" height="8" rx="1" fill="#fcd34d" opacity=".85" className={i % 4 === 0 ? 'hp-twinkle' : undefined} style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
        {/* ground */}
        <ellipse cx={CX} cy={BASE} rx="185" ry="7" fill="#6366f1" opacity=".25" />
        <rect x="10" y={BASE} width="380" height="1.5" fill="url(#cdArc)" opacity=".6" />
      </g>

      <Student x={180} delay="0s" />
      <Student x={226} flip delay=".35s" />
    </svg>
  );
}
