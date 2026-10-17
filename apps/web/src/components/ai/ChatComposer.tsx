'use client';

import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  placeholder: string;
  /** Larger padding / rounded shell for the dedicated page. */
  size?: 'sm' | 'lg';
  autoFocus?: boolean;
}

/** The message composer (textarea + send/stop), shared by the widget and page. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder,
  size = 'sm',
  autoFocus,
}: ChatComposerProps) {
  const lg = size === 'lg';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      // A single rounded shell carries the ONLY border (and a subtle focus
      // accent). The textarea inside is borderless so we never stack a textarea
      // border + shell border + ring into a "double box".
      className={cn(
        'flex items-end gap-2 rounded-2xl border border-input bg-background shadow-soft transition-colors focus-within:border-primary/60',
        lg ? 'p-2' : 'p-1.5'
      )}
    >
      <textarea
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-60"
      />
      {isStreaming ? (
        <Button
          type="button"
          size={lg ? 'icon-lg' : 'icon'}
          variant="secondary"
          onClick={onStop}
          aria-label="Stop"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size={lg ? 'icon-lg' : 'icon'}
          disabled={!value.trim() || disabled}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
