import { create } from 'zustand';
import type { PendingAction, PendingForm } from '@/lib/chatApi';
import { aiApi } from '@/lib/api';

export type ActionState = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** True while the assistant message is still streaming. */
  streaming?: boolean;
  /** Set when this assistant turn failed. */
  error?: boolean;
  /** A proposed write action (read-only confirm card) awaiting confirmation. */
  action?: PendingAction;
  /** A proposed write action rendered as an editable inline form. */
  form?: PendingForm;
  actionState?: ActionState;
  actionError?: string;
}

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  isStreaming: boolean;
  /** Name of the data tool currently running (for the "looking up…" hint). */
  activeTool: string | null;
  /** Server id of the persisted conversation (null until first save). */
  conversationId: string | null;
  /** Bumped after each successful persist so history lists can refetch. */
  historyVersion: number;

  open: () => void;
  close: () => void;
  toggle: () => void;

  /** Start a brand-new conversation (clears messages + server id). */
  newChat: () => void;
  /** Load a stored conversation into the thread. */
  loadConversation: (
    id: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => void;

  /** Push a user turn + an empty assistant turn; returns the assistant id. */
  startTurn: (content: string) => string;
  appendDelta: (id: string, text: string) => void;
  setActiveTool: (name: string | null) => void;
  finishTurn: (id: string) => void;
  failTurn: (id: string, message: string) => void;

  /** A write action was proposed for the given assistant message. */
  attachAction: (id: string, action: PendingAction) => void;
  /** An editable write form was proposed for the given assistant message. */
  attachForm: (id: string, form: PendingForm) => void;
  setActionRunning: (id: string) => void;
  completeAction: (id: string, message?: string, link?: string) => void;
  failAction: (id: string, message: string) => void;
  cancelAction: (id: string) => void;

  reset: () => void;
}

let idCounter = 0;
const nextId = () => `m${Date.now()}-${idCounter++}`;

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  messages: [],
  isStreaming: false,
  activeTool: null,
  conversationId: null,
  historyVersion: 0,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  newChat: () => set({ messages: [], isStreaming: false, activeTool: null, conversationId: null }),

  loadConversation: (id, messages) =>
    set({
      conversationId: id,
      isStreaming: false,
      activeTool: null,
      messages: messages.map((m) => ({ id: nextId(), role: m.role, content: m.content })),
    }),

  startTurn: (content) => {
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content };
    const assistantId = nextId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
      activeTool: null,
    }));
    return assistantId;
  },

  appendDelta: (id, text) =>
    set((s) => ({
      activeTool: null,
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
    })),

  setActiveTool: (name) => set({ activeTool: name }),

  finishTurn: (id) => {
    set((s) => ({
      isStreaming: false,
      activeTool: null,
      messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
    }));
    schedulePersist();
  },

  failTurn: (id, message) =>
    set((s) => ({
      isStreaming: false,
      activeTool: null,
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false, error: true, content: m.content || message } : m
      ),
    })),

  attachAction: (id, action) =>
    set((s) => ({
      isStreaming: false,
      activeTool: null,
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false, action, actionState: 'pending' } : m
      ),
    })),

  attachForm: (id, form) =>
    set((s) => ({
      isStreaming: false,
      activeTool: null,
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false, form, actionState: 'pending' } : m
      ),
    })),

  setActionRunning: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, actionState: 'running' } : m)),
    })),

  // On success, fold the result (and any link) into the message content so it
  // becomes part of the history sent to the model on the next turn.
  completeAction: (id, message, link) => {
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== id) return m;
        const line = message ?? 'Done.';
        const withLink = link ? `${line} [View →](${link})` : line;
        const content = m.content ? `${m.content}\n\n${withLink}` : withLink;
        return { ...m, actionState: 'done', content };
      }),
    }));
    schedulePersist();
  },

  failAction: (id, message) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, actionState: 'error', actionError: message } : m
      ),
    })),

  cancelAction: (id) => {
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== id) return m;
        const content = m.content ? `${m.content}\n\n_Action cancelled._` : '_Action cancelled._';
        return { ...m, actionState: 'cancelled', content };
      }),
    }));
    schedulePersist();
  },

  reset: () => set({ messages: [], isStreaming: false, activeTool: null, conversationId: null }),
}));

// ---------------------------------------------------------------------------
// Persistence — best-effort, debounced. Lives at module scope (the store is a
// singleton) so it runs ONCE per turn regardless of how many components (widget
// + page) are mounted. Never disrupts the chat if a save fails.
// ---------------------------------------------------------------------------
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistNow();
  }, 900);
}

async function persistNow(): Promise<void> {
  const s = useChatStore.getState();
  const msgs = s.messages
    .filter(
      (m) => !m.streaming && m.content.trim().length > 0 && !(m.role === 'assistant' && m.error)
    )
    .map((m) => ({ role: m.role, content: m.content }));
  if (msgs.length === 0) return;
  try {
    if (s.conversationId) {
      await aiApi.saveConversation(s.conversationId, msgs);
    } else {
      const { _id } = await aiApi.createConversation(msgs);
      useChatStore.setState({ conversationId: _id });
    }
    useChatStore.setState((st) => ({ historyVersion: st.historyVersion + 1 }));
  } catch {
    /* history is best-effort — never block or surface to the user */
  }
}
