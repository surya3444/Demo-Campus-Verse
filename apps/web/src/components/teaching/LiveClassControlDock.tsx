'use client';

import { useEffect, useRef, useState } from 'react';
import { useTrackToggle, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video as Cam,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  Smile,
  LogOut,
  MicOff as MuteAllIcon,
  Circle,
  Square,
} from 'lucide-react';

const REACTIONS = ['👍', '❤️', '🎉', '😂', '😮', '👏', '🔥', '💯'];

interface DockProps {
  isHost: boolean;
  onSendReaction: (e: string) => void;
  onRaiseHand: () => void;
  onLowerHand: () => void;
  onLeave: () => void;
  // Host-only controls. When omitted (or isHost=false), the buttons are hidden.
  recordingState?: 'off' | 'starting' | 'recording' | 'stopping';
  onMuteAll?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}

export function LiveClassControlDock({
  isHost,
  onSendReaction,
  onRaiseHand,
  onLowerHand,
  onLeave,
  recordingState = 'off',
  onMuteAll,
  onStartRecording,
  onStopRecording,
}: DockProps) {
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });
  const { localParticipant } = useLocalParticipant();
  // Speaking ring animation reads from livekit's isSpeaking
  const isSpeaking = localParticipant?.isSpeaking ?? false;

  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reactionsOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setReactionsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setReactionsOpen(false);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [reactionsOpen]);

  const toggleHand = () => {
    if (handRaised) {
      onLowerHand();
      setHandRaised(false);
    } else {
      onRaiseHand();
      setHandRaised(true);
    }
  };

  const launchReaction = (emoji: string) => {
    onSendReaction(emoji);
    setReactionsOpen(false);
  };

  return (
    <div className="lc-dockwrap">
      <div className="lc-dock">
        {isHost && (
          <>
            <DockBtn
              label={mic.enabled ? 'Mute' : 'Unmute'}
              active={mic.enabled}
              variant={mic.enabled ? (isSpeaking ? 'speaking' : 'on') : 'danger'}
              onClick={() => mic.toggle()}
              icon={
                mic.enabled ? (
                  <Mic className="h-[18px] w-[18px]" />
                ) : (
                  <MicOff className="h-[18px] w-[18px]" />
                )
              }
            />
            <DockBtn
              label={cam.enabled ? 'Cam off' : 'Cam on'}
              active={cam.enabled}
              variant={cam.enabled ? 'on' : 'danger'}
              onClick={() => cam.toggle()}
              icon={
                cam.enabled ? (
                  <Cam className="h-[18px] w-[18px]" />
                ) : (
                  <VideoOff className="h-[18px] w-[18px]" />
                )
              }
            />
            <DockBtn
              label={screen.enabled ? 'Stop share' : 'Share'}
              active={screen.enabled}
              variant={screen.enabled ? 'accent' : 'on'}
              onClick={() => screen.toggle()}
              icon={
                screen.enabled ? (
                  <MonitorOff className="h-[18px] w-[18px]" />
                ) : (
                  <Monitor className="h-[18px] w-[18px]" />
                )
              }
            />
            {onMuteAll && (
              <DockBtn
                label="Mute all"
                variant="on"
                onClick={onMuteAll}
                icon={<MuteAllIcon className="h-[18px] w-[18px]" />}
              />
            )}
            {(onStartRecording || onStopRecording) && (
              <DockBtn
                label={
                  recordingState === 'recording' || recordingState === 'stopping'
                    ? 'Stop rec'
                    : recordingState === 'starting'
                      ? 'Starting…'
                      : 'Record'
                }
                active={recordingState === 'recording' || recordingState === 'starting'}
                variant={
                  recordingState === 'recording'
                    ? 'danger'
                    : recordingState === 'starting' || recordingState === 'stopping'
                      ? 'amber'
                      : 'on'
                }
                onClick={() => {
                  if (recordingState === 'starting' || recordingState === 'stopping') return;
                  if (recordingState === 'recording') onStopRecording?.();
                  else onStartRecording?.();
                }}
                icon={
                  recordingState === 'recording' || recordingState === 'stopping' ? (
                    <Square className="h-[16px] w-[16px]" />
                  ) : (
                    <Circle className="h-[16px] w-[16px]" />
                  )
                }
              />
            )}
            <span className="lc-divider" />
          </>
        )}

        <div ref={popRef} className="relative">
          <DockBtn
            label="React"
            active={reactionsOpen}
            variant={reactionsOpen ? 'accent' : 'on'}
            onClick={() => setReactionsOpen((v) => !v)}
            icon={<Smile className="h-[18px] w-[18px]" />}
          />
          {reactionsOpen && (
            <div className="lc-reactionspop">
              {REACTIONS.map((e, idx) => (
                <button
                  key={e}
                  onClick={() => launchReaction(e)}
                  className="lc-emoji"
                  style={{ animationDelay: `${idx * 18}ms` }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isHost && (
          <DockBtn
            label={handRaised ? 'Lower' : 'Raise'}
            active={handRaised}
            variant={handRaised ? 'amber' : 'on'}
            onClick={toggleHand}
            icon={<Hand className="h-[18px] w-[18px]" />}
          />
        )}

        <span className="lc-divider" />

        <button onClick={onLeave} className="lc-leavebtn">
          <LogOut className="h-[16px] w-[16px]" />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}

function DockBtn({
  icon,
  label,
  active,
  variant = 'on',
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  variant?: 'on' | 'speaking' | 'danger' | 'accent' | 'amber';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`lc-dockbtn lc-dockbtn--${variant}${active ? ' is-active' : ''}`}
      aria-pressed={active}
    >
      <span className="lc-dockbtn-glyph">{icon}</span>
      <span className="lc-dockbtn-label">{label}</span>
    </button>
  );
}
