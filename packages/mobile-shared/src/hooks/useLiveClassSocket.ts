import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { secureStorage } from '../services/secureStorage';
import type { LiveClassRole } from '../api/liveClass';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '') ||
  'http://localhost:3001';

export interface ChatMessage {
  _id: string;
  senderUserId: string;
  senderName: string;
  senderRole: LiveClassRole;
  text: string;
  createdAt: string | Date;
}

export interface CurrentPoll {
  pollId: string;
  question: string;
  options: { text: string }[];
  type: 'single' | 'multi';
  launchedAt: string | Date;
  closesAt: string | Date;
}

export interface PollResults {
  pollId: string;
  results: { text: string; isCorrect: boolean; count: number }[];
  totalResponses: number;
}

export interface RaisedHand {
  userId: string;
  displayName?: string;
  raisedAt: number;
}

export interface ReactionBurst {
  emoji: string;
  userId: string;
  displayName?: string;
  at: number;
  key: string;
}

export interface LiveClassSocketState {
  connected: boolean;
  joined: boolean;
  role: LiveClassRole | null;
  messages: ChatMessage[];
  reactions: ReactionBurst[];
  raisedHands: Record<string, RaisedHand>;
  participants: Record<string, { userId: string; displayName?: string; role: LiveClassRole }>;
  currentPoll: CurrentPoll | null;
  lastResults: PollResults | null;
  error: string | null;
}

type RecordingState = 'off' | 'starting' | 'recording' | 'stopping';
type RecordingStateListener = (state: RecordingState) => void;
type KickedListener = (reason?: { kickedByStaffId?: string }) => void;

