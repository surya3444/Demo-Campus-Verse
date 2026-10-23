import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LiveKitRoom,
  AudioSession,
  VideoTrack,
  useTracks,
  registerGlobals,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { useLiveClassSocket } from '../../hooks/useLiveClassSocket';
import type { LiveClassJoinResponse } from '../../api/liveClass';
import { LiveClassChatPanel } from './LiveClassChatPanel';
import { LiveClassPollPanel } from './LiveClassPollPanel';
import { LiveClassReactionOverlay } from './LiveClassReactionOverlay';

// One-time WebRTC globals registration
let registered = false;
function ensureRegistered() {
  if (!registered) {
    try {
      registerGlobals();
    } catch {
      // ignore — already registered
    }
    registered = true;
  }
}

const REACTIONS = ['👍', '❤️', '🎉', '😂', '😮', '👏'];

export type RecordingState = 'off' | 'starting' | 'recording' | 'stopping';

export interface LiveClassRoomHostControls {
  recordingState?: RecordingState;
  onMuteAll?: () => void | Promise<void>;
  onStartRecording?: () => void | Promise<void>;
  onStopRecording?: () => void | Promise<void>;
}

export function LiveClassRoom({
  liveClassId,
  liveClassTitle,
  joinResponse,
  onLeave,
  onEnd,
  hostControls,
}: {
  liveClassId: string;
  liveClassTitle: string;
  joinResponse: LiveClassJoinResponse;
  onLeave: () => void;
  onEnd?: () => void;
  hostControls?: LiveClassRoomHostControls;
}) {
  ensureRegistered();
  const isHost = joinResponse.role === 'host' || joinResponse.role === 'cohost';

  useEffect(() => {
    const start = async () => {
      try {
        await AudioSession.startAudioSession();
      } catch {
        // noop
      }
    };
    start();
    return () => {
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  return (
    <LiveKitRoom
      serverUrl={joinResponse.livekitUrl}
      token={joinResponse.livekitToken}
      connect
      audio
      video={isHost}
      options={{ adaptiveStream: { pixelDensity: 'screen' } }}
    >
      <RoomContents
        liveClassId={liveClassId}
        title={liveClassTitle}
        isHost={isHost}
        onLeave={onLeave}
        onEnd={onEnd}
        hostControls={hostControls}
      />
    </LiveKitRoom>
  );
}

function RoomContents({
  liveClassId,
  title,
  isHost,
  onLeave,
  onEnd,
  hostControls,
}: {
  liveClassId: string;
  title: string;
  isHost: boolean;
  onLeave: () => void;
  onEnd?: () => void;
  hostControls?: LiveClassRoomHostControls;
}) {
  const socket = useLiveClassSocket(liveClassId);
  const [drawer, setDrawer] = useState<'chat' | 'polls' | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>(
    hostControls?.recordingState ?? 'off'
  );

  // Server-emitted recording transitions override the prop after mount.
  useEffect(() => {
    if (!socket.onRecordingState) return;
    const off = socket.onRecordingState((next) => setRecordingState(next));
    return off;
  }, [socket]);

  // The current user got kicked → bail out of the room.
  useEffect(() => {
    if (!socket.onKicked) return;
    const off = socket.onKicked(() => onLeave());
    return off;
  }, [socket, onLeave]);

  const toggleHand = () => {
    if (handRaised) {
      socket.lowerHand();
      setHandRaised(false);
    } else {
      socket.raiseHand();
      setHandRaised(true);
    }
  };

  const handsRaisedCount = Object.keys(socket.raisedHands).length;

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onLeave} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
            <Text style={s.subText}>
              {Object.keys(socket.participants).length + 1} participants
            </Text>
          </View>
        </View>
        {isHost && onEnd && (
          <TouchableOpacity onPress={onEnd} style={s.endBtn}>
            <Ionicons name="stop-circle" size={16} color="#fff" />
            <Text style={s.endBtnText}>End</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Video grid */}
      <View style={{ flex: 1 }}>
        <VideoGrid />
        <LiveClassReactionOverlay reactions={socket.reactions} />
        {handsRaisedCount > 0 && (
          <View style={s.handsBanner}>
            <Ionicons name="hand-left" size={14} color="#f59e0b" />
            <Text style={s.handsText}>
              {handsRaisedCount} hand{handsRaisedCount === 1 ? '' : 's'} raised
            </Text>
          </View>
        )}
      </View>

      {/* Host controls row (only when hostControls callbacks supplied). */}
      {isHost && hostControls && (hostControls.onMuteAll || hostControls.onStartRecording) && (
        <View style={s.hostRow}>
          {hostControls.onMuteAll && (
            <TouchableOpacity style={s.hostBtn} onPress={() => hostControls.onMuteAll?.()}>
              <Ionicons name="mic-off" size={16} color="#fff" />
              <Text style={s.hostBtnLabel}>Mute all</Text>
            </TouchableOpacity>
          )}
          {(hostControls.onStartRecording || hostControls.onStopRecording) && (
            <TouchableOpacity
              style={[
                s.hostBtn,
                recordingState === 'recording' && s.hostBtnRec,
                (recordingState === 'starting' || recordingState === 'stopping') &&
                  s.hostBtnPending,
              ]}
              disabled={recordingState === 'starting' || recordingState === 'stopping'}
              onPress={() => {
                if (recordingState === 'recording') hostControls.onStopRecording?.();
                else hostControls.onStartRecording?.();
              }}
            >
              <Ionicons
                name={recordingState === 'recording' ? 'stop-circle' : 'radio-button-on'}
                size={16}
                color={recordingState === 'recording' ? '#fca5a5' : '#fff'}
              />
              <Text
                style={[s.hostBtnLabel, recordingState === 'recording' && { color: '#fca5a5' }]}
              >
                {recordingState === 'recording'
                  ? 'Stop rec'
                  : recordingState === 'starting'
                    ? 'Starting…'
                    : recordingState === 'stopping'
                      ? 'Stopping…'
                      : 'Record'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bottom controls */}
      <View style={s.controls}>
        <View style={s.reactionsRow}>
          {REACTIONS.map((e) => (
            <TouchableOpacity key={e} style={s.reactionBtn} onPress={() => socket.sendReaction(e)}>
              <Text style={s.reactionText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.actionsRow}>
          {!isHost && (
            <TouchableOpacity
              style={[s.actionBtn, handRaised && s.actionBtnActive]}
              onPress={toggleHand}
            >
              <Ionicons
                name={handRaised ? 'hand-left' : 'hand-left-outline'}
                size={18}
                color={handRaised ? '#f59e0b' : '#fff'}
              />
              <Text style={s.actionLabel}>{handRaised ? 'Lower' : 'Raise'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.actionBtn} onPress={() => setDrawer('chat')}>
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={s.actionLabel}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => setDrawer('polls')}>
            <Ionicons name="bar-chart-outline" size={18} color="#fff" />
            <Text style={s.actionLabel}>Polls</Text>
            {socket.currentPoll && <View style={s.pollDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.leaveBtn]} onPress={onLeave}>
            <Ionicons name="exit-outline" size={18} color="#fff" />
            <Text style={s.actionLabel}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Drawer modal */}
      <Modal
        animationType="slide"
        transparent
        visible={drawer !== null}
        onRequestClose={() => setDrawer(null)}
      >
        <Pressable style={s.modalScrim} onPress={() => setDrawer(null)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{drawer === 'chat' ? 'Chat' : 'Polls'}</Text>
            <TouchableOpacity onPress={() => setDrawer(null)}>
              <Ionicons name="close" size={22} color="#526C98" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            {drawer === 'chat' && <LiveClassChatPanel socket={socket} />}
            {drawer === 'polls' && <LiveClassPollPanel socket={socket} isHost={isHost} />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  if (tracks.length === 0) {
    return (
      <View style={s.waiting}>
        <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.4)" />
        <Text style={s.waitingText}>Waiting for the host to share their video…</Text>
      </View>
    );
  }

  // Grid: up to 4 tiles visible
  const visible = tracks.slice(0, 4);

  return (
    <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
      {visible.map((t, i) => {
        const isPub = 'publication' in t && t.publication;
        return (
          <View key={`${t.participant.identity}-${i}`} style={s.tile}>
            {isPub ? (
              <VideoTrack trackRef={t} style={s.tileVideo} />
            ) : (
              <View style={[s.tileVideo, s.placeholderTile]}>
                <Ionicons name="person" size={42} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={s.tileLabel}>
              <Text style={s.tileLabelText} numberOfLines={1}>
                {t.participant.name || t.participant.identity}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02173B' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iconBtn: { padding: 4 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  subText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  endBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  waitingText: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 14,
    fontSize: 13,
    textAlign: 'center',
  },
  grid: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
  tile: { width: '50%', aspectRatio: 4 / 3, padding: 4, position: 'relative' },
  tileVideo: { flex: 1, borderRadius: 12, backgroundColor: '#1f1f1f', overflow: 'hidden' },
  placeholderTile: { alignItems: 'center', justifyContent: 'center' },
  tileLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tileLabelText: { color: '#fff', fontSize: 10 },
  handsBanner: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  handsText: { color: '#f59e0b', fontWeight: '700', fontSize: 11 },
  controls: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingTop: 8,
    paddingBottom: 24,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  reactionBtn: { padding: 8, borderRadius: 18 },
  reactionText: { fontSize: 26 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 64,
  },
  actionBtnActive: { backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 12 },
  actionLabel: { color: '#fff', fontSize: 10, marginTop: 2 },
  leaveBtn: { backgroundColor: 'rgba(220,38,38,0.18)', borderRadius: 12 },
  pollDot: {
    position: 'absolute',
    top: 4,
    right: 14,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dc2626',
  },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    height: '80%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D3DAE4',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DAE0E7',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#042A6C' },
  hostRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  hostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  hostBtnRec: {
    backgroundColor: 'rgba(220,38,38,0.18)',
    borderColor: 'rgba(220,38,38,0.35)',
  },
  hostBtnPending: {
    opacity: 0.6,
  },
  hostBtnLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
