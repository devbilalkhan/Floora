"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTaskPanel } from "./task-provider";
import {
  getTasksData,
  createTask,
  updateTask,
  deleteTask,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  pinTask,
  unpinTask,
} from "@/app/actions/tasks";
import type { Task, TaskPriority, TaskStatus, MentionSuggestion, ChecklistItem } from "@/lib/task-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Plus,
  CheckSquare2,
  Square,
  Circle,
  CheckCircle2,
  Clock,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Lock,
  Globe,
  Pin,
} from "lucide-react";
import { toast } from "sonner";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";

// ── Shortcuts reference ───────────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: ["⌘", "J"],      desc: "Open / close Tasks panel" },
  { keys: ["Enter"],        desc: "Add task (while typing)"  },
  { keys: ["@"],            desc: "@mention autocomplete"    },
  { keys: ["↑", "↓"],      desc: "Navigate suggestions"     },
  { keys: ["Tab"],          desc: "Select suggestion"        },
  { keys: ["Esc"],          desc: "Dismiss autocomplete"     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; dot: string; text: string }
> = {
  low:    { label: "Low",    dot: "bg-slate-400",      text: "text-slate-400" },
  medium: { label: "Med",   dot: "bg-blue-400",        text: "text-blue-400" },
  high:   { label: "High",   dot: "bg-orange-400",     text: "text-orange-400" },
  urgent: { label: "Urgent", dot: "bg-red-500",        text: "text-red-500" },
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4, high: 3, medium: 2, low: 1,
};

const PRIORITY_CYCLE: TaskPriority[] = ["low", "medium", "high", "urgent"];

type DateFilter = "all" | "today" | "tomorrow" | "this_week" | "overdue";

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function getTomorrowStr() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function formatDue(dateStr: string): { label: string; overdue: boolean } {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (date.getTime() - today.getTime()) / 86_400_000
  );
  const overdue = diff < 0;
  let label: string;
  if (diff === 0)      label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else if (diff === -1) label = "Yesterday";
  else if (diff > 1 && diff <= 6)
    label = date.toLocaleDateString("en-AU", { weekday: "short" });
  else
    label = date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return { label, overdue };
}

function extractOrgSlug(pathname: string) {
  return pathname.match(/^\/orgs\/([^/]+)/)?.[1] ?? null;
}

function renderTitle(title: string) {
  return title.replace(/@[\w-]+/g, "").replace(/\s+/g, " ").trim() || title;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriorityDot({ p }: { p: TaskPriority }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 mt-px", PRIORITY_CONFIG[p].dot)}
    />
  );
}

