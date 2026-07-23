"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1 rounded transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

export function NotesEditor({
  initialContent,
  onChange,
  onBlur,
}: {
  initialContent: string;
  onChange: (html: string) => void;
  onBlur: () => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "min-h-[110px] px-4 py-3 text-[11px] text-foreground/70 focus:outline-none " +
          "[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur,
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div>
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-black/10 dark:border-white/10">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3 w-3" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
