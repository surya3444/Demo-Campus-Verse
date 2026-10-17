'use client';

import '@livekit/components-styles';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useIsMuted,
  useIsSpeaking,
  isTrackReference,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  ChevronLeft,
  MessageSquare,
  Users,
  BarChart3,
  StopCircle,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  Video,
  PenLine,
  Mic,
  MicOff,
  VideoOff,
  Hand,
} from 'lucide-react';
import { useLiveClassSocket } from '@/hooks/useLiveClassSocket';
import { liveClassApi } from '@/lib/api';
import { toast } from 'sonner';
import { ChatPanel } from './LiveClassChatPanel';
import { PollPanel } from './LiveClassPollPanel';
import { ParticipantsPanel } from './LiveClassParticipantsPanel';
import { ReactionOverlay } from './LiveClassReactionOverlay';
import { LiveClassWhiteboard } from './LiveClassWhiteboard';
import { LiveClassControlDock } from './LiveClassControlDock';

interface LiveClassRoomProps {
  liveClass: {
    _id: string;
    title: string;
    status: string;
    recordingEnabled?: boolean;
    recordingStatus?: 'pending' | 'ready' | 'failed';
    settings?: { studentCanDraw?: boolean };
  };
  joinResponse: {
    livekitUrl: string;
    livekitToken: string;
    role: 'host' | 'cohost' | 'student';
    displayName: string;
  };
  onLeave: () => void;
  onEnd: () => void;
}