export function useLiveClassSocket(liveClassId: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const recordingListenersRef = useRef<Set<RecordingStateListener>>(new Set());
  const kickListenersRef = useRef<Set<KickedListener>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const [state, setState] = useState<LiveClassSocketState>({
    connected: false,
    joined: false,
    role: null,
    messages: [],
    reactions: [],
    raisedHands: {},
    participants: {},
    currentPoll: null,
    lastResults: null,
    error: null,
  });

  useEffect(() => {
    if (!liveClassId) return;
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const token = await secureStorage.getAccessToken();
      if (!token || cancelled) return;
      // Cache the current userId so the kicked-self check below can fire
      // without re-reading secure storage on every event.
      try {
        const u = await secureStorage.getUserData<{ id?: string; _id?: string }>();
        userIdRef.current = u?.id ?? u?._id ?? null;
      } catch {
        userIdRef.current = null;
      }

      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setState((s) => ({ ...s, connected: true, error: null }));
        socket!.emit(
          'class:join',
          { liveClassId },
          (resp: {
            ok: boolean;
            role?: LiveClassRole;
            recentMessages?: ChatMessage[];
            error?: string;
          }) => {
            if (resp?.ok) {
              setState((s) => ({
                ...s,
                joined: true,
                role: resp.role ?? null,
                messages: resp.recentMessages ?? [],
              }));
            } else {
              setState((s) => ({ ...s, error: resp?.error || 'JOIN_FAILED' }));
            }
          }
        );
      });

      socket.on('disconnect', () => {
        setState((s) => ({ ...s, connected: false, joined: false }));
      });

      socket.on('connect_error', (err: Error) => {
        setState((s) => ({ ...s, error: err.message }));
      });

      socket.on('chat:new', (msg: ChatMessage) => {
        setState((s) => ({ ...s, messages: [...s.messages, msg] }));
      });

      socket.on('chat:deleted', ({ _id }: { _id: string }) => {
        setState((s) => ({ ...s, messages: s.messages.filter((m) => m._id !== _id) }));
      });

      socket.on(
        'reaction:burst',
        (r: { emoji: string; userId: string; displayName?: string; at: number }) => {
          const key = `${r.userId}-${r.at}-${Math.random()}`;
          setState((s) => ({ ...s, reactions: [...s.reactions.slice(-19), { ...r, key }] }));
          setTimeout(() => {
            setState((s) => ({ ...s, reactions: s.reactions.filter((x) => x.key !== key) }));
          }, 2500);
        }
      );

      socket.on(
        'hand:state',
        (h: { userId: string; displayName?: string; raised: boolean; at: number }) => {
          setState((s) => {
            const next = { ...s.raisedHands };
            if (h.raised)
              next[h.userId] = { userId: h.userId, displayName: h.displayName, raisedAt: h.at };
            else delete next[h.userId];
            return { ...s, raisedHands: next };
          });
        }
      );

      socket.on(
        'presence:joined',
        (p: { userId: string; displayName?: string; role: LiveClassRole }) => {
          setState((s) => ({ ...s, participants: { ...s.participants, [p.userId]: p } }));
        }
      );

      socket.on('presence:left', (p: { userId: string }) => {
        setState((s) => {
          const next = { ...s.participants };
          delete next[p.userId];
          return { ...s, participants: next };
        });
      });

      socket.on('poll:current', (p: CurrentPoll) => {
        setState((s) => ({ ...s, currentPoll: p, lastResults: null }));
      });

      socket.on('poll:close', (r: PollResults) => {
        setState((s) => ({ ...s, currentPoll: null, lastResults: r }));
      });

      socket.on(
        'recording:state',
        (e: { state: 'starting' | 'stopping' | 'off' | 'recording'; egressId?: string }) => {
          const next: RecordingState =
            e.state === 'starting' ? 'recording' : e.state === 'stopping' ? 'off' : e.state;
          recordingListenersRef.current.forEach((cb) => cb(next));
        }
      );

      socket.on(
        'presence:kicked',
        (e: { userId: string; identity?: string; kickedByStaffId?: string }) => {
          if (userIdRef.current && e.userId === userIdRef.current) {
            kickListenersRef.current.forEach((cb) => cb({ kickedByStaffId: e.kickedByStaffId }));
          }
          setState((s) => {
            const next = { ...s.participants };
            delete next[e.userId];
            return { ...s, participants: next };
          });
        }
      );
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit('class:leave');
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [liveClassId]);

  const sendChat = useCallback((text: string) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      socketRef.current?.emit('chat:send', { text }, resolve);
    });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit('reaction:send', { emoji });
  }, []);

  const raiseHand = useCallback(() => {
    socketRef.current?.emit('hand:raise');
  }, []);

  const lowerHand = useCallback(() => {
    socketRef.current?.emit('hand:lower');
  }, []);

  const launchPoll = useCallback(
    (data: {
      question: string;
      options: { text: string; isCorrect?: boolean }[];
      type?: 'single' | 'multi';
      durationSec?: number;
    }) => {
      return new Promise<{ ok: boolean; pollId?: string; error?: string }>((resolve) => {
        socketRef.current?.emit('poll:launch', data, resolve);
      });
    },
    []
  );

  const respondPoll = useCallback((pollId: string, selectedIndices: number[]) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      socketRef.current?.emit('poll:respond', { pollId, selectedIndices }, resolve);
    });
  }, []);

  const closePoll = useCallback((pollId: string) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      socketRef.current?.emit('poll:close', { pollId }, resolve);
    });
  }, []);

  const onRecordingState = useCallback((cb: RecordingStateListener) => {
    recordingListenersRef.current.add(cb);
    return () => {
      recordingListenersRef.current.delete(cb);
    };
  }, []);

  const onKicked = useCallback((cb: KickedListener) => {
    kickListenersRef.current.add(cb);
    return () => {
      kickListenersRef.current.delete(cb);
    };
  }, []);

  return {
    ...state,
    sendChat,
    sendReaction,
    raiseHand,
    lowerHand,
    launchPoll,
    respondPoll,
    closePoll,
    onRecordingState,
    onKicked,
  };
}
