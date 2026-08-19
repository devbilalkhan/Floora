"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, List } from "lucide-react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        "p-1 rounded transition-colors",
        active ? "bg-violet-100 text-violet-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  );
}

export function QuoteScopeEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "• Supply and install flooring throughout the project…" }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "px-2 py-1.5 text-[11px] leading-relaxed text-gray-800/80 focus:outline-none min-h-[6rem] " +
          "[&_ul]:pl-4 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_li]:leading-relaxed [&_p]:mb-1 " +
          "[&_.is-editor-empty:first-child::before]:text-gray-300 [&_.is-editor-empty:first-child::before]:float-left " +
          "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:pointer-events-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "border border-gray-200 rounded overflow-hidden focus-within:ring-1 focus-within:ring-violet-200 transition-colors",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-50 border-b border-gray-200 print:hidden">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List className="h-3 w-3" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
