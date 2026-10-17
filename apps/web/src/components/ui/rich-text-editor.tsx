'use client';

import { useCallback, useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  sideMenu?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  className,
  sideMenu = true,
}: RichTextEditorProps) {
  const editor = useCreateBlockNote({
    domAttributes: {
      editor: {
        class: 'blocknote-editor',
      },
    },
  });

  // Load initial HTML content into the editor
  useEffect(() => {
    if (editor && content) {
      (async () => {
        const blocks = await editor.tryParseHTMLToBlocks(content);
        editor.replaceBlocks(editor.document, blocks);
      })();
    }
    // Only run on mount — not on every content change
  }, [editor]);

  const handleChange = useCallback(async () => {
    if (!editor) return;
    const html = await editor.blocksToHTMLLossy(editor.document);
    onChange(html);
  }, [editor, onChange]);

  if (!editor) return null;

  return (
    <div className={className}>
      <div className="rounded-lg border overflow-hidden [&_.bn-editor]:min-h-[250px] [&_.bn-container]:border-none [&_.bn-container]:shadow-none">
        <BlockNoteView editor={editor} onChange={handleChange} theme="light" sideMenu={sideMenu} />
      </div>

      <style jsx global>{`
        .bn-editor {
          padding: 12px 16px;
          font-size: 14px;
        }
        .bn-container {
          border: none !important;
          box-shadow: none !important;
        }
        .bn-side-menu {
          z-index: 50;
        }
      `}</style>
    </div>
  );
}
