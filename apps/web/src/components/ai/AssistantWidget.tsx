'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bot, X, RotateCcw, Maximize2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import { ChatThread } from './ChatThread';
import { ChatComposer } from './ChatComposer';
import { SUGGESTIONS } from './assistant.constants';

export function AssistantWidget() {
  const { canUseAssistant: canUse } = usePermissions();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    isStreaming,
    activeTool,
    reset,
    cancelAction,
    completeAction,
    input,
    setInput,
    send,
    stop,
    confirmAction,
    submitForm,
    pendingAction,
    inputDisabled,
  } = useAssistantChat();

  // Keep the latest turn in view as it streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeTool]);

  // The dedicated /assistant page is the full experience — don't double up.
  if (!canUse || pathname === '/assistant') return null;

  const isEmpty = messages.length === 0;

  const handleClose = () => {
    stop();
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating launcher */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon-lg"
          aria-label="Open AI assistant"
          className="fixed bottom-6 right-6 z-40 rounded-full shadow-soft-md"
        >
          <Bot className="h-5 w-5" />
        </Button>
      )}

      <Sheet open={isOpen} onOpenChange={(o) => (o ? setIsOpen(true) : handleClose())}>
        <SheetContent
          side="right"
          hideCloseButton
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">CampusVerse Assistant</p>
                <p className="text-xs text-muted-foreground">Ask about your branch data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" asChild aria-label="Open full screen">
                <Link href="/assistant" onClick={handleClose}>
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </Button>
              {!isEmpty && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={reset}
                  disabled={inputDisabled}
                  aria-label="Clear conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col gap-3 px-4 py-4">
              {isEmpty ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">How can I help?</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ask about students, fees, attendance, admissions and more.
                    </p>
                  </div>
                  <div className="flex w-full max-w-sm flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ChatThread
                  messages={messages}
                  activeTool={activeTool}
                  onSubmitForm={submitForm}
                  onConfirm={confirmAction}
                  onCancel={cancelAction}
                  onComplete={(m, message, link) => completeAction(m.id, message, link)}
                  onNavigate={handleClose}
                />
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={() => send(input)}
              onStop={stop}
              isStreaming={isStreaming}
              disabled={inputDisabled}
              placeholder={
                pendingAction ? 'Complete or cancel the action above…' : 'Ask a question…'
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
