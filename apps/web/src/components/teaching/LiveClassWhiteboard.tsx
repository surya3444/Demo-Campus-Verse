'use client';

// Excalidraw's CSS — required, must be a top-level static import so Next.js /
// Turbopack can statically resolve it via the package's `./index.css` export.
import '@excalidraw/excalidraw/index.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as Y from 'yjs';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { useLiveClassSocket } from '@/hooks/useLiveClassSocket';

const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then((m) => m.Excalidraw), {
  ssr: false,
  loading: () => <WBLoading />,
});

type Socket = ReturnType<typeof useLiveClassSocket>;

interface SceneSnapshot {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
}

// Bundled classroom-friendly libraries served from /public.
// Loaded once on first mount and merged into Excalidraw's library panel.
const BUNDLED_LIBRARY_FILES = [
  '/excalidraw-libraries/medicine.excalidrawlib',
  '/excalidraw-libraries/math-teacher.excalidrawlib',
  '/excalidraw-libraries/math-symbols.excalidrawlib',
  '/excalidraw-libraries/periodic-table.excalidrawlib',
  '/excalidraw-libraries/biology.excalidrawlib',
  '/excalidraw-libraries/3d-shapes.excalidrawlib',
  '/excalidraw-libraries/stars.excalidrawlib',
  '/excalidraw-libraries/stick-figures.excalidrawlib',
  '/excalidraw-libraries/sticky-notes.excalidrawlib',
];

// Module-level cache so we only fetch + parse the libraries once per page load,
// regardless of how many times the whiteboard mounts/unmounts.
let bundledLibraryItemsPromise: Promise<unknown[]> | null = null;
function loadBundledLibraryItems(): Promise<unknown[]> {
  if (bundledLibraryItemsPromise) return bundledLibraryItemsPromise;
  bundledLibraryItemsPromise = (async () => {
    const results = await Promise.all(
      BUNDLED_LIBRARY_FILES.map(async (url) => {
        try {
          const r = await fetch(url, { cache: 'force-cache' });
          if (!r.ok) return [];
          const json = (await r.json()) as { libraryItems?: unknown[] };
          return Array.isArray(json.libraryItems) ? json.libraryItems : [];
        } catch {
          return [];
        }
      })
    );
    return results.flat();
  })();
  return bundledLibraryItemsPromise;
}

// Inline styles — never depend on any styled-jsx mount lifecycle.
const ROOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#121212',
};

const FILL_STYLE: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  minWidth: 0,
};

/**
 * Y-Doc-backed collaborative whiteboard powered by Excalidraw.
 * The Y.Map "excalidraw.snapshot" carries the scene; updates fan out via the
 * existing live-class Socket.IO channel.
 */
