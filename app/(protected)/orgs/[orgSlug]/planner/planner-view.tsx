"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTaskPanel } from "@/components/tasks/task-provider";
import { getTasksData, updateTask, deleteTask, createTask, updateProjectDates, addChecklistItem, toggleChecklistItem, deleteChecklistItem, pinTask, unpinTask } from "@/app/actions/tasks";
import { createClient } from "@/lib/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import type { Task, TaskPriority, TaskStatus, ChecklistItem } from "@/lib/task-types";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Search,
  X,
  Circle,
  Clock,
  CheckCircle2,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  Lock,
  Globe,
  Square,
  CheckSquare2,
  Pin,
} from "lucide-react";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  user_id: string;
  profile: { display_name: string | null; email: string | null } | null;
};

type DateFilter = "all" | "today" | "tomorrow" | "this_week" | "overdue";

// ── Constants ─────────────────────────────────────────────────────────────────

const P = {
  low:    { label: "Low",    dot: "bg-slate-400",  text: "text-slate-400",  bg: "bg-slate-400/10 border-slate-400/30",  border: "border-l-slate-400/60"  },
  medium: { label: "Med",    dot: "bg-blue-400",   text: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30",    border: "border-l-blue-400"      },
  high:   { label: "High",   dot: "bg-orange-400", text: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30",border: "border-l-orange-400"    },
  urgent: { label: "Urgent", dot: "bg-red-500",    text: "text-red-500",    bg: "bg-red-500/10 border-red-500/30",      border: "border-l-red-500"       },
} satisfies Record<TaskPriority, { label: string; dot: string; text: string; bg: string; border: string }>;

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4, high: 3, medium: 2, low: 1,
};

const PRIORITY_CYCLE: TaskPriority[] = ["low", "medium", "high", "urgent"];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type ProjectWithDates = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

const PROJECT_COLORS = [
  { bg: "bg-violet-500/20", text: "text-violet-400", border: "border-violet-500/30", hover: "hover:bg-violet-500/30" },
  { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", hover: "hover:bg-emerald-500/30" },
  { bg: "bg-sky-500/20",     text: "text-sky-400",     border: "border-sky-500/30",     hover: "hover:bg-sky-500/30"     },
  { bg: "bg-amber-500/20",   text: "text-amber-400",   border: "border-amber-500/30",   hover: "hover:bg-amber-500/30"   },
  { bg: "bg-pink-500/20",    text: "text-pink-400",    border: "border-pink-500/30",    hover: "hover:bg-pink-500/30"    },
] satisfies { bg: string; text: string; border: string; hover: string }[];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function getTomorrowStr() {
  const t = new Date(); t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function formatDue(ds: string): { label: string; overdue: boolean } {
  const date = new Date(ds + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  const overdue = diff < 0;
  const label =
    diff === 0  ? "Today"
    : diff === 1  ? "Tomorrow"
    : diff === -1 ? "Yesterday"
    : diff > 1 && diff <= 6
      ? date.toLocaleDateString("en-AU", { weekday: "short" })
      : date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return { label, overdue };
}

function renderTitle(title: string) {
  return title.replace(/@[\w-]+/g, "").replace(/\s+/g, " ").trim() || title;
}

function getCalCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function getTodayMs() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriorityBadge({
  priority,
  onChange,
  disabled = false,
}: {
  priority: TaskPriority;
  onChange: (p: TaskPriority) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : () => {
        const idx = PRIORITY_CYCLE.indexOf(priority);
        onChange(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
      }}
      title={disabled ? undefined : "Click to change priority"}
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
        disabled ? "pointer-events-none" : "transition-opacity hover:opacity-70",
        P[priority].text, P[priority].bg
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", P[priority].dot)} />
      {P[priority].label}
    </button>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  onToggle,
  onDelete,
  onPriority,
  onTitleChange,
  onDateChange,
  onShareToggle,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistDelete,
  onPinToggle,
  canWrite,
  isOwner,
  isOverlay = false,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onPriority: (p: TaskPriority) => void;
  onTitleChange: (title: string) => void;
  onDateChange: (date: string | null) => void;
  onShareToggle: (isPrivate: boolean) => void;
  onChecklistAdd: (text: string) => void;
  onChecklistToggle: (itemId: string, done: boolean) => void;
  onChecklistDelete: (itemId: string) => void;
  onPinToggle: () => void;
  canWrite: boolean;
  isOwner: boolean;
  isOverlay?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(task.title);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newItemVal, setNewItemVal] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);
  const done = task.status === "done";

  useEffect(() => {
    if (addingChecklist) newItemRef.current?.focus();
  }, [addingChecklist]);

  function startEdit() {
    if (isOverlay || !canWrite) return;
    setEditVal(task.title);
    setEditing(true);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  function commitEdit() {
    const t = editVal.trim();
    setEditing(false);
    if (!t) { setEditVal(task.title); return; }
    if (t !== task.title) onTitleChange(t);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      setAddingChecklist(true);
    }
    if (e.key === "Escape") { setEditing(false); setEditVal(task.title); }
  }

  function commitNewItem() {
    const t = newItemVal.trim();
    setNewItemVal("");
    if (t) onChecklistAdd(t);
    else setAddingChecklist(false);
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl bg-card/80 backdrop-blur-sm",
        "border border-white/[0.08] border-l-[3px] p-3 space-y-2",
        "hover:bg-card/90 transition-colors",
        P[task.priority as TaskPriority].border,
        done && "opacity-55"
      )}
    >
      {/* Title */}
      {editing ? (
        <textarea
          ref={editRef}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKey}
          rows={2}
          className="w-full resize-none text-[11px] bg-muted/40 rounded-md px-2 py-1 border border-white/[0.12] focus:outline-none focus:border-primary/50 transition-colors"
        />
      ) : (
        <p
          onClick={canWrite ? startEdit : undefined}
          title={canWrite ? "Click to edit" : undefined}
          className={cn(
            "text-[10px] leading-snug text-foreground/85 select-none pr-10",
            canWrite ? "cursor-text" : "cursor-default",
            done && "line-through text-muted-foreground"
          )}
        >
          {renderTitle(task.title)}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap">
        <PriorityBadge priority={task.priority as TaskPriority} onChange={onPriority} disabled={!canWrite} />
        {!isOverlay && (
          <DatePickerPopover value={task.due_date} onChange={canWrite ? onDateChange : () => {}} />
        )}
        {task.checklist_items.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {task.checklist_items.filter((i) => i.done).length}/{task.checklist_items.length}
          </span>
        )}
        {isOwner && (
          <button
            onClick={() => onShareToggle(!task.is_private)}
            title={task.is_private ? "Private — click to share" : "Shared — click to make private"}
            className="ml-auto rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            {task.is_private
              ? <Lock className="h-2.5 w-2.5" />
              : <Globe className="h-2.5 w-2.5 text-primary/60" />}
          </button>
        )}
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span key={tag} className="text-[9px] font-medium text-primary/90">
              @{tag}
            </span>
          ))}
        </div>
      )}

      {/* Checklist */}
      {!isOverlay && (task.checklist_items.length > 0 || addingChecklist) && (
        <div className="space-y-1 pt-0.5">
          {task.checklist_items
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <div key={item.id} className="group/item flex items-center gap-1.5">
                <button
                  onClick={() => onChecklistToggle(item.id, !item.done)}
                  className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.done
                    ? <CheckSquare2 className="h-3 w-3 text-success" />
                    : <Square className="h-3 w-3" />}
                </button>
                <span className={cn("flex-1 text-[10px] leading-snug", item.done && "line-through text-muted-foreground/50")}>
                  {item.text}
                </span>
                {canWrite && (
                  <button
                    onClick={() => onChecklistDelete(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 flex-shrink-0 text-muted-foreground/40 hover:text-destructive transition-all"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
          {addingChecklist && (
            <input
              ref={newItemRef}
              value={newItemVal}
              onChange={(e) => setNewItemVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitNewItem(); }
                if (e.key === "Escape") { setNewItemVal(""); setAddingChecklist(false); }
              }}
              onBlur={() => { if (!newItemVal.trim()) setAddingChecklist(false); }}
              placeholder="Add item…"
              className="w-full rounded px-1.5 py-0.5 text-[10px] bg-background border border-primary/50 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
            />
          )}
        </div>
      )}

      {/* Hover actions */}
      {!isOverlay && (
        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggle}
            title={done ? "Reopen" : task.status === "in_progress" ? "Mark done" : "Start"}
            className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
          >
            {done
              ? <Circle className="h-3 w-3" />
              : task.status === "in_progress"
                ? <CheckCircle2 className="h-3 w-3" />
                : <Clock className="h-3 w-3" />}
          </button>
          <button
            onClick={onPinToggle}
            title={task.is_pinned ? "Unpin" : "Pin to top"}
            className={cn(
              "rounded p-1 hover:bg-muted/50 transition-colors",
              task.is_pinned ? "text-primary opacity-80" : "text-muted-foreground hover:text-primary"
            )}
          >
            <Pin className={cn("h-2.5 w-2.5 rotate-45", task.is_pinned && "fill-current")} />
          </button>
          {canWrite && (
            <button
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DraggableKanbanCard(props: React.ComponentProps<typeof KanbanCard> & { onDateChange: (d: string | null) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `kanban-${props.task.id}`,
    data: { task: props.task, type: "kanban" },
    disabled: !props.canWrite,
  });
  if (!props.canWrite) return <KanbanCard {...props} />;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}
      className="cursor-grab active:cursor-grabbing"
    >
      <KanbanCard {...props} />
    </div>
  );
}

function KanbanColumn({
  status,
  title,
  tasks,
  headerAccent,
  headerIcon,
  onToggle,
  onDelete,
  onPriority,
  onTitleChange,
  onDateChange,
  onShareToggle,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistDelete,
  onPinToggle,
  canWrite,
  currentUserId,
}: {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  headerAccent: string;
  headerIcon: React.ReactNode;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onPriority: (t: Task, p: TaskPriority) => void;
  onTitleChange: (t: Task, title: string) => void;
  onDateChange: (t: Task, date: string | null) => void;
  onShareToggle: (t: Task, isPrivate: boolean) => void;
  onChecklistAdd: (t: Task, text: string) => void;
  onChecklistToggle: (t: Task, itemId: string, done: boolean) => void;
  onChecklistDelete: (t: Task, itemId: string) => void;
  onPinToggle: (t: Task) => void;
  canWrite: boolean;
  currentUserId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });

  return (
    <div className="flex flex-col flex-1 min-w-[260px] max-w-[360px]">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-t-xl",
        "border border-b-0 border-white/[0.08]",
        headerAccent
      )}>
        {headerIcon}
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] font-medium tabular-nums">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[320px] space-y-2 p-2 rounded-b-xl",
          "border border-white/[0.08] bg-card/40 backdrop-blur-xl transition-colors",
          isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30"
        )}
      >
        {tasks.map((t) => (
          <DraggableKanbanCard
            key={t.id}
            task={t}
            onToggle={() => onToggle(t)}
            onDelete={() => onDelete(t.id)}
            onPriority={(p) => onPriority(t, p)}
            onTitleChange={(title) => onTitleChange(t, title)}
            onDateChange={(date) => onDateChange(t, date)}
            onShareToggle={(isPrivate) => onShareToggle(t, isPrivate)}
            onChecklistAdd={(text) => onChecklistAdd(t, text)}
            onChecklistToggle={(itemId, done) => onChecklistToggle(t, itemId, done)}
            onChecklistDelete={(itemId) => onChecklistDelete(t, itemId)}
            onPinToggle={() => onPinToggle(t)}
            canWrite={canWrite}
            isOwner={t.created_by === currentUserId}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-10 text-[11px] text-muted-foreground/30 select-none">
            {isOver ? "Drop here" : "No tasks"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── List view card ────────────────────────────────────────────────────────────

function TaskListCard({
  task,
  onToggle,
  onDelete,
  onPriority,
  onTitleChange,
  onDateChange,
  onShareToggle,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistDelete,
  onPinToggle,
  canWrite,
  isOwner,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onPriority: (p: TaskPriority) => void;
  onTitleChange: (title: string) => void;
  onDateChange: (date: string | null) => void;
  onShareToggle: (isPrivate: boolean) => void;
  onChecklistAdd: (text: string) => void;
  onChecklistToggle: (itemId: string, done: boolean) => void;
  onChecklistDelete: (itemId: string) => void;
  onPinToggle: () => void;
  canWrite: boolean;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(task.title);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newItemVal, setNewItemVal] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);
  const done = task.status === "done";

  useEffect(() => {
    if (addingChecklist) newItemRef.current?.focus();
  }, [addingChecklist]);

  function startEdit() {
    if (!canWrite) return;
    setEditVal(task.title);
    setEditing(true);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  function commitEdit() {
    const trimmed = editVal.trim();
    setEditing(false);
    if (!trimmed) { setEditVal(task.title); return; }
    if (trimmed !== task.title) onTitleChange(trimmed);
  }

  function handleEditKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      setAddingChecklist(true);
    }
    if (e.key === "Escape") { setEditing(false); setEditVal(task.title); }
  }

  function commitNewItem() {
    const t = newItemVal.trim();
    setNewItemVal("");
    if (t) onChecklistAdd(t);
    else setAddingChecklist(false);
  }

  const statusIcon =
    done               ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
    : task.status === "in_progress" ? <Clock className="h-3.5 w-3.5 text-primary" />
    :                   <Circle className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <div className={cn("group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/25", done && "opacity-50")}>
      <button onClick={onToggle} title="Cycle status" className="mt-0.5 flex-shrink-0 hover:opacity-70 transition-opacity">
        {statusIcon}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        {editing ? (
          <textarea
            ref={editRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKey}
            rows={2}
            className="w-full resize-none text-[11px] bg-muted/40 rounded-md px-2 py-1 border border-white/[0.12] focus:outline-none focus:border-primary/50 transition-colors"
          />
        ) : (
          <p
            onClick={canWrite ? startEdit : undefined}
            title={canWrite ? "Click to edit" : undefined}
            className={cn(
              "text-[11px] leading-snug text-foreground/80",
              canWrite ? "cursor-text" : "cursor-default",
              done && "line-through text-muted-foreground"
            )}
          >
            {renderTitle(task.title)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PriorityBadge priority={task.priority as TaskPriority} onChange={onPriority} disabled={!canWrite} />
          <DatePickerPopover value={task.due_date} onChange={canWrite ? onDateChange : () => {}} />
          {task.checklist_items.length > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground/60">
              {task.checklist_items.filter((i) => i.done).length}/{task.checklist_items.length}
            </span>
          )}
          {isOwner && (
            <button
              onClick={() => onShareToggle(!task.is_private)}
              title={task.is_private ? "Private — click to share" : "Shared — click to make private"}
              className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              {task.is_private
                ? <Lock className="h-2.5 w-2.5" />
                : <Globe className="h-2.5 w-2.5 text-primary/60" />}
            </button>
          )}
        </div>
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span key={tag} className="text-[9px] font-medium text-primary/90">@{tag}</span>
            ))}
          </div>
        )}
        {(task.checklist_items.length > 0 || addingChecklist) && (
          <div className="space-y-1 pt-0.5">
            {task.checklist_items
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <div key={item.id} className="group/item flex items-center gap-1.5">
                  <button
                    onClick={() => onChecklistToggle(item.id, !item.done)}
                    className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.done
                      ? <CheckSquare2 className="h-3 w-3 text-success" />
                      : <Square className="h-3 w-3" />}
                  </button>
                  <span className={cn("flex-1 text-[10px] leading-snug", item.done && "line-through text-muted-foreground/50")}>
                    {item.text}
                  </span>
                  {canWrite && (
                    <button
                      onClick={() => onChecklistDelete(item.id)}
                      className="opacity-0 group-hover/item:opacity-100 flex-shrink-0 text-muted-foreground/40 hover:text-destructive transition-all"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            {addingChecklist && (
              <input
                ref={newItemRef}
                value={newItemVal}
                onChange={(e) => setNewItemVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitNewItem(); }
                  if (e.key === "Escape") { setNewItemVal(""); setAddingChecklist(false); }
                }}
                onBlur={() => { if (!newItemVal.trim()) setAddingChecklist(false); }}
                placeholder="Add item…"
                className="w-full rounded px-1.5 py-0.5 text-[10px] bg-muted/40 border border-primary/50 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
              />
            )}
          </div>
        )}
      </div>

      <button
        onClick={onPinToggle}
        title={task.is_pinned ? "Unpin" : "Pin to top"}
        className={cn(
          "mt-0.5 flex-shrink-0 transition-all",
          task.is_pinned
            ? "text-primary opacity-80"
            : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
        )}
      >
        <Pin className={cn("h-3 w-3 rotate-45", task.is_pinned && "fill-current")} />
      </button>
      {canWrite && (
        <button
          onClick={onDelete}
          className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Calendar chip ─────────────────────────────────────────────────────────────

function CalendarChip({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const done = task.status === "done";
  return (
    <button
      onClick={onToggle}
      title={task.title}
      className={cn(
        "flex items-center gap-1 w-full rounded px-1.5 py-0.5 text-left truncate text-[10px] transition-colors",
        done
          ? "bg-muted/30 text-muted-foreground line-through"
          : task.priority === "urgent" ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
          : task.priority === "high"   ? "bg-orange-400/15 text-orange-400 hover:bg-orange-400/25"
          : task.priority === "medium" ? "bg-blue-400/15 text-blue-400 hover:bg-blue-400/25"
          :                             "bg-slate-400/15 text-slate-400 hover:bg-slate-400/25"
      )}
    >
      <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", done ? "bg-muted-foreground" : P[task.priority as TaskPriority].dot)} />
      <span className="truncate flex-1">{renderTitle(task.title)}</span>
      {task.checklist_items.length > 0 && (
        <span className="flex-shrink-0 text-[9px] tabular-nums opacity-60">
          {task.checklist_items.filter((i) => i.done).length}/{task.checklist_items.length}
        </span>
      )}
    </button>
  );
}

function DraggableCalendarChip({ task, onToggle, canWrite }: { task: Task; onToggle: () => void; canWrite: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${task.id}`,
    data: { task, type: "calendar" },
    disabled: !canWrite,
  });
  if (!canWrite) return <CalendarChip task={task} onToggle={onToggle} />;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}>
      <CalendarChip task={task} onToggle={onToggle} />
    </div>
  );
}

function InlineDateAdd({ onCommit, onCancel }: { onCommit: (title: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  function commit() {
    const t = val.trim();
    if (t) onCommit(t); else onCancel();
  }

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
      }}
      onBlur={commit}
      placeholder="New task…"
      className="mt-0.5 w-full rounded px-1.5 py-0.5 text-[10px] bg-background border border-primary/50 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
    />
  );
}

function DroppableDay({
  id, isToday, isAdding, onAddClick, onAddCommit, onAddCancel, canWrite, children,
}: {
  id: string; isToday: boolean;
  isAdding: boolean; onAddClick: () => void;
  onAddCommit: (title: string) => void; onAddCancel: () => void;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/daycell min-h-[100px] p-1.5 space-y-0.5 bg-card/65 transition-colors",
        isOver ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/40" : isToday && "ring-1 ring-inset ring-primary/50"
      )}
    >
      {children}
      {canWrite && (
        isAdding ? (
          <InlineDateAdd onCommit={onAddCommit} onCancel={onAddCancel} />
        ) : (
          <button
            onClick={onAddClick}
            className="mt-0.5 w-full flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-transparent group-hover/daycell:text-muted-foreground/40 hover:!text-primary/70 hover:bg-primary/5 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
            Add
          </button>
        )
      )}
    </div>
  );
}

function DroppableNoDate({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "no-date" });
  return (
    <div ref={setNodeRef} className={cn("rounded-xl transition-all", isOver && "ring-1 ring-inset ring-primary/40")}>
      {children}
    </div>
  );
}

function DraggableNoDateRow({ task, canWrite, children }: { task: Task; canWrite: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `row-${task.id}`,
    data: { task, type: "calendar" },
    disabled: !canWrite,
  });
  if (!canWrite) return <div>{children}</div>;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}>
      {children}
    </div>
  );
}

function Section({
  title, count, icon, children, defaultOpen = true,
}: {
  title: string; count: number; icon: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-b border-black/10 dark:border-white/10"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
        {icon}
        <span className="uppercase tracking-wide">{title}</span>
        <span className="ml-auto tabular-nums text-muted-foreground/60">{count}</span>
      </button>
      {open && <div className="divide-y divide-black/10 dark:divide-white/10">{children}</div>}
    </div>
  );
}

// ── Project date editor (inline calendar — avoids nested-Popover dismiss issues) ──

function ProjectDateEditor({
  proj,
  onUpdate,
}: {
  proj: ProjectWithDates;
  onUpdate: (start: string | null, end: string | null) => void;
}) {
  const hasBoth = !!(proj.start_date && proj.end_date);
  const [picking, setPicking] = useState<"start" | "end">(hasBoth ? "start" : "start");

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (picking === "start") {
      onUpdate(ds, proj.end_date);
      setPicking("end");
    } else {
      onUpdate(proj.start_date, ds);
      setPicking("start");
    }
  }

  const startLabel = proj.start_date ? formatDue(proj.start_date).label : "Pick date";
  const endLabel   = proj.end_date   ? formatDue(proj.end_date).label   : "Pick date";

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold truncate">{proj.name}</p>
      <div className="flex gap-1.5">
        {(["start", "end"] as const).map((field) => (
          <button
            key={field}
            onClick={() => setPicking(field)}
            className={cn(
              "flex-1 text-left rounded-md border px-2 py-1.5 transition-colors",
              picking === field
                ? "border-primary/50 bg-primary/5 text-primary"
                : "border-white/[0.08] text-muted-foreground hover:border-white/20"
            )}
          >
            <p className="text-[9px] uppercase tracking-wide mb-0.5 opacity-70">{field}</p>
            <p className="text-[10px] font-medium">{field === "start" ? startLabel : endLabel}</p>
          </button>
        ))}
      </div>
      <CalendarPicker
        mode="single"
        selected={
          picking === "start"
            ? proj.start_date ? new Date(proj.start_date + "T00:00:00") : undefined
            : proj.end_date   ? new Date(proj.end_date   + "T00:00:00") : undefined
        }
        onSelect={handleSelect}
        className="p-0 [--cell-size:1.75rem]"
      />
      {(proj.start_date || proj.end_date) && (
        <button
          onClick={() => { onUpdate(null, null); setPicking("start"); }}
          className="text-[10px] text-destructive/60 hover:text-destructive transition-colors"
        >
          Remove from calendar
        </button>
      )}
    </div>
  );
}

// ── Today / Tomorrow sidebar card ────────────────────────────────────────────

function DaySection({
  label,
  sublabel,
  tasks: dayTasks,
  onToggle,
}: {
  label: string;
  sublabel: string;
  tasks: Task[];
  onToggle: (t: Task) => void;
}) {
  const done = dayTasks.filter((t) => t.status === "done").length;
  const allDone = dayTasks.length > 0 && done === dayTasks.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-foreground/80">{label}</p>
          <p className="text-[10px] text-muted-foreground/60">{sublabel}</p>
        </div>
        {dayTasks.length > 0 && (
          <span className={cn(
            "text-[10px] tabular-nums rounded-full px-1.5 py-px font-medium",
            allDone
              ? "bg-success/15 text-success"
              : "bg-primary/15 text-primary"
          )}>
            {done}/{dayTasks.length}
          </span>
        )}
      </div>

      {dayTasks.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 border border-white/[0.05]">
          <CheckCircle2 className="h-3 w-3 text-muted-foreground/25 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground/40">Nothing scheduled</p>
        </div>
      ) : allDone ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
          <p className="text-[10px] font-medium text-success">All done!</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {dayTasks.map((t) => {
            const isDone = t.status === "done";
            const sortedItems = t.checklist_items.slice().sort((a, b) => a.position - b.position);
            return (
              <div
                key={t.id}
                className={cn(
                  "group/item rounded-lg px-2 py-1.5 transition-colors",
                  isDone ? "opacity-50 hover:opacity-70" : "hover:bg-muted/30"
                )}
              >
                {/* Title row */}
                <div className="flex items-start gap-2">
                  <span className={cn(
                    "mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                    isDone ? "bg-muted-foreground/40" : P[t.priority as TaskPriority].dot
                  )} />
                  <span className={cn(
                    "flex-1 min-w-0 text-[10px] leading-snug",
                    isDone ? "line-through text-muted-foreground" : "text-foreground/80"
                  )}>
                    {renderTitle(t.title)}
                  </span>
                  <button
                    onClick={() => onToggle(t)}
                    title={isDone ? "Reopen" : t.status === "in_progress" ? "Mark done" : "Start"}
                    className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity mt-0.5"
                  >
                    {isDone
                      ? <Circle className="h-2.5 w-2.5 text-muted-foreground" />
                      : t.status === "in_progress"
                        ? <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
                        : <Clock className="h-2.5 w-2.5 text-muted-foreground" />}
                  </button>
                </div>

                {/* Checklist items */}
                {sortedItems.length > 0 && (
                  <div className="mt-1 ml-3.5 space-y-0.5">
                    {sortedItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-1.5">
                        {item.done
                          ? <CheckSquare2 className="h-2.5 w-2.5 flex-shrink-0 mt-px text-success/60" />
                          : <Square className="h-2.5 w-2.5 flex-shrink-0 mt-px text-muted-foreground/40" />}
                        <span className={cn(
                          "text-[9px] leading-snug",
                          item.done ? "line-through text-muted-foreground/40" : "text-muted-foreground/70"
                        )}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TodayTomorrowCard({
  tasks,
  todayDateStr,
  tomorrowDateStr,
  onToggle,
}: {
  tasks: Task[];
  todayDateStr: string;
  tomorrowDateStr: string;
  onToggle: (t: Task) => void;
}) {
  const byDay = (ds: string) =>
    tasks
      .filter((t) => t.due_date === ds)
      .sort((a, b) =>
        (PRIORITY_ORDER[b.priority as TaskPriority] ?? 0) -
        (PRIORITY_ORDER[a.priority as TaskPriority] ?? 0)
      );

  const todayTasks    = byDay(todayDateStr);
  const tomorrowTasks = byDay(tomorrowDateStr);

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

  const todaySub    = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
  const tomorrowSub = tomorrow.toLocaleDateString("en-AU", { weekday: "long" });

  return (
    <div className="w-60 flex-shrink-0 bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-4 self-start sticky top-4">
      <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
        <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Daily View</p>
      </div>

      <DaySection
        label="Today"
        sublabel={todaySub}
        tasks={todayTasks}
        onToggle={onToggle}
      />

      <div className="border-t border-white/[0.06]" />

      <DaySection
        label="Tomorrow"
        sublabel={tomorrowSub}
        tasks={tomorrowTasks}
        onToggle={onToggle}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlannerView({
  orgSlug,
  orgId,
  initialTasks,
  projects,
  members,
  currentUserId,
  canWrite,
  initialView,
}: {
  orgSlug: string;
  orgId: string;
  initialTasks: Task[];
  projects: ProjectWithDates[];
  members: Member[];
  currentUserId: string;
  canWrite: boolean;
  initialView?: "kanban" | "list" | "calendar";
}) {
  const { setOpen: openPanel } = useTaskPanel();

  const [view, setView] = useState<"kanban" | "list" | "calendar">(initialView ?? "kanban");
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [projectList, setProjectList] = useState<ProjectWithDates[]>(projects);

  const loadTasks = useCallback(async () => {
    const result = await getTasksData(orgSlug);
    if (result) setTasks(result.tasks as Task[]);
  }, [orgSlug]);

  useEffect(() => {
    const handler = () => loadTasks();
    window.addEventListener("floora:tasks-changed", handler);
    return () => window.removeEventListener("floora:tasks-changed", handler);
  }, [loadTasks]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-insert-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks", filter: `org_id=eq.${orgId}` },
        () => loadTasks()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, loadTasks]);

  // Filters
  const [search, setSearch]               = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<TaskStatus>>(new Set());
  const [priorityFilters, setPFilters]    = useState<Set<TaskPriority>>(new Set());
  const [tagFilters, setTagFilters]       = useState<Set<string>>(new Set());
  const [mineOnly, setMineOnly]           = useState(false);
  const [dateFilter, setDateFilter]       = useState<DateFilter>("all");

  // Sync calendar to the right month when switching to calendar view or changing date filter
  useEffect(() => {
    if (view !== "calendar") return;
    const n = new Date();
    if (dateFilter === "tomorrow") {
      const t = new Date(n); t.setDate(t.getDate() + 1);
      setCalYear(t.getFullYear()); setCalMonth(t.getMonth());
    } else {
      setCalYear(n.getFullYear()); setCalMonth(n.getMonth());
    }
  }, [view, dateFilter]);

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags))).sort();
  const todayMs = getTodayMs();

  // Date filter counts (unfiltered tasks, for badge display)
  const dateCounts: Record<DateFilter, number> = {
    all:       tasks.filter((t) => t.status !== "done").length,
    today:     tasks.filter((t) => { if (!t.due_date || t.status === "done") return false; const d = Math.round((new Date(t.due_date + "T00:00:00").getTime() - todayMs) / 86_400_000); return d === 0; }).length,
    tomorrow:  tasks.filter((t) => { if (!t.due_date) return false; const d = Math.round((new Date(t.due_date + "T00:00:00").getTime() - todayMs) / 86_400_000); return d === 1; }).length,
    this_week: tasks.filter((t) => { if (!t.due_date) return false; const d = Math.round((new Date(t.due_date + "T00:00:00").getTime() - todayMs) / 86_400_000); return d >= 0 && d <= 6; }).length,
    overdue:   tasks.filter((t) => { if (!t.due_date || t.status === "done") return false; const d = Math.round((new Date(t.due_date + "T00:00:00").getTime() - todayMs) / 86_400_000); return d < 0; }).length,
  };

  const filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilters.size > 0 && !statusFilters.has(t.status as TaskStatus)) return false;
    if (priorityFilters.size > 0 && !priorityFilters.has(t.priority as TaskPriority)) return false;
    if (tagFilters.size > 0 && !t.tags.some((g) => tagFilters.has(g))) return false;
    if (mineOnly && t.created_by !== currentUserId) return false;
    if (dateFilter !== "all") {
      if (!t.due_date) return false;
      const diff = Math.round((new Date(t.due_date + "T00:00:00").getTime() - todayMs) / 86_400_000);
      if (dateFilter === "today"     && diff !== 0)             return false;
      if (dateFilter === "tomorrow"  && diff !== 1)             return false;
      if (dateFilter === "this_week" && (diff < 0 || diff > 6)) return false;
      if (dateFilter === "overdue"   && diff >= 0)              return false;
    }
    return true;
  });

  const sorted = (s: TaskStatus) =>
    filtered
      .filter((t) => t.status === s)
      .sort((a, b) =>
        (PRIORITY_ORDER[b.priority as TaskPriority] ?? 0) -
        (PRIORITY_ORDER[a.priority as TaskPriority] ?? 0)
      );

  const todoTasks       = sorted("todo");
  const inProgressTasks = sorted("in_progress");
  const doneTasks       = filtered
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const hasFilter =
    !!search || statusFilters.size > 0 || priorityFilters.size > 0 ||
    tagFilters.size > 0 || mineOnly || dateFilter !== "all";

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleTitleUpdate(task: Task, title: string) {
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, title } : t));
    try { await updateTask(task.id, { title }, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  async function handleToggle(task: Task) {
    const next: TaskStatus =
      task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, status: next } : t));
    try { await updateTask(task.id, { status: next }, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  async function handleDelete(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try { await deleteTask(id, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  async function handlePriority(task: Task, p: TaskPriority) {
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, priority: p } : t));
    try { await updateTask(task.id, { priority: p }, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  async function handleDateChange(task: Task, date: string | null) {
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, due_date: date } : t));
    try {
      await updateTask(task.id, { due_date: date }, orgSlug);
      window.dispatchEvent(new CustomEvent("floora:tasks-changed"));
    } catch { setTasks(initialTasks); }
  }

  async function handleProjectDates(id: string, start_date: string | null, end_date: string | null) {
    setProjectList((ps) => ps.map((p) => p.id === id ? { ...p, start_date, end_date } : p));
    try { await updateProjectDates(id, orgSlug, start_date, end_date); }
    catch { setProjectList(projects); }
  }

  async function handleShareToggle(task: Task, isPrivate: boolean) {
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, is_private: isPrivate } : t));
    try { await updateTask(task.id, { is_private: isPrivate }, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  async function handlePinToggle(task: Task) {
    const next = !task.is_pinned;
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, is_pinned: next } : t));
    try {
      if (next) await pinTask(task.id, orgSlug);
      else await unpinTask(task.id, orgSlug);
    } catch { setTasks(initialTasks); }
  }

  async function handleChecklistAdd(task: Task, text: string) {
    const tempId = `temp-${Date.now()}`;
    const tempItem: ChecklistItem = { id: tempId, task_id: task.id, text, done: false, position: task.checklist_items.length };
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, checklist_items: [...t.checklist_items, tempItem] } : t));
    try {
      const item = await addChecklistItem(task.id, text, orgSlug);
      setTasks((ts) => ts.map((t) => t.id === task.id
        ? { ...t, checklist_items: t.checklist_items.map((i) => i.id === tempId ? item : i) }
        : t
      ));
    } catch {
      setTasks((ts) => ts.map((t) => t.id === task.id
        ? { ...t, checklist_items: t.checklist_items.filter((i) => i.id !== tempId) }
        : t
      ));
    }
  }

  async function handleChecklistToggle(task: Task, itemId: string, done: boolean) {
    setTasks((ts) => ts.map((t) => t.id === task.id
      ? { ...t, checklist_items: t.checklist_items.map((i) => i.id === itemId ? { ...i, done } : i) }
      : t
    ));
    try { await toggleChecklistItem(itemId, done, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  async function handleChecklistDelete(task: Task, itemId: string) {
    setTasks((ts) => ts.map((t) => t.id === task.id
      ? { ...t, checklist_items: t.checklist_items.filter((i) => i.id !== itemId) }
      : t
    ));
    try { await deleteChecklistItem(itemId, orgSlug); }
    catch { setTasks(initialTasks); }
  }

  // ── Calendar inline add ───────────────────────────────────────────────────

  const [addingOnDate, setAddingOnDate] = useState<string | null>(null);

  async function handleCreateOnDate(dateStr: string, title: string) {
    const tempId = `temp-${Date.now()}`;
    const tempTask: Task = {
      id: tempId, org_id: "", project_id: null, title, tags: [],
      status: "todo", priority: "medium", due_date: dateStr,
      assigned_to: null, is_private: false, is_pinned: false, created_by: currentUserId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), checklist_items: [],
    };
    setAddingOnDate(null);
    setTasks((ts) => [...ts, tempTask]);
    try {
      await createTask({ orgSlug, title, priority: "medium", due_date: dateStr });
      await loadTasks();
      window.dispatchEvent(new CustomEvent("floora:tasks-changed"));
    } catch {
      setTasks((ts) => ts.filter((t) => t.id !== tempId));
    }
  }

  // ── DnD (shared for kanban + calendar) ────────────────────────────────────

  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggingTask(event.active.data.current?.task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    const task: Task | undefined = event.active.data.current?.task;
    if (!task || !event.over) return;

    const overId = String(event.over.id);

    if (overId.startsWith("col-")) {
      // Kanban: change status
      const newStatus = overId.replace("col-", "") as TaskStatus;
      if (newStatus === task.status) return;
      setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
      try {
        await updateTask(task.id, { status: newStatus }, orgSlug);
        window.dispatchEvent(new CustomEvent("floora:tasks-changed"));
      } catch { await loadTasks(); }
    } else {
      // Calendar: change due_date — update tasks state so kanban/list reflect immediately
      const newDate = overId === "no-date" ? null : overId;
      if (newDate === (task.due_date ?? null)) return;
      setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, due_date: newDate } : t));
      try {
        await updateTask(task.id, { due_date: newDate }, orgSlug);
        window.dispatchEvent(new CustomEvent("floora:tasks-changed"));
      } catch { await loadTasks(); }
    }
  }

  // ── Calendar helpers ───────────────────────────────────────────────────────

  function getProjectBarsForWeek(week: (number | null)[]) {
    return projectList
      .filter((p) => p.start_date && p.end_date)
      .flatMap((proj, projIdx) => {
        let startCol = -1, lastCol = -1;
        week.forEach((day, col) => {
          if (!day) return;
          const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          if (ds >= proj.start_date! && ds <= proj.end_date!) {
            if (startCol === -1) startCol = col;
            lastCol = col;
          }
        });
        return startCol !== -1 ? [{ proj, projIdx, startCol, lastCol }] : [];
      });
  }

  const unscheduledProjects = projectList.filter((p) => !p.start_date || !p.end_date);

  const calCells = getCalCells(calYear, calMonth);
  const today = todayStr();

  const tasksByDay = new Map<number, Task[]>();
  filtered.forEach((t) => {
    if (!t.due_date) return;
    const d = new Date(t.due_date + "T00:00:00");
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const day = d.getDate();
      tasksByDay.set(day, [...(tasksByDay.get(day) ?? []), t]);
    }
  });

  const noDateTasks = filtered.filter((t) => !t.due_date);

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="space-y-4">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold">Planner</h1>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-muted/30 p-0.5 gap-0.5">
          {([
            { key: "kanban",   Icon: LayoutGrid,   label: "Kanban"   },
            { key: "list",     Icon: LayoutList,   label: "List"     },
            { key: "calendar", Icon: CalendarDays, label: "Calendar" },
          ] as const).map(({ key, Icon, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                view === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {canWrite && (
          <button
            onClick={() => openPanel(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New task
          </button>
        )}
      </div>

      {/* ── Date filter tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          { key: "all",       label: "All"        },
          { key: "today",     label: "Today"      },
          { key: "tomorrow",  label: "Tomorrow"   },
          { key: "this_week", label: "This Week"  },
          { key: "overdue",   label: "Overdue"    },
        ] as { key: DateFilter; label: string }[]).map(({ key, label }) => {
          const active = dateFilter === key;
          const count = dateCounts[key];
          return (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors",
                active
                  ? key === "overdue"
                    ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-sm"
                    : "bg-primary/10 text-primary border-primary/30 shadow-sm"
                  : "text-muted-foreground border-white/[0.08] hover:text-foreground hover:bg-muted/40 hover:border-white/[0.12]"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  "tabular-nums text-[10px] rounded-full px-1.5 py-px font-medium",
                  active
                    ? key === "overdue" ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary"
                    : "bg-muted/60 text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Secondary filter bar ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-7 w-44 pl-7 pr-3 text-xs rounded-lg border border-white/[0.12] bg-muted/30 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Status */}
          {(["todo", "in_progress", "done"] as TaskStatus[]).map((s) => {
            const labels: Record<TaskStatus, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };
            const active = statusFilters.has(s);
            const count = tasks.filter((t) => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilters(toggleSet(statusFilters, s))}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
                  active
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-muted-foreground border-white/[0.12] hover:text-foreground hover:bg-muted/50"
                )}
              >
                {labels[s]}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}

          {/* Priority */}
          {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => {
            const active = priorityFilters.has(p);
            return (
              <button
                key={p}
                onClick={() => setPFilters(toggleSet(priorityFilters, p))}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
                  active
                    ? cn(P[p].text, P[p].bg)
                    : "text-muted-foreground border-white/[0.12] hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", P[p].dot)} />
                {P[p].label}
              </button>
            );
          })}

          {/* Mine only */}
          <button
            onClick={() => setMineOnly((v) => !v)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
              mineOnly
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground border-white/[0.12] hover:text-foreground hover:bg-muted/50"
            )}
          >
            My tasks
          </button>

          {hasFilter && (
            <button
              onClick={() => {
                setSearch(""); setStatusFilters(new Set()); setPFilters(new Set());
                setTagFilters(new Set()); setMineOnly(false); setDateFilter("all");
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* @tag chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => {
              const active = tagFilters.has(tag);
              const count = tasks.filter((t) => t.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilters(toggleSet(tagFilters, tag))}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium border transition-colors",
                    active
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "text-muted-foreground border-white/[0.12] hover:text-primary hover:border-primary/30 hover:bg-primary/5"
                  )}
                >
                  @{tag}
                  <span className="ml-0.5 opacity-50">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Kanban view ──────────────────────────────────────────────────── */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          <KanbanColumn
            status="todo"
            title="To Do"
            tasks={todoTasks}
            headerAccent="bg-muted/30"
            headerIcon={<Circle className="h-4 w-4 text-muted-foreground" />}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onPriority={handlePriority}
            onTitleChange={handleTitleUpdate}
            onDateChange={handleDateChange}
            onShareToggle={handleShareToggle}
            onChecklistAdd={handleChecklistAdd}
            onChecklistToggle={handleChecklistToggle}
            onChecklistDelete={handleChecklistDelete}
            onPinToggle={handlePinToggle}
            canWrite={canWrite}
            currentUserId={currentUserId}
          />
          <KanbanColumn
            status="in_progress"
            title="In Progress"
            tasks={inProgressTasks}
            headerAccent="bg-primary/10"
            headerIcon={<Clock className="h-4 w-4 text-primary" />}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onPriority={handlePriority}
            onTitleChange={handleTitleUpdate}
            onDateChange={handleDateChange}
            onShareToggle={handleShareToggle}
            onChecklistAdd={handleChecklistAdd}
            onChecklistToggle={handleChecklistToggle}
            onChecklistDelete={handleChecklistDelete}
            onPinToggle={handlePinToggle}
            canWrite={canWrite}
            currentUserId={currentUserId}
          />
          <KanbanColumn
            status="done"
            title="Done"
            tasks={doneTasks}
            headerAccent="bg-success/10"
            headerIcon={<CheckCircle2 className="h-4 w-4 text-success" />}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onPriority={handlePriority}
            onTitleChange={handleTitleUpdate}
            onDateChange={handleDateChange}
            onShareToggle={handleShareToggle}
            onChecklistAdd={handleChecklistAdd}
            onChecklistToggle={handleChecklistToggle}
            onChecklistDelete={handleChecklistDelete}
            onPinToggle={handlePinToggle}
            canWrite={canWrite}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* ── List view ────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-visible">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
              </p>
              {tasks.length === 0 && (
                <button onClick={() => openPanel(true)} className="text-xs text-primary hover:underline">
                  Add your first task →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-black/10 dark:divide-white/10">
              <Section title="To Do" count={todoTasks.length} icon={<Circle className="h-3 w-3" />}>
                {todoTasks.map((t) => (
                  <TaskListCard key={t.id} task={t}
                    onToggle={() => handleToggle(t)}
                    onDelete={() => handleDelete(t.id)}
                    onPriority={(p) => handlePriority(t, p)}
                    onTitleChange={(title) => handleTitleUpdate(t, title)}
                    onDateChange={(date) => handleDateChange(t, date)}
                    onShareToggle={(isPrivate) => handleShareToggle(t, isPrivate)}
                    onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                    onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                    onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                    onPinToggle={() => handlePinToggle(t)}
                    canWrite={canWrite}
                    isOwner={t.created_by === currentUserId}
                  />
                ))}
              </Section>
              <Section title="In Progress" count={inProgressTasks.length} icon={<Clock className="h-3 w-3 text-primary" />}>
                {inProgressTasks.map((t) => (
                  <TaskListCard key={t.id} task={t}
                    onToggle={() => handleToggle(t)}
                    onDelete={() => handleDelete(t.id)}
                    onPriority={(p) => handlePriority(t, p)}
                    onTitleChange={(title) => handleTitleUpdate(t, title)}
                    onDateChange={(date) => handleDateChange(t, date)}
                    onShareToggle={(isPrivate) => handleShareToggle(t, isPrivate)}
                    onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                    onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                    onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                    onPinToggle={() => handlePinToggle(t)}
                    canWrite={canWrite}
                    isOwner={t.created_by === currentUserId}
                  />
                ))}
              </Section>
              <Section title="Done" count={doneTasks.length} icon={<CheckCircle2 className="h-3 w-3 text-success" />} defaultOpen={false}>
                {doneTasks.map((t) => (
                  <TaskListCard key={t.id} task={t}
                    onToggle={() => handleToggle(t)}
                    onDelete={() => handleDelete(t.id)}
                    onPriority={(p) => handlePriority(t, p)}
                    onTitleChange={(title) => handleTitleUpdate(t, title)}
                    onDateChange={(date) => handleDateChange(t, date)}
                    onShareToggle={(isPrivate) => handleShareToggle(t, isPrivate)}
                    onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                    onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                    onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                    onPinToggle={() => handlePinToggle(t)}
                    canWrite={canWrite}
                    isOwner={t.created_by === currentUserId}
                  />
                ))}
              </Section>
            </div>
          )}
        </div>
      )}

      {/* ── Calendar view ────────────────────────────────────────────────── */}
      {view === "calendar" && (
        <div className="space-y-4">

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grid + daily card */}
          <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 rounded-xl border border-white/[0.08] overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-black/10 dark:border-white/10 bg-muted/30">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            {/* Week rows */}
            {Array.from({ length: Math.ceil(calCells.length / 7) }, (_, wi) => {
              const week = calCells.slice(wi * 7, wi * 7 + 7);
              const bars = getProjectBarsForWeek(week);
              return (
                <div key={wi} className="border-b border-black/10 dark:border-white/10 last:border-0">
                  {/* Project banner layer */}
                  {bars.length > 0 && (
                    <div className="grid grid-cols-7 gap-y-0.5 py-0.5 px-0.5 bg-muted/[0.15] border-b border-black/10 dark:border-white/[0.06]">
                      {bars.map(({ proj, projIdx, startCol, lastCol }) => {
                        const c = PROJECT_COLORS[projIdx % PROJECT_COLORS.length];
                        return canWrite ? (
                          <Popover key={proj.id}>
                            <PopoverTrigger
                              style={{ gridColumn: `${startCol + 1} / ${lastCol + 2}` }}
                              className={cn(
                                "h-5 flex items-center px-2 mx-0.5 rounded text-[9px] font-medium truncate border transition-colors",
                                c.bg, c.text, c.border, c.hover
                              )}
                              title={proj.name}
                            >
                              {proj.name}
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-3 bg-card/95 backdrop-blur-xl border-white/[0.08] shadow-2xl">
                              <ProjectDateEditor
                                proj={proj}
                                onUpdate={(start, end) => handleProjectDates(proj.id, start, end)}
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div
                            key={proj.id}
                            style={{ gridColumn: `${startCol + 1} / ${lastCol + 2}` }}
                            className={cn(
                              "h-5 flex items-center px-2 mx-0.5 rounded text-[9px] font-medium truncate border",
                              c.bg, c.text, c.border
                            )}
                            title={proj.name}
                          >
                            {proj.name}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Day cells */}
                  <div className="grid grid-cols-7 divide-x divide-black/10 dark:divide-white/10">
                    {week.map((day, di) => {
                      if (!day) return <div key={`pad-${wi}-${di}`} className="min-h-[100px] bg-muted/10" />;
                      const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isToday = ds === today;
                      const dayTasks = tasksByDay.get(day) ?? [];
                      const visible = dayTasks.slice(0, 3);
                      const overflow = dayTasks.length - 3;
                      return (
                        <DroppableDay
                          key={day} id={ds} isToday={isToday}
                          isAdding={addingOnDate === ds}
                          onAddClick={() => setAddingOnDate(ds)}
                          onAddCommit={(title) => handleCreateOnDate(ds, title)}
                          onAddCancel={() => setAddingOnDate(null)}
                          canWrite={canWrite}
                        >
                          <div className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium mb-1",
                            isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                          )}>
                            {day}
                          </div>
                          {visible.map((t) => (
                            <DraggableCalendarChip key={t.id} task={t} onToggle={() => handleToggle(t)} canWrite={canWrite} />
                          ))}
                          {overflow > 0 && (
                            <span className="block px-1 text-[9px] text-muted-foreground/60">+{overflow} more</span>
                          )}
                        </DroppableDay>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <TodayTomorrowCard
            tasks={tasks}
            todayDateStr={today}
            tomorrowDateStr={getTomorrowStr()}
            onToggle={handleToggle}
          />
          </div>{/* end grid + card flex row */}

          {/* Unscheduled projects */}
          {unscheduledProjects.length > 0 && (
            <div className="bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-black/10 dark:border-white/10 bg-muted/20 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Unscheduled projects · {unscheduledProjects.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {unscheduledProjects.map((proj) => {
                  const projIdx = projectList.findIndex((p) => p.id === proj.id);
                  const c = PROJECT_COLORS[projIdx % PROJECT_COLORS.length];
                  return canWrite ? (
                    <Popover key={proj.id}>
                      <PopoverTrigger
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                          c.bg, c.text, c.border, c.hover
                        )}
                      >
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        {proj.name}
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-3 bg-card/95 backdrop-blur-xl border-white/[0.08] shadow-2xl">
                        <ProjectDateEditor
                          proj={proj}
                          onUpdate={(start, end) => handleProjectDates(proj.id, start, end)}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div
                      key={proj.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
                        c.bg, c.text, c.border
                      )}
                    >
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      {proj.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No-date tasks */}
          {(noDateTasks.length > 0 || !!draggingTask) && (
            <DroppableNoDate>
              <div className="bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-black/10 dark:border-white/10 bg-muted/20">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    No due date{noDateTasks.length > 0 ? ` · ${noDateTasks.length}` : " — drop here to clear date"}
                  </span>
                </div>
                {noDateTasks.length > 0 ? (
                  <div className="divide-y divide-black/10 dark:divide-white/10">
                    {noDateTasks.map((t) => (
                      <DraggableNoDateRow key={t.id} task={t} canWrite={canWrite}>
                        <TaskListCard
                          task={t}
                          onToggle={() => handleToggle(t)}
                          onDelete={() => handleDelete(t.id)}
                          onPriority={(p) => handlePriority(t, p)}
                          onTitleChange={(title) => handleTitleUpdate(t, title)}
                          onDateChange={(date) => handleDateChange(t, date)}
                          onShareToggle={(isPrivate) => handleShareToggle(t, isPrivate)}
                          onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                          onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                          onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                          onPinToggle={() => handlePinToggle(t)}
                          canWrite={canWrite}
                          isOwner={t.created_by === currentUserId}
                        />
                      </DraggableNoDateRow>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-[11px] text-muted-foreground/40">
                    Drop a task here to remove its date
                  </div>
                )}
              </div>
            </DroppableNoDate>
          )}
        </div>
      )}

    </div>

    <DragOverlay>
      {draggingTask && (
        view === "kanban" ? (
          <div className={cn(
            "rounded-xl border border-l-[3px] border-white/[0.08] p-3 shadow-2xl cursor-grabbing max-w-[300px]",
            "bg-card/95 backdrop-blur-xl",
            P[draggingTask.priority as TaskPriority].border
          )}>
            <p className="text-[10px] text-foreground/85 leading-snug">
              {renderTitle(draggingTask.title)}
            </p>
          </div>
        ) : (
          <div className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-medium shadow-2xl cursor-grabbing max-w-[180px]",
            P[draggingTask.priority as TaskPriority].bg,
            P[draggingTask.priority as TaskPriority].text,
          )}>
            <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", P[draggingTask.priority as TaskPriority].dot)} />
            <span className="truncate">{renderTitle(draggingTask.title)}</span>
          </div>
        )
      )}
    </DragOverlay>
    </DndContext>
  );
}
