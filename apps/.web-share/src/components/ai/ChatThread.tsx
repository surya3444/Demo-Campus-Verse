'use client';

import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/store/chatStore';
import { MarkdownMessage } from './MarkdownMessage';
import { AssistantActionForm } from './AssistantActionForm';
import { TOOL_LABELS } from './assistant.constants';
import { LeadForm } from '@/app/(dashboard)/admissions/components/LeadForm';

interface ChatThreadProps {
  messages: ChatMessage[];
  activeTool: string | null;
  onSubmitForm: (m: ChatMessage, args: Record<string, unknown>) => void;
  onConfirm: (m: ChatMessage) => void;
  onCancel: (id: string) => void;
  /** Fold a completed action's result into the conversation. */
  onComplete: (m: ChatMessage, message: string, link?: string) => void;
  /** Called when an in-app link in a message is followed (widget closes itself). */
  onNavigate?: () => void;
  /** Constrain bubbles to a readable centered column (expanded widget / page). */
  centered?: boolean;
}

/** Coerce an SSE-provided prefill value to a string (or undefined). */
function asStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

/**
 * Renders the assistant conversation: user/assistant bubbles, inline write-action
 * forms, the legacy confirm card, and the streaming/tool loaders. Shared by the
 * floating widget and the dedicated assistant page.
 */
export function ChatThread({
  messages,
  activeTool,
  onSubmitForm,
  onConfirm,
  onCancel,
  onComplete,
  onNavigate,
  centered,
}: ChatThreadProps) {
  const toolHint = activeTool ? (TOOL_LABELS[activeTool] ?? 'your data') : null;
  const bubble = centered ? 'max-w-[88%] sm:max-w-[75%]' : 'max-w-[85%]';

  return (
    <div className={cn('flex flex-col gap-4', centered && 'mx-auto w-full max-w-3xl')}>
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <div key={m.id} className="flex justify-end">
              <div
                className={cn(
                  'rounded-2xl bg-primary px-3.5 py-2.5 text-primary-foreground shadow-soft',
                  bubble
                )}
              >
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              </div>
            </div>
          );
        }

        const form = m.form;
        const action = m.action;
        const st = m.actionState;

        // Assistant turn. Text sits in a chat bubble; a proposed write renders as
        // its OWN full-width card (no nested bubble) so the form has real room.
        return (
          <div key={m.id} className="flex w-full min-w-0 flex-col gap-2">
            {m.content && (
              <div
                className={cn(
                  'w-fit rounded-2xl bg-muted px-3.5 py-2.5 text-foreground',
                  bubble,
                  m.error && 'border border-destructive/40'
                )}
              >
                <MarkdownMessage content={m.content} onNavigate={onNavigate} />
              </div>
            )}

            {/* Editable inline form for a proposed write (or retry on error).
                create_lead renders the SAME LeadForm as the dedicated dialog so
                behaviour (dynamic sources/classes, agent picker, parent fields,
                custom fields, validation) is identical. */}
            {form && (st === 'pending' || st === 'running' || st === 'error') && (
              <div className="w-full max-w-xl">
                {form.tool === 'create_lead' ? (
                  <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                    <p className="mb-3 text-sm font-medium">{form.title}</p>
                    <LeadForm
                      initialValues={{
                        firstName: asStr(form.values.firstName),
                        lastName: asStr(form.values.lastName),
                        phone: asStr(form.values.phone),
                        email: asStr(form.values.email),
                        notes: asStr(form.values.notes),
                        className: asStr(form.values.className),
                      }}
                      submitLabel="Create lead"
                      onSuccess={(r) =>
                        onComplete(
                          m,
                          `Created lead${r.leadNumber ? ` ${r.leadNumber}` : ''} for ${r.displayName}.`,
                          '/admissions/leads'
                        )
                      }
                      onCancel={() => onCancel(m.id)}
                    />
                  </div>
                ) : (
                  <AssistantActionForm
                    form={form}
                    state={st}
                    error={m.actionError}
                    onSubmit={(args) => onSubmitForm(m, args)}
                    onCancel={() => onCancel(m.id)}
                  />
                )}
              </div>
            )}

            {/* Read-only confirm card (tools without a form spec) */}
            {action && (st === 'pending' || st === 'error') && (
              <div className="w-full max-w-xl rounded-lg border border-border bg-card p-3 shadow-soft">
                {st === 'error' && m.actionError && (
                  <p className="mb-2 text-xs text-destructive">{m.actionError}</p>
                )}
                <p className="mb-2 text-sm font-medium">{action.title}</p>
                <dl className="mb-3 space-y-1">
                  {action.fields.map((f) => (
                    <div key={f.label} className="flex gap-2 text-xs">
                      <dt className="w-24 shrink-0 text-muted-foreground">{f.label}</dt>
                      <dd className="flex-1 break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onConfirm(m)}>
                    <Check className="h-4 w-4" />
                    {st === 'error' ? 'Retry' : 'Confirm'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onCancel(m.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {action && !form && st === 'running' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </p>
            )}

            {/* Loaders only when there's nothing else to show yet */}
            {!m.content && !m.action && !m.form && m.streaming && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {activeTool ? `Looking up ${toolHint}…` : 'Thinking…'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
