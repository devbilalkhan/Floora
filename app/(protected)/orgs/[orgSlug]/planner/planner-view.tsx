"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTaskPanel } from "@/components/tasks/task-provider";
import { getTasksData, updateTask, deleteTask } from "@/app/actions/tasks";
import type { Task, TaskPriority, TaskStatus } from "@/lib/task-types";
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
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  user_id: string;
  profile: { display_name: string | null; email: string | null } | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const P = {
  low:    { label: "Low",    dot: "bg-slate-400",  text: "text-slate-400",  bg: "bg-slate-400/10 border-slate-400/30"  },
  medium: { label: "Med",    dot: "bg-blue-400",   text: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30"   },
  high:   { label: "High",   dot: "bg-orange-400", text: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30"},
  urgent: { label: "Urgent", dot: "bg-red-500",    text: "text-red-500",    bg: "bg-red-500/10 border-red-500/30"     },
} satisfies Record<TaskPriority, { label: string; dot: string; text: string; bg: string }>;

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4, high: 3, medium: 2, low: 1,
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return title.split(/(@[\w-]+)/g).map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="text-primary font-medium">{part}</span>
      : <span key={i}>{part}</span>
  );
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

// ── Sub-components ────────────────────────────────────────────────────────────

function PriorityBadge({
  priority,
  onChange,
}: {
  priority: TaskPriority;
  onChange: (p: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
          P[priority].text, P[priority].bg
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", P[priority].dot)} />
        {P[priority].label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-xl py-1 min-w-[90px]">
          {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
            <button
              key={p}
              onMouseDown={() => { onChange(p); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors",
                P[p].text
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", P[p].dot)} />
              {P[p].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskListCard({
  task,
  onToggle,
  onDelete,
  onPriority,
  onTitleChange,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onPriority: (p: TaskPriority) => void;
  onTitleChange: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(task.title);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const due = task.due_date ? formatDue(task.due_date) : null;
  const done = task.status === "done";

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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { setEditing(false); setEditVal(task.title); }
  }

  const statusIcon =
    done               ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
    : task.status === "in_progress" ? <Clock className="h-3.5 w-3.5 text-primary" />
    :                   <Circle className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/25",
        done && "opacity-50"
      )}
    >
      <button
        onClick={onToggle}
        title="Cycle status"
        className="mt-0.5 flex-shrink-0 hover:opacity-70 transition-opacity"
      >
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

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PriorityBadge priority={task.priority as TaskPriority} onChange={onPriority} />

          {due && (
            <span className={cn(
              "text-[10px] flex items-center gap-0.5",
              due.overdue ? "text-red-400 font-medium" : "text-muted-foreground"
            )}>
              <Calendar className="h-2.5 w-2.5" />
              {due.label}
            </span>
          )}

          {task.tags.map((tag) => (
            <span key={tag} className="text-[10px] text-primary/70 font-medium">
              @{tag}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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
      <span className={cn(
        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
        done ? "bg-muted-foreground" : P[task.priority as TaskPriority].dot
      )} />
      <span className="truncate">{task.title.replace(/@[\w-]+/g, "").trim() || task.title}</span>
    </button>
  );
}

function DraggableCalendarChip({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${task.id}`,
    data: { task },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}>
      <CalendarChip task={task} onToggle={onToggle} />
    </div>
  );
}

function DroppableDay({
  id, isToday, children,
}: {
  id: string; isToday: boolean; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[100px] p-1.5 space-y-0.5 bg-card/65 transition-colors",
        isOver
          ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/40"
          : isToday && "ring-1 ring-inset ring-primary/50"
      )}
    >
      {children}
    </div>
  );
}

function DroppableNoDate({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "no-date" });
  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-xl transition-all", isOver && "ring-1 ring-inset ring-primary/40")}
    >
      {children}
    </div>
  );
}

function DraggableNoDateRow({ task, children }: { task: Task; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `row-${task.id}`,
    data: { task },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}
    >
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

// ── Main component ────────────────────────────────────────────────────────────

export function PlannerView({
  orgSlug,
  initialTasks,
  members,
  currentUserId,
}: {
  orgSlug: string;
  initialTasks: Task[];
  projects: { id: string; name: string }[];
  members: Member[];
  currentUserId: string;
}) {
  const { setOpen: openPanel } = useTaskPanel();

  const [view, setView] = useState<"list" | "calendar">("list");
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const loadTasks = useCallback(async () => {
    const result = await getTasksData(orgSlug);
    if (result) setTasks(result.tasks as Task[]);
  }, [orgSlug]);

  useEffect(() => {
    const handler = () => loadTasks();
    window.addEventListener("floora:tasks-changed", handler);
    return () => window.removeEventListener("floora:tasks-changed", handler);
  }, [loadTasks]);

  // Filters
  const [search, setSearch]                 = useState("");
  const [statusFilters, setStatusFilters]   = useState<Set<TaskStatus>>(new Set());
  const [priorityFilters, setPFilters]      = useState<Set<TaskPriority>>(new Set());
  const [tagFilters, setTagFilters]         = useState<Set<string>>(new Set());
  const [mineOnly, setMineOnly]             = useState(false);

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags))).sort();

  const filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilters.size > 0 && !statusFilters.has(t.status as TaskStatus)) return false;
    if (priorityFilters.size > 0 && !priorityFilters.has(t.priority as TaskPriority)) return false;
    if (tagFilters.size > 0 && !t.tags.some((g) => tagFilters.has(g))) return false;
    if (mineOnly && t.created_by !== currentUserId) return false;
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
    tagFilters.size > 0 || mineOnly;

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

  // ── Calendar ──────────────────────────────────────────────────────────────

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

  // ── Drag & drop ───────────────────────────────────────────────────────────

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
    const newDate = event.over.id === "no-date" ? null : String(event.over.id);
    if (newDate === (task.due_date ?? null)) return;
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, due_date: newDate } : t));
    try { await updateTask(task.id, { due_date: newDate }, orgSlug); }
    catch { setTasks(initialTasks); }
  }

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
    <div className="space-y-4">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold">Planner</h1>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-muted/30 p-0.5 gap-0.5">
          {([
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

        <button
          onClick={() => openPanel(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </button>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
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
                setSearch(""); setStatusFilters(new Set());
                setPFilters(new Set()); setTagFilters(new Set()); setMineOnly(false);
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

      {/* ── List view ────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="bg-card/65 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
              </p>
              {tasks.length === 0 && (
                <button
                  onClick={() => openPanel(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Add your first task →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-black/10 dark:divide-white/10">
              <Section
                title="To Do" count={todoTasks.length}
                icon={<Circle className="h-3 w-3" />}
              >
                {todoTasks.map((t) => (
                  <TaskListCard key={t.id} task={t}
                    onToggle={() => handleToggle(t)}
                    onDelete={() => handleDelete(t.id)}
                    onPriority={(p) => handlePriority(t, p)}
                    onTitleChange={(title) => handleTitleUpdate(t, title)}
                  />
                ))}
              </Section>

              <Section
                title="In Progress" count={inProgressTasks.length}
                icon={<Clock className="h-3 w-3 text-primary" />}
              >
                {inProgressTasks.map((t) => (
                  <TaskListCard key={t.id} task={t}
                    onToggle={() => handleToggle(t)}
                    onDelete={() => handleDelete(t.id)}
                    onPriority={(p) => handlePriority(t, p)}
                    onTitleChange={(title) => handleTitleUpdate(t, title)}
                  />
                ))}
              </Section>

              <Section
                title="Done" count={doneTasks.length}
                icon={<CheckCircle2 className="h-3 w-3 text-success" />}
                defaultOpen={false}
              >
                {doneTasks.map((t) => (
                  <TaskListCard key={t.id} task={t}
                    onToggle={() => handleToggle(t)}
                    onDelete={() => handleDelete(t.id)}
                    onPriority={(p) => handlePriority(t, p)}
                    onTitleChange={(title) => handleTitleUpdate(t, title)}
                  />
                ))}
              </Section>
            </div>
          )}
        </div>
      )}

      {/* ── Calendar view ────────────────────────────────────────────────── */}
      {view === "calendar" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-4">

            {/* Month nav */}
            <div className="flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">
                {MONTHS[calMonth]} {calYear}
              </span>
              <button
                onClick={nextMonth}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Grid */}
            <div className="rounded-xl border border-white/[0.08] overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-7 border-b border-black/10 dark:border-white/10 bg-muted/30">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-black/10 dark:divide-white/10">
                {calCells.map((day, i) => {
                  if (!day) {
                    return <div key={`pad-${i}`} className="min-h-[100px] bg-muted/10" />;
                  }

                  const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday = ds === today;
                  const dayTasks = tasksByDay.get(day) ?? [];
                  const visible = dayTasks.slice(0, 3);
                  const overflow = dayTasks.length - 3;

                  return (
                    <DroppableDay key={day} id={ds} isToday={isToday}>
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium mb-1",
                          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {day}
                      </div>
                      {visible.map((t) => (
                        <DraggableCalendarChip key={t.id} task={t} onToggle={() => handleToggle(t)} />
                      ))}
                      {overflow > 0 && (
                        <span className="block px-1 text-[9px] text-muted-foreground/60">
                          +{overflow} more
                        </span>
                      )}
                    </DroppableDay>
                  );
                })}
              </div>
            </div>

            {/* Tasks without a due date — also a drop target to clear dates */}
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
                        <DraggableNoDateRow key={t.id} task={t}>
                          <TaskListCard
                            task={t}
                            onToggle={() => handleToggle(t)}
                            onDelete={() => handleDelete(t.id)}
                            onPriority={(p) => handlePriority(t, p)}
                            onTitleChange={(title) => handleTitleUpdate(t, title)}
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

          <DragOverlay>
            {draggingTask && (
              <div className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-medium shadow-2xl cursor-grabbing max-w-[180px]",
                P[draggingTask.priority as TaskPriority].bg,
                P[draggingTask.priority as TaskPriority].text,
              )}>
                <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", P[draggingTask.priority as TaskPriority].dot)} />
                <span className="truncate">
                  {draggingTask.title.replace(/@[\w-]+/g, "").trim() || draggingTask.title}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
