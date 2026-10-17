'use client';

import { useCallback, useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  className?: string;
  /** Shows the drag-handle side menu. The "/" slash command menu is always on. */
  sideMenu?: boolean;
  /** Wrap the editor in a bordered card. Set false for a seamless, Medium-like surface. */
  bordered?: boolean;
}

/**
 * BlockNote-based rich text editor — type "/" for the block menu (headings,
 * lists, quotes, code, etc.). Serializes to / parses from HTML so content can
 * be stored as a plain HTML string and re-rendered with dangerouslySetInnerHTML.
 */
export function RichTextEditor({
  content,
  onChange,
  className,
  sideMenu = true,
  bordered = true,
}: RichTextEditorProps) {
  const editor = useCreateBlockNote({
    domAttributes: { editor: { class: 'blocknote-editor' } },
  });

  // Load initial HTML into the editor once, on mount.
  useEffect(() => {
    if (editor && content) {
      (async () => {
        const blocks = await editor.tryParseHTMLToBlocks(content);
        editor.replaceBlocks(editor.document, blocks);
      })();
    }
    // Intentionally runs only when the editor instance is created.
  }, [editor]);

  const handleChange = useCallback(async () => {
    if (!editor) return;
    const html = await editor.blocksToHTMLLossy(editor.document);
    onChange(html);
  }, [editor, onChange]);

  if (!editor) return null;

  return (
    <div className={className}>
      <div
        className={
          bordered
            ? 'rounded-xl border border-input bg-background overflow-hidden [&_.bn-editor]:min-h-[360px] [&_.bn-container]:border-none [&_.bn-container]:shadow-none'
            : 'bn-seamless [&_.bn-editor]:min-h-[420px] [&_.bn-container]:border-none [&_.bn-container]:shadow-none'
        }
      >
        <BlockNoteView editor={editor} onChange={handleChange} theme="light" sideMenu={sideMenu} />
      </div>

      <style jsx global>{`
        .bn-editor {
          padding: 16px 20px;
          font-size: 15px;
        }
        .bn-container {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .bn-side-menu {
          z-index: 50;
        }
        /* Seamless (Medium-like) surface: larger type, transparent background. */
        .bn-seamless {
          --bn-colors-editor-background: transparent;
        }
        .bn-seamless .bn-editor {
          padding: 0;
          background: transparent;
          font-size: 18px;
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
}
