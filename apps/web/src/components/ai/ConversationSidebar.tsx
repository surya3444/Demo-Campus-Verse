'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { aiApi } from '@/lib/api';

interface ConversationSummary {
  _id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

interface ConversationSidebarProps {
  activeId: string | null;
  /** Bumped (historyVersion) after each persist so the list refetches. */
  refreshKey: number;
  onNew: () => void;
  onOpen: (id: string) => void;
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function ConversationSidebar({
  activeId,
  refreshKey,
  onNew,
  onOpen,
}: ConversationSidebarProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['ai-conversations', refreshKey],
    queryFn: () =>
      aiApi.listConversations({ limit: 50 }) as Promise<{ data: ConversationSummary[] }>,
  });

  const conversations = data?.data ?? [];

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await aiApi.deleteConversation(id);
      if (id === activeId) onNew();
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    } catch {
      /* non-fatal */
    }
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-background/60 md:flex">
      <div className="p-3">
        <Button onClick={onNew} className="w-full justify-start" variant="outline">
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            No chats yet. Start a conversation and it&apos;ll show up here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <li key={c._id}>
                <button
                  onClick={() => onOpen(c._id)}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    c._id === activeId
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground/70 group-hover:hidden">
                    {relativeTime(c.updatedAt)}
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Delete chat"
                    onClick={(e) => handleDelete(e, c._id)}
                    className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
