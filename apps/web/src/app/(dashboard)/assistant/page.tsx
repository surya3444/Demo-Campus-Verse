'use client';

import { useEffect, useRef } from 'react';
import { Bot, RotateCcw, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import { ChatThread } from '@/components/ai/ChatThread';
import { ChatComposer } from '@/components/ai/ChatComposer';
import { ConversationSidebar } from '@/components/ai/ConversationSidebar';
import { AI_TOOL_PERMISSIONS, SUGGESTION_GROUPS } from '@/components/ai/assistant.constants';
import { aiApi } from '@/lib/api';
import { toast } from 'sonner';

export default function AssistantPage() {
  const { hasAnyPermission } = usePermissions();
  const canUse = hasAnyPermission(AI_TOOL_PERMISSIONS);

  const {
    messages,
    isStreaming,
    activeTool,
    cancelAction,
    completeAction,
    conversationId,
    historyVersion,
    newChat,
    loadConversation,
    input,
    setInput,
    send,
    stop,
    confirmAction,
    submitForm,
    pendingAction,
    inputDisabled,
  } = useAssistantChat();

  const openConversation = async (id: string) => {
    if (id === conversationId) return;
    try {
      const convo = await aiApi.getConversation(id);
      loadConversation(id, convo.messages ?? []);
    } catch {
      toast.error('Could not open that conversation');
    }
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeTool]);

  if (!canUse) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold">Assistant unavailable</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You don&apos;t have access to any data the assistant can work with yet. Ask an
          administrator to grant the relevant permissions.
        </p>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full">
      <ConversationSidebar
        activeId={conversationId}
        refreshKey={historyVersion}
        onNew={newChat}
        onOpen={openConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--brand-cyan))] text-white shadow-soft">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight">CampusVerse Assistant</h1>
              <p className="text-xs text-muted-foreground">
                Chat with your branch data — ask questions or take actions
              </p>
            </div>
          </div>
          {!isEmpty && (
            <Button variant="outline" size="sm" onClick={newChat} disabled={inputDisabled}>
              <RotateCcw className="h-4 w-4" />
              New chat
            </Button>
          )}
        </header>

        {/* Conversation / hero */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="pattern-dots flex min-h-full flex-col items-center justify-center gap-8 px-5 py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--brand-cyan))] text-white shadow-soft-md">
                  <Bot className="h-8 w-8" />
                </span>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold tracking-tight">
                    How can I <span className="gradient-text">help</span> today?
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Ask about students, fees, attendance and admissions — or create and update
                    records right here in the chat.
                  </p>
                </div>
              </div>

              <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SUGGESTION_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div
                      key={group.label}
                      className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-soft backdrop-blur-sm"
                    >
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {group.prompts.map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => send(prompt)}
                            className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <span>{prompt}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-5 py-6">
              <ChatThread
                messages={messages}
                activeTool={activeTool}
                onSubmitForm={submitForm}
                onConfirm={confirmAction}
                onCancel={cancelAction}
                onComplete={(m, message, link) => completeAction(m.id, message, link)}
                centered
              />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border/60 bg-background/80 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-3xl">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={() => send(input)}
              onStop={stop}
              isStreaming={isStreaming}
              disabled={inputDisabled}
              size="lg"
              autoFocus
              placeholder={
                pendingAction ? 'Complete or cancel the action above…' : 'Message the assistant…'
              }
            />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              The assistant only sees your current branch and respects your permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