export function LiveClassRoom({ liveClass, joinResponse, onLeave, onEnd }: LiveClassRoomProps) {
  const [tab, setTab] = useState<'chat' | 'participants' | 'polls'>('chat');
  const [panelOpen, setPanelOpen] = useState(true);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const isHost = joinResponse.role === 'host' || joinResponse.role === 'cohost';
  const canDraw = isHost || liveClass.settings?.studentCanDraw === true;

  const socket = useLiveClassSocket(liveClass._id);
  const participantCount = Object.keys(socket.participants).length + 1;

  // Recording UI state. Seeded from the join response (host can stop a
  // recording started before they joined) and updated by `recording:state`.
  const [recordingState, setRecordingState] = useState<
    'off' | 'starting' | 'recording' | 'stopping'
  >(liveClass.recordingStatus === 'pending' || liveClass.recordingEnabled ? 'recording' : 'off');

  useEffect(() => {
    const off = socket.onRecordingState?.((state) => setRecordingState(state));
    return off;
  }, [socket]);

  // The current user got kicked → leave the room.
  useEffect(() => {
    const off = socket.onKicked?.(() => {
      toast.error('You were removed from the class by the host');
      onLeave();
    });
    return off;
  }, [socket, onLeave]);

  const handleMuteAll = async () => {
    try {
      const res = await liveClassApi.muteAll(liveClass._id);
      toast.success(`Muted ${res.data?.mutedCount ?? 0} participants`);
    } catch (err) {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to mute all'
      );
    }
  };

  const handleStartRecording = async () => {
    setRecordingState('starting');
    try {
      await liveClassApi.startRecording(liveClass._id);
      // Final transition to 'recording' arrives via socket recording:state
    } catch (err) {
      setRecordingState('off');
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to start recording'
      );
    }
  };

  const handleStopRecording = async () => {
    setRecordingState('stopping');
    try {
      await liveClassApi.stopRecording(liveClass._id);
    } catch (err) {
      setRecordingState('recording');
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to stop recording'
      );
    }
  };

  const handleKick = async (userId: string) => {
    try {
      await liveClassApi.kick(liveClass._id, userId);
    } catch (err) {
      toast.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to remove participant'
      );
    }
  };

  // Live timer
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <LiveKitRoom
      token={joinResponse.livekitToken}
      serverUrl={joinResponse.livekitUrl}
      connect
      audio
      video={isHost}
      onDisconnected={onLeave}
      data-lk-theme="default"
      className="lc-root"
    >
      <RoomStyles />

      <div className="lc-stage">
        {/* TOP BAR */}
        <header className="lc-topbar">
          <div className="lc-topbar-left">
            <button onClick={onLeave} className="lc-iconbtn lc-iconbtn--ghost" aria-label="Leave">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="lc-titleblock">
              <div className="lc-title" title={liveClass.title}>
                {liveClass.title}
              </div>
              <div className="lc-meta">
                <span className="lc-livepill">
                  <span className="lc-livedot" />
                  LIVE
                </span>
                <span className="lc-meta-dot" />
                <span className="lc-mono">{formatDuration(elapsedSec)}</span>
                <span className="lc-meta-dot" />
                <span className="lc-watching">
                  <Users className="h-3 w-3" />
                  <span className="lc-mono">{String(participantCount).padStart(2, '0')}</span>{' '}
                  watching
                </span>
              </div>
            </div>
          </div>

          {/* Centered stage-mode switch: Video ⇄ Whiteboard */}
          <div className="lc-topbar-center">
            <ModeToggle showWhiteboard={showWhiteboard} onChange={setShowWhiteboard} />
          </div>

          <div className="lc-topbar-right">
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className="lc-iconbtn lc-iconbtn--ghost"
              aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
              title={panelOpen ? 'Hide panel' : 'Show panel'}
            >
              {panelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
            {isHost && (
              <button onClick={onEnd} className="lc-endbtn" type="button">
                <span className="lc-endbtn-dot" />
                <span className="lc-endbtn-label">
                  <StopCircle className="h-3.5 w-3.5" />
                  End class
                </span>
              </button>
            )}
          </div>
        </header>

        {/* MAIN */}
        <div className="lc-main">
          <section className="lc-canvas">
            {showWhiteboard ? (
              <div className="lc-whiteboardarea">
                <LiveClassWhiteboard socket={socket} canEdit={canDraw} />
                <div className="lc-pip">
                  <VideoArea compact />
                </div>
              </div>
            ) : (
              <div className="lc-stage-frame">
                <VideoArea raisedHands={socket.raisedHands} />
                <span className="lc-vignette" aria-hidden />
              </div>
            )}
            <ReactionOverlay reactions={socket.reactions} />
          </section>

          {panelOpen && (
            <aside className="lc-panel">
              <div className="lc-panel-tabs" role="tablist">
                <PanelTab
                  active={tab === 'chat'}
                  onClick={() => setTab('chat')}
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  label="Chat"
                />
                <PanelTab
                  active={tab === 'participants'}
                  onClick={() => setTab('participants')}
                  icon={<Users className="h-3.5 w-3.5" />}
                  label={`People · ${participantCount}`}
                />
                <PanelTab
                  active={tab === 'polls'}
                  onClick={() => setTab('polls')}
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  label="Polls"
                  pulse={!!socket.currentPoll}
                />
              </div>
              <div className="lc-panel-body">
                {tab === 'chat' && <ChatPanel socket={socket} />}
                {tab === 'participants' && (
                  <ParticipantsPanel
                    socket={socket}
                    hostDisplayName={joinResponse.displayName}
                    isHost={isHost}
                    onKick={handleKick}
                  />
                )}
                {tab === 'polls' && <PollPanel socket={socket} isHost={isHost} />}
              </div>
            </aside>
          )}
        </div>

        {/* DOCK */}
        <LiveClassControlDock
          isHost={isHost}
          onSendReaction={socket.sendReaction}
          onRaiseHand={socket.raiseHand}
          onLowerHand={socket.lowerHand}
          onLeave={onLeave}
          recordingState={recordingState}
          onMuteAll={isHost ? handleMuteAll : undefined}
          onStartRecording={isHost ? handleStartRecording : undefined}
          onStopRecording={isHost ? handleStopRecording : undefined}
        />

        <RoomAudioRenderer />
      </div>
    </LiveKitRoom>
  );
}

function PanelTab({
  active,
  onClick,
  icon,
  label,
  pulse,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`lc-paneltab${active ? ' lc-paneltab--active' : ''}`}
      role="tab"
      aria-selected={active}
    >
      {icon}
      <span>{label}</span>
      {pulse && <span className="lc-tab-pulse" />}
    </button>
  );
}

