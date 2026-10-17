'use client';

import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  content: string;
  /** Called when an in-app link is followed (used to close the chat panel). */
  onNavigate?: () => void;
}

/**
 * Renders assistant markdown. Links the assistant produces from tool results are
 * in-app paths (e.g. "/students"); those route via Next without a full reload
 * and close the panel. Anything else opens in a new tab.
 */
export function MarkdownMessage({ content, onNavigate }: MarkdownMessageProps) {
  const router = useRouter();

  return (
    <div className="text-sm leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="marker:text-muted-foreground">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-2 py-1 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border/50 px-2 py-1">{children}</td>,
          a: ({ href, children }) => {
            const target = href ?? '';
            const isInternal = target.startsWith('/');
            return (
              <a
                href={target}
                {...(isInternal
                  ? {
                      onClick: (e) => {
                        e.preventDefault();
                        onNavigate?.();
                        router.push(target);
                      },
                    }
                  : { target: '_blank', rel: 'noreferrer' })}
                className={cn(
                  'font-medium text-primary underline-offset-2 hover:underline',
                  isInternal && 'cursor-pointer'
                )}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
