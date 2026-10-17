'use client';

import { useRef, useState } from 'react';
import { useChatStore, type ChatMessage } from '@/store/chatStore';
import { streamChat, executeAction, type ChatTurn } from '@/lib/chatApi';

/**
 * Encapsulates all assistant chat behaviour (streaming, write-action
 * confirmation, abort) so the floating widget and the dedicated page share one
 * implementation over the same Zustand store — open the widget, expand to the
 * page, and the conversation continues seamlessly.
 */
export function useAssistantChat() {
  const store = useChatStore();
  const [input, setInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // A confirmation/form is open (or executing) — block new turns until it resolves.
  const pendingAction = store.messages.find(
    (m) => m.actionState === 'pending' || m.actionState === 'running'
  );
  const inputDisabled = store.isStreaming || !!pendingAction;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || inputDisabled) return;

    const history: ChatTurn[] = store.messages
      .filter((m) => !m.streaming && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    const payload: ChatTurn[] = [...history, { role: 'user', content: trimmed }];

    setInput('');
    const assistantId = store.startTurn(trimmed);
    const controller = new AbortController();
    abortRef.current = controller;

    void streamChat(
      payload,
      {
        onDelta: (t) => store.appendDelta(assistantId, t),
        onTool: (name) => store.setActiveTool(name),
        onConfirm: (action) => store.attachAction(assistantId, action),
        onForm: (form) => store.attachForm(assistantId, form),
        onError: (msg) => store.failTurn(assistantId, msg),
        onDone: () => store.finishTurn(assistantId),
      },
      controller.signal
    ).finally(() => store.finishTurn(assistantId));
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const confirmAction = async (m: ChatMessage) => {
    if (!m.action) return;
    store.setActionRunning(m.id);
    try {
      const res = await executeAction(m.action);
      store.completeAction(m.id, res.message, res.link);
    } catch (e) {
      store.failAction(m.id, e instanceof Error ? e.message : 'The action could not be completed.');
    }
  };

  const submitForm = async (m: ChatMessage, args: Record<string, unknown>) => {
    if (!m.form) return;
    store.setActionRunning(m.id);
    try {
      const res = await executeAction({ tool: m.form.tool, args });
      store.completeAction(m.id, res.message, res.link);
    } catch (e) {
      store.failAction(m.id, e instanceof Error ? e.message : 'The action could not be completed.');
    }
  };

  return {
    messages: store.messages,
    isStreaming: store.isStreaming,
    activeTool: store.activeTool,
    reset: store.reset,
    cancelAction: store.cancelAction,
    completeAction: store.completeAction,
    conversationId: store.conversationId,
    historyVersion: store.historyVersion,
    newChat: store.newChat,
    loadConversation: store.loadConversation,
    input,
    setInput,
    send,
    stop,
    confirmAction,
    submitForm,
    pendingAction,
    inputDisabled,
  };
}