function VideoArea({
  compact = false,
  raisedHands = {},
}: {
  compact?: boolean;
  raisedHands?: Record<string, unknown>;
}) {
  // Split camera and screen-share so we can render screen-share as a focused
  // stage with the camera demoted to a corner PiP — same UX as whiteboard mode.
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], {
    onlySubscribed: false,
  });

  // Compact PiP (whiteboard / screen-share corner): first real camera only.
  if (compact) {
    const cam = cameraTracks.find((t) => 'publication' in t && t.publication);
    if (!cam) return <div className="lc-pip-empty" />;
    return (
      <GridLayout tracks={[cam]} className="lk-grid-layout w-full h-full">
        <ParticipantTile />
      </GridLayout>
    );
  }

  // Screen share active → screen fills the stage, host camera floats as PiP.
  if (screenTracks.length > 0) {
    const screenSharerIdentity = screenTracks[0].participant.identity;
    // Prefer the screen-sharer's own camera (so the teacher sees themselves
    // talking over their slides). Fall back to any other real camera.
    const sharerCam = cameraTracks.find(
      (t) => 'publication' in t && t.publication && t.participant.identity === screenSharerIdentity
    );
    const fallbackCam = cameraTracks.find((t) => 'publication' in t && t.publication);
    const pipCam = sharerCam ?? fallbackCam;

    return (
      <>
        <GridLayout
          tracks={screenTracks.slice(0, 1)}
          className="lk-grid-layout lc-screenstage w-full h-full"
        >
          <ParticipantTile />
        </GridLayout>
        {pipCam && (
          <div className="lc-pip">
            <GridLayout tracks={[pipCam]} className="lk-grid-layout w-full h-full">
              <ParticipantTile />
            </GridLayout>
          </div>
        )}
      </>
    );
  }

  // No tracks anywhere → empty stage
  if (cameraTracks.length === 0) {
    return (
      <div className="lc-empty-stage">
        <div className="lc-empty-orb">
          <Radio className="h-7 w-7" />
        </div>
        <div className="lc-empty-headline">Waiting for video</div>
        <div className="lc-empty-sub">
          The host hasn't started broadcasting yet — they'll appear here in a moment.
        </div>
      </div>
    );
  }

  // Default — custom attendee gallery: a tile per participant (video when their
  // camera is on, otherwise a signature-coloured avatar) with mic/camera state.
  return <AttendeeGallery cameraTracks={cameraTracks} raisedHands={raisedHands} />;
}

// ─────────────────────────── Attendee gallery ───────────────────────────

