"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
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

function Divider() {
  return <span className="mx-1 h-3.5 w-px bg-black/10 dark:bg-white/10" />;
}

/**
 * `compact` (default) — bold, italic and lists, small text (flooring costing notes).
 * `full` — adds headings, underline, strike, quote and undo/redo, with a larger writing area.
 */
export function NotesEditor({
  initialContent,
  onChange,
  onBlur,
  variant = "compact",
  placeholder,
}: {
  initialContent: string;
  onChange: (html: string) => void;
  onBlur: () => void;
  variant?: "compact" | "full";
  placeholder?: string;
}) {
  const full = variant === "full";
  const editor = useEditor({
    extensions: [StarterKit, ...(placeholder ? [Placeholder.configure({ placeholder })] : [])],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          (full
            ? "min-h-[220px] px-4 py-3 text-xs leading-relaxed text-foreground/70 focus:outline-none " +
              "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1 " +
              "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 " +
              "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
              "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] " +
              "[&_p.is-editor-empty:first-child]:before:text-muted-foreground/50 " +
              "[&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 " +
              "[&_p.is-editor-empty:first-child]:before:pointer-events-none "
            : "min-h-[110px] px-4 py-3 text-[11px] text-foreground/70 focus:outline-none ") +
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
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-black/10 dark:border-white/10">
        {full && (
          <>
            <ToolbarButton
              title="Heading"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="h-3 w-3" />
            </ToolbarButton>
            <ToolbarButton
              title="Subheading"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="h-3 w-3" />
            </ToolbarButton>
            <Divider />
          </>
        )}
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3 w-3" />
        </ToolbarButton>
        {full && (
          <>
            <ToolbarButton
              title="Underline"
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline className="h-3 w-3" />
            </ToolbarButton>
            <ToolbarButton
              title="Strikethrough"
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="h-3 w-3" />
            </ToolbarButton>
            <Divider />
          </>
        )}
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3 w-3" />
        </ToolbarButton>
        {full && (
          <>
            <ToolbarButton
              title="Quote"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-3 w-3" />
            </ToolbarButton>
            <Divider />
            <ToolbarButton title="Undo" active={false} onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 className="h-3 w-3" />
            </ToolbarButton>
            <ToolbarButton title="Redo" active={false} onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 className="h-3 w-3" />
            </ToolbarButton>
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