function TaskSkeleton() {
  return (
    <div className="mx-3 my-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full bg-muted/40" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3 w-3/5 rounded bg-muted/40" />
          <div className="flex gap-1.5">
            <div className="h-2.5 w-10 rounded bg-muted/30" />
            <div className="h-2.5 w-14 rounded bg-muted/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  isOwner,
  onToggle,
  onDelete,
  onPriorityChange,
  onTitleChange,
  onPrivacyToggle,
  onDateChange,
  onPinToggle,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistDelete,
}: {
  task: Task;
  isOwner: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onPriorityChange: (p: TaskPriority) => void;
  onTitleChange: (title: string) => void;
  onPrivacyToggle: () => void;
  onDateChange: (date: string | null) => void;
  onPinToggle: () => void;
  onChecklistAdd: (text: string) => void;
  onChecklistToggle: (itemId: string, done: boolean) => void;
  onChecklistDelete: (itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(task.title);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newItemVal, setNewItemVal] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);
  const due = task.due_date ? formatDue(task.due_date) : null;
  const done = task.status === "done";

  useEffect(() => {
    if (addingChecklist) newItemRef.current?.focus();
  }, [addingChecklist]);

  function startEdit() {
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

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 rounded-lg px-3 py-2.5 transition-colors",
        "hover:bg-muted/30",
        done && "opacity-50"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : task.status === "in_progress" ? (
          <Clock className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
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
            onClick={startEdit}
            title="Click to edit"
            className={cn(
              "text-[11px] leading-snug text-foreground/80 cursor-text",
              done && "line-through text-muted-foreground"
            )}
          >
            {renderTitle(task.title)}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority (click to cycle) */}
          <button
            onClick={() => {
              const idx = PRIORITY_CYCLE.indexOf(task.priority);
              onPriorityChange(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
            }}
            title="Click to change priority"
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-70",
              PRIORITY_CONFIG[task.priority].text
            )}
          >
            <PriorityDot p={task.priority} />
            {PRIORITY_CONFIG[task.priority].label}
          </button>

          {/* Due date — click to edit */}
          <DatePickerPopover value={task.due_date} onChange={onDateChange} />

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span key={tag} className="text-[9px] font-medium text-primary/90">@{tag}</span>
              ))}
            </div>
          )}

          {/* Checklist */}
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
                        ? <CheckSquare2 className="h-3.5 w-3.5 text-success" />
                        : <Square className="h-3.5 w-3.5" />}
                    </button>
                    <span className={cn("flex-1 text-[11px] leading-snug", item.done && "line-through text-muted-foreground/50")}>
                      {item.text}
                    </span>
                    <button
                      onClick={() => onChecklistDelete(item.id)}
                      className="opacity-0 group-hover/item:opacity-100 flex-shrink-0 text-muted-foreground/40 hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
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
                  className="w-full rounded px-2 py-1 text-[11px] bg-muted/40 border border-primary/50 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                />
              )}
            </div>
          )}

          {/* Privacy indicator — clickable only for the owner */}
          {isOwner ? (
            <button
              onClick={onPrivacyToggle}
              title={task.is_private ? "Private — click to share with org" : "Shared with org — click to make private"}
              className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {task.is_private
                ? <Lock className="h-2.5 w-2.5" />
                : <Globe className="h-2.5 w-2.5 text-primary/60" />}
            </button>
          ) : (
            <span className="ml-auto text-muted-foreground/40" title="Shared task">
              <Globe className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Pin button */}
      <button
        onClick={onPinToggle}
        title={task.is_pinned ? "Unpin" : "Pin to top"}
        className={cn(
          "flex-shrink-0 transition-all mt-0.5",
          task.is_pinned
            ? "text-primary opacity-80"
            : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
        )}
      >
        <Pin className={cn("h-3 w-3 rotate-45", task.is_pinned && "fill-current")} />
      </button>

      {/* Delete (hover only) */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all mt-0.5"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Section({
  title,
  count,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {icon}
        <span className="uppercase tracking-wide">{title}</span>
        <span className="ml-auto tabular-nums">{count}</span>
      </button>
      {open && children}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

type PanelData = NonNullable<Awaited<ReturnType<typeof getTasksData>>>;

export function TaskPanel() {
  const { open, setOpen } = useTaskPanel();
  const pathname = usePathname();
  const orgSlug = extractOrgSlug(pathname);

  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Quick-add state
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [adding, setAdding] = useState(false);

  // Checklist mode in quick-add
  const [checklistMode, setChecklistMode] = useState(false);
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [checklistVal, setChecklistVal] = useState("");
  const checklistInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    try {
      const result = await getTasksData(orgSlug);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  // Load on org change for pull-tab count, and refresh when panel opens
  useEffect(() => {
    if (orgSlug) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // ── Mention autocomplete ────────────────────────────────────────────────────

  const suggestions: MentionSuggestion[] = (() => {
    if (mentionQuery === null || !data) return [];
    const q = mentionQuery.toLowerCase();
    const projects = data.projects
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({
        value: p.name.toLowerCase().replace(/\s+/g, "-"),
        label: p.name,
        type: "project" as const,
      }));
    const people = data.members
      .map((m) => ({
        name: m.profile?.display_name ?? m.profile?.email ?? "",
        userId: m.user_id,
      }))
      .filter((m) => m.name && m.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((m) => ({
        value: m.name.toLowerCase().replace(/\s+/g, "-"),
        label: m.name,
        type: "person" as const,
      }));
    return [...projects, ...people];
  })();

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setTitle(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@([\w-]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(suggestion: MentionSuggestion) {
    const cursor = inputRef.current?.selectionStart ?? title.length;
    const before = title.slice(0, cursor);
    const after = title.slice(cursor);
    const lastAt = before.lastIndexOf("@");
    const newTitle = before.slice(0, lastAt) + "@" + suggestion.value + " " + after;
    setTitle(newTitle);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[mentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      if (!checklistMode && title.trim()) {
        setChecklistMode(true);
        setTimeout(() => checklistInputRef.current?.focus(), 0);
      } else if (checklistMode) {
        handleAdd();
      }
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function notify() {
    window.dispatchEvent(new CustomEvent("floora:tasks-changed"));
  }

  async function handleAdd() {
    if (!title.trim() || !orgSlug || adding) return;

    // Capture and reset immediately — prevents double-submit during loading
    const taskTitle = title;
    const taskPriority = priority;
    const taskDueDate = dueDate;
    const taskIsPrivate = isPrivate;
    const taskItems = [...pendingItems];

    setAdding(true);
    setTitle("");
    setPriority("medium");
    setDueDate("");
    setIsPrivate(false);
    setChecklistMode(false);
    setPendingItems([]);
    setChecklistVal("");

    try {
      const taskId = await createTask({ orgSlug, title: taskTitle, priority: taskPriority, due_date: taskDueDate || undefined, is_private: taskIsPrivate });
      for (const text of taskItems) {
        await addChecklistItem(taskId, text, orgSlug);
      }
      await load();
      notify();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(task: Task) {
    if (!orgSlug) return;
    const next: TaskStatus =
      task.status === "todo" ? "in_progress"
      : task.status === "in_progress" ? "done"
      : "todo";
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, status: next } : t) } : d
    );
    try {
      await updateTask(task.id, { status: next }, orgSlug);
      notify();
    } catch {
      await load();
    }
  }

  async function handleDelete(id: string) {
    if (!orgSlug) return;
    setData((d) => d ? { ...d, tasks: d.tasks.filter((t) => t.id !== id) } : d);
    try {
      await deleteTask(id, orgSlug);
      notify();
      toast.success("Task deleted.");
    } catch {
      toast.error("Failed to delete task.");
      await load();
    }
  }

  async function handlePriority(task: Task, p: TaskPriority) {
    if (!orgSlug) return;
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, priority: p } : t) } : d
    );
    try {
      await updateTask(task.id, { priority: p }, orgSlug);
      notify();
    } catch {
      await load();
    }
  }

  async function handlePrivacyToggle(task: Task) {
    if (!orgSlug) return;
    const next = !task.is_private;
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, is_private: next } : t) } : d
    );
    try {
      await updateTask(task.id, { is_private: next }, orgSlug);
      notify();
    } catch {
      await load();
    }
  }

  async function handleDateUpdate(task: Task, date: string | null) {
    if (!orgSlug) return;
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, due_date: date } : t) } : d
    );
    try {
      await updateTask(task.id, { due_date: date }, orgSlug);
      notify();
    } catch {
      toast.error("Failed to update date.");
      await load();
    }
  }

  async function handlePinToggle(task: Task) {
    if (!orgSlug) return;
    const next = !task.is_pinned;
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, is_pinned: next } : t) } : d
    );
    try {
      if (next) await pinTask(task.id, orgSlug);
      else await unpinTask(task.id, orgSlug);
    } catch {
      await load();
    }
  }

  async function handleChecklistAdd(task: Task, text: string) {
    if (!orgSlug) return;
    const tempId = `temp-${Date.now()}`;
    const tempItem: ChecklistItem = { id: tempId, task_id: task.id, text, done: false, position: task.checklist_items.length };
    setData((d) => d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, checklist_items: [...t.checklist_items, tempItem] } : t) } : d);
    try {
      const item = await addChecklistItem(task.id, text, orgSlug);
      setData((d) => d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, checklist_items: t.checklist_items.map((i: ChecklistItem) => i.id === tempId ? item : i) } : t) } : d);
    } catch {
      setData((d) => d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, checklist_items: t.checklist_items.filter((i: ChecklistItem) => i.id !== tempId) } : t) } : d);
    }
  }

  async function handleChecklistToggle(task: Task, itemId: string, done: boolean) {
    if (!orgSlug) return;
    setData((d) => d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, checklist_items: t.checklist_items.map((i: ChecklistItem) => i.id === itemId ? { ...i, done } : i) } : t) } : d);
    try { await toggleChecklistItem(itemId, done, orgSlug); }
    catch { await load(); }
  }

  async function handleChecklistDelete(task: Task, itemId: string) {
    if (!orgSlug) return;
    setData((d) => d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, checklist_items: t.checklist_items.filter((i: ChecklistItem) => i.id !== itemId) } : t) } : d);
    try { await deleteChecklistItem(itemId, orgSlug); }
    catch { await load(); }
  }

  async function handleTitleUpdate(task: Task, newTitle: string) {
    if (!orgSlug) return;
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, title: newTitle } : t) } : d
    );
    try {
      await updateTask(task.id, { title: newTitle }, orgSlug);
      notify();
    } catch {
      toast.error("Failed to update task.");
      await load();
    }
  }

  // ── Filtered + grouped tasks ───────────────────────────────────────────────

  const allTasks = data?.tasks ?? [];

  const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();

  const filtered = allTasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (tagFilter && !t.tags.includes(tagFilter)) return false;
    if (dateFilter !== "all") {
      if (!t.due_date) return false;
      const diff = Math.round((new Date(t.due_date + "T00:00:00").getTime() - todayMs) / 86_400_000);
      if (dateFilter === "today"     && diff !== 0)           return false;
      if (dateFilter === "tomorrow"  && diff !== 1)           return false;
      if (dateFilter === "this_week" && (diff < 0 || diff > 6)) return false;
      if (dateFilter === "overdue"   && diff >= 0)            return false;
    }
    return true;
  });

  const pinnedTasks = allTasks.filter((t) => t.is_pinned);

  const byStatus = (s: TaskStatus) =>
    filtered
      .filter((t) => t.status === s && !t.is_pinned)
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[b.priority as TaskPriority] ?? 0) -
          (PRIORITY_ORDER[a.priority as TaskPriority] ?? 0)
      );

  const todoTasks       = byStatus("todo");
  const inProgressTasks = byStatus("in_progress");
  const doneTasks       = filtered
    .filter((t) => t.status === "done" && !t.is_pinned)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // All unique tags across tasks for the filter bar
  const allTags = Array.from(new Set(allTasks.flatMap((t) => t.tags))).sort();

  const incompleteCount = allTasks.filter((t) => t.status !== "done").length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Pull-tab — visible when panel is closed */}
      <div
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-[49] transition-all duration-300",
          open ? "opacity-0 pointer-events-none translate-x-2" : "opacity-100 translate-x-0"
        )}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open task panel"
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-l-xl py-4 px-2",
            "bg-card/90 backdrop-blur-xl border border-white/[0.08] border-r-0",
            "shadow-[-4px_0_16px_rgba(0,0,0,0.25)]",
            "text-muted-foreground hover:text-foreground transition-colors"
          )}
        >
          <CheckSquare2 className="h-3.5 w-3.5 text-primary/90" />
          {incompleteCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-medium text-primary tabular-nums">
              {incompleteCount}
            </span>
          )}
          <ChevronLeft className="h-3 w-3 opacity-50" />
        </button>
      </div>

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          "w-full sm:w-[400px]",
          "bg-card/90 backdrop-blur-2xl",
          "border-l border-white/[0.08]",
          "shadow-[-12px_0_40px_rgba(0,0,0,0.25)]",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-black/10 dark:border-white/10 flex-shrink-0">
          <CheckSquare2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tasks</span>
          {incompleteCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-medium text-primary tabular-nums">
              {incompleteCount}
            </span>
          )}
          <div className="flex-1" />
          <kbd className="hidden sm:inline-flex items-center rounded border border-white/[0.12] bg-muted/80 px-1 py-px text-[10px] font-mono leading-none text-muted-foreground">
            ⌘J
          </kbd>
          <button
            onClick={() => setShowHelp((v) => !v)}
            title="Keyboard shortcuts"
            className={cn(
              "rounded-md p-1 transition-colors",
              showHelp
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Shortcuts help (collapsible) ────────────────────────────────── */}
        {showHelp && (
          <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 bg-muted/20 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Keyboard shortcuts
            </p>
            <div className="space-y-1.5">
              {SHORTCUTS.map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">{desc}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="inline-flex items-center justify-center rounded border border-white/[0.12] bg-muted px-1.5 py-px text-[10px] font-mono leading-none text-foreground/70 min-w-[20px]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Add ──────────────────────────────────────────────────── */}
        <div className="px-3 py-3 border-b border-black/10 dark:border-white/10 flex-shrink-0 space-y-2">
          {!orgSlug ? (
            <p className="text-xs text-muted-foreground text-center py-1">
              Navigate into an organisation to add tasks.
            </p>
          ) : (
            <>
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={title}
                  onChange={handleTitleChange}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="What needs to be done?  Use @mentions to tag…"
                  rows={2}
                  className={cn(
                    "w-full resize-none rounded-lg px-3 py-2.5 text-sm",
                    "bg-muted/40 border border-white/[0.12]",
                    "placeholder:text-muted-foreground/50",
                    "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50",
                    "transition-colors"
                  )}
                />

                {/* @mention autocomplete */}
                {mentionQuery !== null && suggestions.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-lg border border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button
                        key={s.value}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(s);
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors",
                          i === mentionIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "rounded px-1 py-px text-[10px] font-medium border",
                            s.type === "project"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-success/10 text-success border-success/20"
                          )}
                        >
                          {s.type === "project" ? "project" : "person"}
                        </span>
                        <span className="font-medium">{s.label}</span>
                        <span className="text-muted-foreground ml-auto">@{s.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist quick-add */}
              {checklistMode && (
                <div className="rounded-lg border border-white/[0.08] bg-muted/20 px-2.5 py-2 space-y-1.5">
                  {pendingItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Square className="h-3 w-3 flex-shrink-0 text-muted-foreground/30" />
                      <span className="text-[11px] text-muted-foreground/70">{item}</span>
                    </div>
                  ))}
                  <input
                    ref={checklistInputRef}
                    value={checklistVal}
                    onChange={(e) => setChecklistVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const t = checklistVal.trim();
                        setChecklistVal("");
                        if (t) {
                          setPendingItems((prev) => [...prev, t]);
                          setTimeout(() => checklistInputRef.current?.focus(), 0);
                        } else {
                          handleAdd();
                        }
                      }
                      if (e.key === "Escape") {
                        setChecklistMode(false);
                        setPendingItems([]);
                        setChecklistVal("");
                      }
                    }}
                    placeholder={pendingItems.length === 0 ? "Add checklist item… (Enter to add, empty Enter to save)" : "Next item… (empty Enter to save)"}
                    className="w-full text-[11px] bg-transparent focus:outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
              )}

              {/* Priority + due date + submit */}
              <div className="flex items-center gap-2">
                {/* Priority chips */}
                <div className="flex items-center gap-1">
                  {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all border",
                        priority === p
                          ? cn(
                              PRIORITY_CONFIG[p].text,
                              p === "low"    && "bg-slate-400/10 border-slate-400/30",
                              p === "medium" && "bg-blue-400/10 border-blue-400/30",
                              p === "high"   && "bg-orange-400/10 border-orange-400/30",
                              p === "urgent" && "bg-red-500/10 border-red-500/30"
                            )
                          : "text-muted-foreground/50 border-transparent hover:text-muted-foreground"
                      )}
                    >
                      <PriorityDot p={p} />
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>

                {/* Privacy toggle */}
                <button
                  onClick={() => setIsPrivate((v) => !v)}
                  title={isPrivate ? "Private — click to share with org" : "Shared with org — click to make private"}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all border",
                    isPrivate
                      ? "text-muted-foreground/60 border-transparent hover:text-muted-foreground"
                      : "text-primary border-primary/30 bg-primary/10"
                  )}
                >
                  {isPrivate ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                  {isPrivate ? "Private" : "Shared"}
                </button>

                <div className="flex-1" />

                {/* Quick-date buttons */}
                {[
                  { label: "Today",    val: getTodayStr()    },
                  { label: "Tom.",     val: getTomorrowStr() },
                ].map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDueDate(dueDate === val ? "" : val)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium border transition-colors",
                      dueDate === val
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "text-muted-foreground border-white/[0.12] hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {label}
                  </button>
                ))}

                {/* Due date */}
                <div className="relative flex items-center">
                  <Calendar className="absolute left-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={cn(
                      "h-6 pl-6 pr-2 text-[11px] rounded border border-white/[0.12] bg-muted/40",
                      "text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors",
                      "[color-scheme:dark]"
                    )}
                  />
                </div>

                <button
                  onClick={handleAdd}
                  disabled={adding || !title.trim()}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  <Plus className="h-3 w-3" />
                  {adding ? "Adding…" : "Add"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 flex-shrink-0 space-y-2">
          {/* Date filter */}
          <div className="flex gap-1 flex-wrap">
            {(
              [
                { key: "all",       label: "All dates" },
                { key: "today",     label: "Today"     },
                { key: "tomorrow",  label: "Tomorrow"  },
                { key: "this_week", label: "Week"      },
                { key: "overdue",   label: "Overdue"   },
              ] as { key: DateFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDateFilter(key)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  dateFilter === key
                    ? key === "overdue"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status tabs */}
          <div className="flex gap-1">
            {(
              [
                { key: "all",         label: "All" },
                { key: "todo",        label: "To Do" },
                { key: "in_progress", label: "In Progress" },
                { key: "done",        label: "Done" },
              ] as { key: TaskStatus | "all"; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  statusFilter === key
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tagFilter && (
                <button
                  onClick={() => setTagFilter(null)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  @{tagFilter}
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
              {allTags
                .filter((t) => t !== tagFilter)
                .slice(0, 8)
                .map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag)}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-white/[0.12] hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    @{tag}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* ── Task list ──────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1">
          {loading && !data ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !orgSlug ? null : filtered.length === 0 && !adding && pinnedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 px-6">
              <CheckSquare2 className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">
                {allTasks.length === 0 ? "No tasks yet" : "No matching tasks"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {allTasks.length === 0
                  ? "Add your first task above"
                  : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <div className="py-2 space-y-1">
              {adding && <TaskSkeleton />}

              {pinnedTasks.length > 0 && (
                <Section
                  title="Pinned"
                  count={pinnedTasks.length}
                  icon={<Pin className="h-2.5 w-2.5 text-primary fill-current rotate-45 opacity-80" />}
                >
                  {pinnedTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      isOwner={t.created_by === data?.currentUserId}
                      onToggle={() => handleToggle(t)}
                      onDelete={() => handleDelete(t.id)}
                      onPriorityChange={(p) => handlePriority(t, p)}
                      onTitleChange={(title) => handleTitleUpdate(t, title)}
                      onPrivacyToggle={() => handlePrivacyToggle(t)}
                      onDateChange={(date) => handleDateUpdate(t, date)}
                      onPinToggle={() => handlePinToggle(t)}
                      onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                      onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                      onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                    />
                  ))}
                </Section>
              )}

              {(statusFilter === "all" || statusFilter === "todo") &&
                todoTasks.length > 0 && (
                  <Section
                    title="To Do"
                    count={todoTasks.length}
                    icon={<Circle className="h-3 w-3" />}
                  >
                    {todoTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        isOwner={t.created_by === data?.currentUserId}
                        onToggle={() => handleToggle(t)}
                        onDelete={() => handleDelete(t.id)}
                        onPriorityChange={(p) => handlePriority(t, p)}
                        onTitleChange={(title) => handleTitleUpdate(t, title)}
                        onPrivacyToggle={() => handlePrivacyToggle(t)}
                        onDateChange={(date) => handleDateUpdate(t, date)}
                        onPinToggle={() => handlePinToggle(t)}
                        onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                        onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                        onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                      />
                    ))}
                  </Section>
                )}

              {(statusFilter === "all" || statusFilter === "in_progress") &&
                inProgressTasks.length > 0 && (
                  <Section
                    title="In Progress"
                    count={inProgressTasks.length}
                    icon={<Clock className="h-3 w-3 text-primary" />}
                  >
                    {inProgressTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        isOwner={t.created_by === data?.currentUserId}
                        onToggle={() => handleToggle(t)}
                        onDelete={() => handleDelete(t.id)}
                        onPriorityChange={(p) => handlePriority(t, p)}
                        onTitleChange={(title) => handleTitleUpdate(t, title)}
                        onPrivacyToggle={() => handlePrivacyToggle(t)}
                        onDateChange={(date) => handleDateUpdate(t, date)}
                        onPinToggle={() => handlePinToggle(t)}
                        onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                        onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                        onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                      />
                    ))}
                  </Section>
                )}

              {(statusFilter === "all" || statusFilter === "done") &&
                doneTasks.length > 0 && (
                  <Section
                    title="Done"
                    count={doneTasks.length}
                    icon={<CheckCircle2 className="h-3 w-3 text-success" />}
                    defaultOpen={statusFilter === "done"}
                  >
                    {doneTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        isOwner={t.created_by === data?.currentUserId}
                        onToggle={() => handleToggle(t)}
                        onDelete={() => handleDelete(t.id)}
                        onPriorityChange={(p) => handlePriority(t, p)}
                        onTitleChange={(title) => handleTitleUpdate(t, title)}
                        onPrivacyToggle={() => handlePrivacyToggle(t)}
                        onDateChange={(date) => handleDateUpdate(t, date)}
                        onPinToggle={() => handlePinToggle(t)}
                        onChecklistAdd={(text) => handleChecklistAdd(t, text)}
                        onChecklistToggle={(itemId, done) => handleChecklistToggle(t, itemId, done)}
                        onChecklistDelete={(itemId) => handleChecklistDelete(t, itemId)}
                      />
                    ))}
                  </Section>
                )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Click-outside close */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