function AttendeeGallery({
  cameraTracks,
  raisedHands,
}: {
  cameraTracks: TrackReferenceOrPlaceholder[];
  raisedHands: Record<string, unknown>;
}) {
  // A parallel mic subscription (one placeholder per participant) so the grid
  // re-renders on mute/unmute and we can read each person's mic state.
  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  const micByIdentity = new Map<string, TrackReferenceOrPlaceholder>();
  micTracks.forEach((t) => micByIdentity.set(t.participant.identity, t));

  // Hosts/co-hosts first, then anyone with their camera on, then by name.
  const ordered = [...cameraTracks].sort((a, b) => {
    const ra = roleRank(a.participant.identity);
    const rb = roleRank(b.participant.identity);
    if (ra !== rb) return ra - rb;
    const ca = isTrackReference(a) ? 0 : 1;
    const cb = isTrackReference(b) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (a.participant.name || '').localeCompare(b.participant.name || '');
  });

  const cols = columnsFor(ordered.length);

  return (
    <div className="lc-gallery-scroll">
      <div
        className="lc-gallery"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {ordered.map((camRef, i) => (
          <AttendeeTile
            key={camRef.participant.identity}
            camRef={camRef}
            micRef={micByIdentity.get(camRef.participant.identity)}
            raised={!!raisedHands[userIdFromIdentity(camRef.participant.identity)]}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function AttendeeTile({
  camRef,
  micRef,
  raised,
  index,
}: {
  camRef: TrackReferenceOrPlaceholder;
  micRef?: TrackReferenceOrPlaceholder;
  raised: boolean;
  index: number;
}) {
  const p = camRef.participant;
  // useIsMuted needs a real trackRef — micRef is always present in practice
  // (same participant set), camRef is the safe fallback for the type-checker.
  const camMuted = useIsMuted(camRef);
  const micMuted = useIsMuted(micRef ?? camRef);
  const speaking = useIsSpeaking(p);

  const cameraOn = isTrackReference(camRef) && !camMuted;
  const micOn = !!micRef && isTrackReference(micRef) && !micMuted;

  const role = roleFromIdentity(p.identity);
  const name = p.name || 'Guest';
  const hue = hueFromString(p.identity);

  return (
    <div
      className={`lc-att${speaking ? ' lc-att--speaking' : ''}${cameraOn ? ' lc-att--live' : ''}`}
      style={{ animationDelay: `${Math.min(index, 16) * 40}ms` }}
    >
      {cameraOn ? (
        <VideoTrack trackRef={camRef} className="lc-att-video" />
      ) : (
        <div
          className="lc-att-avatarwrap"
          style={
            {
              '--lc-att-h': String(hue),
            } as React.CSSProperties
          }
        >
          <span className="lc-att-glow" aria-hidden />
          <span className="lc-att-avatar">{initials(name)}</span>
        </div>
      )}

      {/* Top-right status cluster */}
      <div className="lc-att-status">
        {raised && (
          <span className="lc-att-badge lc-att-badge--hand" title="Hand raised">
            <Hand className="h-3 w-3" />
          </span>
        )}
        {!cameraOn && (
          <span className="lc-att-badge lc-att-badge--off" title="Camera off">
            <VideoOff className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Bottom bar: name + role + mic state */}
      <div className="lc-att-bar">
        <span className={`lc-att-mic${micOn ? ' is-on' : ' is-off'}`}>
          {micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
        </span>
        <span className="lc-att-name" title={name}>
          {p.isLocal ? `${name} (You)` : name}
        </span>
        {(role === 'host' || role === 'cohost') && (
          <span className={`lc-att-role lc-att-role--${role}`}>
            {role === 'host' ? 'Host' : 'Co-host'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Attendee helpers ──
function roleFromIdentity(identity: string): 'host' | 'cohost' | 'student' {
  if (identity.endsWith('_host')) return 'host';
  if (identity.endsWith('_cohost')) return 'cohost';
  return 'student';
}
function roleRank(identity: string): number {
  const r = roleFromIdentity(identity);
  return r === 'host' ? 0 : r === 'cohost' ? 1 : 2;
}
function userIdFromIdentity(identity: string): string {
  return identity.replace(/_(host|cohost|student)$/, '');
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
// Deterministic hue so each person keeps a consistent signature colour.
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function columnsFor(n: number): number {
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  if (n <= 16) return 4;
  if (n <= 25) return 5;
  return 6;
}

function ModeToggle({
  showWhiteboard,
  onChange,
}: {
  showWhiteboard: boolean;
  onChange: (whiteboard: boolean) => void;
}) {
  return (
    <div className="lc-modetoggle" role="tablist" aria-label="Stage mode">
      <span className="lc-modetoggle-thumb" data-mode={showWhiteboard ? 'board' : 'video'} />
      <button
        type="button"
        role="tab"
        aria-selected={!showWhiteboard}
        className={`lc-modeseg${!showWhiteboard ? ' is-active' : ''}`}
        onClick={() => onChange(false)}
      >
        <Video className="h-3.5 w-3.5" />
        <span>Video</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={showWhiteboard}
        className={`lc-modeseg${showWhiteboard ? ' is-active' : ''}`}
        onClick={() => onChange(true)}
      >
        <PenLine className="h-3.5 w-3.5" />
        <span>Whiteboard</span>
      </button>
    </div>
  );
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function RoomStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

      .lc-root {
        font-family:
          'Hanken Grotesk',
          system-ui,
          -apple-system,
          sans-serif;
        font-feature-settings: 'ss01', 'ss03', 'cv11';
        letter-spacing: -0.005em;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .lc-stage {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        flex-direction: column;
        background:
          radial-gradient(80% 50% at 50% 0%, rgba(80, 90, 120, 0.06), transparent 60%),
          radial-gradient(50% 60% at 100% 100%, rgba(239, 68, 68, 0.04), transparent 60%), #07070a;
        color: #f5f5f7;
      }

      /* === Top bar === */
      .lc-topbar {
        flex-shrink: 0;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: linear-gradient(180deg, rgba(15, 15, 18, 0.85) 0%, rgba(10, 10, 12, 0.55) 100%);
        backdrop-filter: blur(28px) saturate(140%);
        -webkit-backdrop-filter: blur(28px) saturate(140%);
      }
      .lc-topbar-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .lc-topbar-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .lc-titleblock {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .lc-title {
        font-weight: 700;
        font-size: 15px;
        line-height: 1.2;
        color: #f5f5f7;
        letter-spacing: -0.012em;
        max-width: 420px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lc-meta {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 11px;
        color: #8e8e96;
        line-height: 1;
      }

      .lc-meta-dot {
        width: 2px;
        height: 2px;
        background: #444;
        border-radius: 1px;
      }

      .lc-mono {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.01em;
      }

      .lc-watching {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #b3b3bb;
      }

      .lc-livepill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 7px 2px 6px;
        background: rgba(239, 68, 68, 0.13);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 999px;
        color: #fca5a5;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.14em;
        line-height: 1;
      }
      .lc-livedot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ef4444;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        animation: lc-livepulse 1.6s ease-out infinite;
      }
      @keyframes lc-livepulse {
        0% {
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        }
        70% {
          box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
        }
      }

      /* Icon button */
      .lc-iconbtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: #d4d4d8;
        transition:
          background 150ms,
          color 150ms,
          border-color 150ms;
      }
      .lc-iconbtn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.12);
      }
      .lc-iconbtn--ghost {
        background: transparent;
        border-color: transparent;
      }
      .lc-iconbtn--ghost:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      /* End class button — premium red */
      .lc-endbtn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 14px 0 10px;
        height: 34px;
        background: linear-gradient(180deg, #f43f5e 0%, #dc2626 100%);
        border: 1px solid rgba(220, 38, 38, 0.6);
        border-radius: 10px;
        color: #fff;
        font-weight: 600;
        font-size: 12.5px;
        letter-spacing: -0.005em;
        box-shadow:
          0 6px 18px -6px rgba(220, 38, 38, 0.55),
          0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        transition:
          transform 150ms ease,
          box-shadow 150ms ease;
      }
      .lc-endbtn:hover {
        transform: translateY(-1px);
        box-shadow:
          0 10px 22px -6px rgba(220, 38, 38, 0.65),
          0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      }
      .lc-endbtn:active {
        transform: translateY(0);
      }
      .lc-endbtn-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fff;
        animation: lc-livepulse 1.6s ease-out infinite;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
      }
      .lc-endbtn-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      /* === Main grid === */
      .lc-main {
        flex: 1;
        display: flex;
        min-height: 0;
        gap: 0;
      }

      .lc-canvas {
        flex: 1;
        position: relative;
        padding: 16px;
        display: flex;
      }

      .lc-stage-frame {
        position: relative;
        flex: 1;
        border-radius: 18px;
        overflow: hidden;
        background: #0e0e11;
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.3) inset,
          0 30px 60px -30px rgba(0, 0, 0, 0.7);
      }

      .lc-vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(120% 90% at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.55) 100%);
      }

      .lc-canvas .lk-grid-layout {
        width: 100%;
        height: 100%;
        background: #0e0e11;
      }
      .lc-canvas .lk-participant-tile {
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: #1a1a1f;
      }
      .lc-stage-frame .lk-participant-tile {
        border: none;
        border-radius: 0;
      }

      /* Screen-share stage — show the entire screen content (letterboxed) and
         drop tile chrome so it feels like a focused projection. */
      .lc-screenstage {
        background: #050507 !important;
      }
      .lc-screenstage .lk-participant-tile {
        background: #050507;
        border: none;
        border-radius: 0;
      }
      .lc-screenstage video {
        object-fit: contain !important;
        background: #050507;
      }

      /* Empty stage */
      .lc-empty-stage {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 14px;
        padding: 32px;
      }
      .lc-empty-orb {
        width: 72px;
        height: 72px;
        border-radius: 999px;
        background:
          radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.1), transparent 60%),
          rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #71717a;
        animation: lc-orb 3.6s ease-in-out infinite;
      }
      @keyframes lc-orb {
        0%,
        100% {
          transform: translateY(0);
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.05);
        }
        50% {
          transform: translateY(-3px);
          box-shadow: 0 0 0 12px rgba(255, 255, 255, 0);
        }
      }
      .lc-empty-headline {
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #e5e5e7;
      }
      .lc-empty-sub {
        font-size: 13px;
        color: #71717a;
        max-width: 320px;
        line-height: 1.5;
      }

      /* Whiteboard area */
      .lc-whiteboardarea {
        position: relative;
        flex: 1;
        border-radius: 18px;
        overflow: hidden;
        background: #fff;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .lc-pip {
        position: absolute;
        bottom: 16px;
        right: 16px;
        width: 220px;
        height: 132px;
        border-radius: 12px;
        overflow: hidden;
        background: #0a0a0b;
        border: 1.5px solid rgba(255, 255, 255, 0.18);
        box-shadow:
          0 12px 28px rgba(0, 0, 0, 0.4),
          0 0 0 1px rgba(0, 0, 0, 0.4) inset;
      }
      .lc-pip-empty {
        width: 100%;
        height: 100%;
        background: #0a0a0b;
      }

      /* === Side panel === */
      .lc-panel {
        width: 380px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: #0d0d10;
        border-left: 1px solid rgba(255, 255, 255, 0.06);
        margin: 16px 16px 16px 0;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        overflow: hidden;
        box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.6);
      }
      .lc-panel-tabs {
        flex-shrink: 0;
        display: flex;
        gap: 2px;
        padding: 10px 10px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(255, 255, 255, 0.015);
      }
      .lc-paneltab {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 11px;
        background: transparent;
        color: #8e8e96;
        border: none;
        font-size: 11.5px;
        font-weight: 500;
        letter-spacing: -0.005em;
        border-radius: 8px 8px 0 0;
        transition:
          color 150ms,
          background 150ms;
        cursor: pointer;
      }
      .lc-paneltab:hover {
        color: #d4d4d8;
        background: rgba(255, 255, 255, 0.03);
      }
      .lc-paneltab--active {
        color: #f5f5f7;
        background: rgba(255, 255, 255, 0.04);
      }
      .lc-paneltab--active::after {
        content: '';
        position: absolute;
        left: 11px;
        right: 11px;
        bottom: -1px;
        height: 2px;
        border-radius: 2px;
        background: #f5f5f7;
      }
      .lc-tab-pulse {
        width: 6px;
        height: 6px;
        border-radius: 3px;
        background: #f59e0b;
        box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6);
        animation: lc-livepulse 1.4s ease-in-out infinite;
      }

      .lc-panel-body {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      /* === Dock === */
      .lc-dockwrap {
        flex-shrink: 0;
        display: flex;
        justify-content: center;
        padding: 8px 0 22px;
        position: relative;
        z-index: 5;
      }

      .lc-dock {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        background: rgba(20, 20, 24, 0.78);
        backdrop-filter: blur(28px) saturate(140%);
        -webkit-backdrop-filter: blur(28px) saturate(140%);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 18px;
        box-shadow:
          0 18px 40px -10px rgba(0, 0, 0, 0.7),
          0 0 0 1px rgba(255, 255, 255, 0.02) inset;
      }

      .lc-divider {
        width: 1px;
        height: 26px;
        background: rgba(255, 255, 255, 0.08);
        margin: 0 4px;
      }

      .lc-dockbtn {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        min-width: 64px;
        padding: 7px 10px 5px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 11px;
        color: #d4d4d8;
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms,
          border-color 150ms,
          transform 100ms;
      }
      .lc-dockbtn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
      }
      .lc-dockbtn:active {
        transform: translateY(1px);
      }
      .lc-dockbtn-glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 20px;
      }
      .lc-dockbtn-label {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.01em;
        line-height: 1.1;
      }

      /* dock variants */
      .lc-dockbtn--on {
        color: #d4d4d8;
      }
      .lc-dockbtn--on.is-active {
        background: rgba(255, 255, 255, 0.07);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.06);
      }
      .lc-dockbtn--speaking {
        color: #fff;
        background: rgba(34, 197, 94, 0.12);
        border-color: rgba(34, 197, 94, 0.32);
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
        animation: lc-speak 1.2s ease-in-out infinite;
      }
      @keyframes lc-speak {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
        }
        50% {
          box-shadow: 0 0 0 5px rgba(34, 197, 94, 0);
        }
      }
      .lc-dockbtn--danger {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.13);
        border-color: rgba(239, 68, 68, 0.28);
      }
      .lc-dockbtn--danger:hover {
        color: #fff;
        background: rgba(239, 68, 68, 0.2);
      }
      .lc-dockbtn--accent {
        color: #93c5fd;
        background: rgba(59, 130, 246, 0.13);
        border-color: rgba(59, 130, 246, 0.3);
      }
      .lc-dockbtn--accent:hover {
        color: #fff;
        background: rgba(59, 130, 246, 0.22);
      }
      .lc-dockbtn--amber {
        color: #fcd34d;
        background: rgba(245, 158, 11, 0.13);
        border-color: rgba(245, 158, 11, 0.3);
      }
      .lc-dockbtn--amber:hover {
        color: #fff;
        background: rgba(245, 158, 11, 0.22);
      }

      /* Reactions popover */
      .lc-reactionspop {
        position: absolute;
        bottom: calc(100% + 12px);
        left: 50%;
        transform: translateX(-50%);
        display: grid;
        grid-template-columns: repeat(4, 36px);
        gap: 4px;
        padding: 8px;
        background: rgba(22, 22, 26, 0.95);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.7);
        animation: lc-popin 200ms cubic-bezier(0.2, 0.8, 0.2, 1.05);
        z-index: 10;
      }
      @keyframes lc-popin {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(8px) scale(0.92);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
        }
      }
      .lc-emoji {
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition:
          background 150ms,
          transform 150ms;
        animation: lc-emojipop 260ms cubic-bezier(0.2, 0.8, 0.2, 1.1) backwards;
      }
      .lc-emoji:hover {
        background: rgba(255, 255, 255, 0.07);
        transform: scale(1.18);
      }
      @keyframes lc-emojipop {
        from {
          opacity: 0;
          transform: scale(0.6);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Leave button */
      .lc-leavebtn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 14px;
        height: 36px;
        background: rgba(239, 68, 68, 0.13);
        border: 1px solid rgba(239, 68, 68, 0.28);
        color: #fca5a5;
        border-radius: 11px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        transition:
          background 150ms,
          color 150ms;
      }
      .lc-leavebtn:hover {
        background: rgba(239, 68, 68, 0.22);
        color: #fff;
      }

      /* Hide LiveKit's default participant overlays we don't want */
      .lc-canvas .lk-participant-metadata {
        background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%);
        padding: 8px 12px;
      }
      .lc-canvas .lk-participant-metadata-item {
        font-family: 'Hanken Grotesk', sans-serif;
        font-size: 12px;
        font-weight: 500;
      }

      /* === Stage-mode toggle (topbar centre) === */
      .lc-topbar {
        position: relative;
      }
      .lc-topbar-center {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 1;
      }
      .lc-modetoggle {
        position: relative;
        /* Equal-width columns (sized to the WIDER label) so the 50% sliding
           thumb lines up with each segment instead of overflowing the border
           when the active label ("Whiteboard") is longer than the other. */
        display: inline-grid;
        grid-template-columns: 1fr 1fr;
        align-items: stretch;
        padding: 3px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.09);
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }
      .lc-modetoggle-thumb {
        position: absolute;
        top: 3px;
        left: 3px;
        width: calc(50% - 3px);
        height: calc(100% - 6px);
        border-radius: 999px;
        background: linear-gradient(180deg, #4b8bf7, #2563eb);
        box-shadow:
          0 5px 16px -5px rgba(59, 130, 246, 0.7),
          inset 0 1px 0 rgba(255, 255, 255, 0.25);
        transition: transform 300ms cubic-bezier(0.34, 1.28, 0.5, 1);
      }
      .lc-modetoggle-thumb[data-mode='board'] {
        transform: translateX(100%);
      }
      .lc-modeseg {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 16px;
        border: none;
        background: transparent;
        border-radius: 999px;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 600;
        letter-spacing: -0.005em;
        color: #9a9aa2;
        white-space: nowrap;
        cursor: pointer;
        transition: color 220ms ease;
      }
      .lc-modeseg.is-active {
        color: #fff;
      }
      .lc-modeseg:hover:not(.is-active) {
        color: #d4d4d8;
      }

      /* === Attendee gallery === */
      .lc-gallery-scroll {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .lc-gallery-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .lc-gallery-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 999px;
      }
      .lc-gallery {
        min-height: 100%;
        display: grid;
        gap: 12px;
        padding: 16px;
        align-content: center;
      }
      .lc-att {
        container-type: size;
        position: relative;
        aspect-ratio: 16 / 10;
        min-width: 0;
        border-radius: 14px;
        overflow: hidden;
        background: #15151a;
        border: 1px solid rgba(255, 255, 255, 0.07);
        box-shadow: 0 12px 32px -20px rgba(0, 0, 0, 0.9);
        opacity: 0;
        animation: lc-att-in 440ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        transition:
          transform 200ms ease,
          border-color 200ms ease;
      }
      .lc-att:hover {
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.15);
      }
      .lc-att--live {
        background: #000;
      }
      @keyframes lc-att-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      /* Speaking ring lives on ::after so it never fights the entrance anim */
      .lc-att::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 14px;
        pointer-events: none;
        box-shadow: inset 0 0 0 0 rgba(34, 197, 94, 0);
        transition: box-shadow 200ms ease;
      }
      .lc-att--speaking::after {
        animation: lc-att-speak 1.6s ease-in-out infinite;
      }
      @keyframes lc-att-speak {
        0%,
        100% {
          box-shadow:
            inset 0 0 0 2px rgba(34, 197, 94, 0.85),
            inset 0 0 0 0 rgba(34, 197, 94, 0);
        }
        50% {
          box-shadow:
            inset 0 0 0 2px rgba(34, 197, 94, 0.95),
            inset 0 0 26px rgba(34, 197, 94, 0.32);
        }
      }
      .lc-att-video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .lc-att-avatarwrap {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background:
          radial-gradient(
            120% 85% at 50% 16%,
            hsl(var(--lc-att-h) 45% 24% / 0.95),
            transparent 72%
          ),
          linear-gradient(165deg, #17171c, #0f0f14);
      }
      .lc-att-glow {
        position: absolute;
        width: 58%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: radial-gradient(circle, hsl(var(--lc-att-h) 85% 58% / 0.3), transparent 64%);
        filter: blur(8px);
      }
      .lc-att-avatar {
        position: relative;
        display: grid;
        place-items: center;
        width: clamp(40px, 34cqmin, 104px);
        aspect-ratio: 1;
        border-radius: 50%;
        background: linear-gradient(
          150deg,
          hsl(var(--lc-att-h) 58% 44%),
          hsl(calc(var(--lc-att-h) + 26) 64% 30%)
        );
        color: #fff;
        font-weight: 700;
        font-size: clamp(14px, 13cqmin, 36px);
        letter-spacing: 0.01em;
        border: 1px solid hsl(var(--lc-att-h) 65% 68% / 0.35);
        box-shadow:
          0 10px 28px -10px hsl(var(--lc-att-h) 70% 28% / 0.85),
          inset 0 1px 0 rgba(255, 255, 255, 0.28);
      }
      .lc-att-status {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 5px;
        z-index: 2;
      }
      .lc-att-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        backdrop-filter: blur(8px);
      }
      .lc-att-badge--off {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.32);
      }
      .lc-att-badge--hand {
        background: rgba(245, 158, 11, 0.22);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.36);
        transform-origin: 70% 75%;
        animation: lc-att-wave 1.5s ease-in-out infinite;
      }
      @keyframes lc-att-wave {
        0%,
        100% {
          transform: rotate(0deg);
        }
        25% {
          transform: rotate(-13deg);
        }
        75% {
          transform: rotate(13deg);
        }
      }
      .lc-att-bar {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 20px 9px 8px;
        background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.66));
        z-index: 1;
      }
      .lc-att-mic {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .lc-att-mic.is-on {
        color: #bbf7d0;
        background: rgba(34, 197, 94, 0.18);
      }
      .lc-att-mic.is-off {
        color: #fecaca;
        background: rgba(239, 68, 68, 0.22);
      }
      .lc-att-name {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        font-weight: 600;
        color: #f1f1f4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
      }
      .lc-att-role {
        flex-shrink: 0;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 8.5px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 999px;
      }
      .lc-att-role--host {
        background: rgba(245, 158, 11, 0.18);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.32);
      }
      .lc-att-role--cohost {
        background: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
        border: 1px solid rgba(59, 130, 246, 0.32);
      }
    `}</style>
  );
}