export function LiveClassWhiteboard({ socket, canEdit }: { socket: Socket; canEdit: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const ydocRef = useRef<Y.Doc | null>(null);
  if (!ydocRef.current) ydocRef.current = new Y.Doc();
  const ydoc = ydocRef.current;

  // Hydrate from server snapshot once on mount
  useEffect(() => {
    let cancelled = false;
    if (!socket.joined) return;
    (async () => {
      const r = await socket.requestWhiteboardSnapshot();
      if (cancelled) return;
      if (r.ok && r.update && r.update.length > 0) {
        Y.applyUpdate(ydoc, r.update);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [socket.joined, socket, ydoc]);

  // Subscribe to remote ops
  useEffect(() => {
    return socket.subscribeWhiteboard((bytes) => {
      Y.applyUpdate(ydoc, bytes, 'remote');
    });
  }, [socket, ydoc]);

  // Broadcast local ops
  useEffect(() => {
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;
      socket.sendWhiteboardOp(update);
    };
    ydoc.on('update', onUpdate);
    return () => {
      ydoc.off('update', onUpdate);
    };
  }, [socket, ydoc]);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  return (
    <>
      <ExcalidrawSizingStyles />
      {!hydrated ? (
        <WBLoading />
      ) : (
        <div style={{ ...ROOT_STYLE, background: theme === 'dark' ? '#121212' : '#ffffff' }}>
          <div style={FILL_STYLE}>
            <ExcalidrawBridge ydoc={ydoc} canEdit={canEdit} theme={theme} />
          </div>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle whiteboard theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="lc-wb-theme-toggle"
            data-theme={theme}
          >
            {theme === 'dark' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </>
  );
}

function ExcalidrawBridge({
  ydoc,
  canEdit,
  theme,
}: {
  ydoc: Y.Doc;
  canEdit: boolean;
  theme: 'dark' | 'light';
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const yMap = useMemo(() => ydoc.getMap<unknown>('excalidraw'), [ydoc]);
  const applyingRemote = useRef(false);
  const lastSerialized = useRef<string>('');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [libraryItems, setLibraryItems] = useState<unknown[] | null>(null);

  // Load bundled libraries once
  useEffect(() => {
    let cancelled = false;
    loadBundledLibraryItems().then((items) => {
      if (!cancelled) setLibraryItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply Y.Map scene into the editor (initial + remote updates)
  useEffect(() => {
    const apply = () => {
      const snap = yMap.get('snapshot') as SceneSnapshot | undefined;
      if (!snap || !apiRef.current) return;
      const serialized = JSON.stringify(snap.elements);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;
      try {
        applyingRemote.current = true;
        apiRef.current.updateScene({
          elements: snap.elements as ExcalidrawElement[],
        });
      } finally {
        setTimeout(() => {
          applyingRemote.current = false;
        }, 0);
      }
    };
    apply();
    yMap.observe(apply);
    return () => {
      yMap.unobserve(apply);
    };
  }, [yMap]);

  const handleChange = (elements: readonly ExcalidrawElement[]) => {
    if (applyingRemote.current) return;
    if (!canEdit) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      const serialized = JSON.stringify(elements);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;
      ydoc.transact(() => {
        yMap.set('snapshot', { elements } as SceneSnapshot);
      });
    }, 80);
  };

  // Wait until libraries are loaded before mounting Excalidraw so the initial
  // library state lands in one shot (Excalidraw doesn't re-read initialData
  // after mount).
  if (libraryItems === null) return null;

  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        apiRef.current = api;
        const snap = yMap.get('snapshot') as SceneSnapshot | undefined;
        if (snap && snap.elements?.length > 0) {
          api.updateScene({ elements: snap.elements as ExcalidrawElement[] });
          lastSerialized.current = JSON.stringify(snap.elements);
        }
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialData={{ libraryItems: libraryItems as any }}
      onChange={handleChange}
      theme={theme}
      viewModeEnabled={!canEdit}
      gridModeEnabled={false}
      UIOptions={{
        canvasActions: {
          loadScene: false,
          saveToActiveFile: false,
          export: false,
          toggleTheme: false,
        },
      }}
    />
  );
}

/**
 * Always-mounted global styles. Excalidraw v0.18 injects its own CSS but we
 * defensively force the root element to fill its container — without this,
 * some edge cases leave `.excalidraw` collapsed to 0×0.
 */
function ExcalidrawSizingStyles() {
  return (
    <style jsx global>{`
      .excalidraw {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        font-family: 'Hanken Grotesk', system-ui, sans-serif !important;
      }
      .excalidraw .App-menu_top,
      .excalidraw .App-menu_bottom,
      .excalidraw .Island {
        font-family: inherit !important;
      }
      /* Hide Excalidraw's bottom-right help (?) button — we put our theme
         toggle in that corner instead. */
      .excalidraw .help-icon {
        display: none !important;
      }

      /* Hide Excalidraw's "Excalidraw links" group (GitHub, Follow us,
         Discord) from the hamburger menu. Modern browsers honour :has(),
         which strips the entire group; the per-link rules below catch
         older browsers and any future relocations of the same items. */
      .excalidraw .dropdown-menu-group:has(a[href*='github.com/excalidraw']),
      .excalidraw .dropdown-menu-group:has(a[href*='x.com/excalidraw']),
      .excalidraw .dropdown-menu-group:has(a[href*='discord.gg']) {
        display: none !important;
      }
      .excalidraw a[href*='github.com/excalidraw'],
      .excalidraw a[href*='x.com/excalidraw'],
      .excalidraw a[href*='twitter.com/excalidraw'],
      .excalidraw a[href*='discord.gg'],
      .excalidraw a[href*='discord.com/invite'] {
        display: none !important;
      }

      /* Theme toggle floating button */
      .lc-wb-theme-toggle {
        position: absolute;
        bottom: 16px;
        right: 16px;
        z-index: 5;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms,
          border-color 150ms,
          transform 120ms;
      }
      .lc-wb-theme-toggle:hover {
        transform: translateY(-1px);
      }
      .lc-wb-theme-toggle:active {
        transform: translateY(0);
      }
      .lc-wb-theme-toggle[data-theme='dark'] {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f5f5f7;
        box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.5);
      }
      .lc-wb-theme-toggle[data-theme='dark']:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .lc-wb-theme-toggle[data-theme='light'] {
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(0, 0, 0, 0.08);
        color: #0a0a0b;
        box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.15);
      }
      .lc-wb-theme-toggle[data-theme='light']:hover {
        background: #fff;
      }

      @keyframes lc-wb-pulse {
        0%,
        100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.05);
        }
        50% {
          transform: scale(1.08);
          box-shadow: 0 0 0 14px rgba(255, 255, 255, 0);
        }
      }
    `}</style>
  );
}

function WBLoading() {
  return (
    <div
      style={{
        ...ROOT_STYLE,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 60%), rgba(255,255,255,0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          animation: 'lc-wb-pulse 1.6s ease-in-out infinite',
        }}
      />
      <span>Loading whiteboard…</span>
    </div>
  );
}
