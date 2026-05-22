# Spec: Org-Level Calendar with Role-Based Access

## Goal
All org members can view the planner calendar (tasks + project date bars). Only `admin` and `project_manager` roles can perform CRUD. Tasks have a sharing toggle (`is_private`) so they can appear on the shared org calendar.

---

## What Already Exists (Do Not Rebuild)

- Planner is already at org level: `/orgs/[orgSlug]/planner/`
- `tasks.is_private boolean default true` — field exists, RLS already enforces it
- Current SELECT policy: visible if `created_by = auth.uid() OR assigned_to = auth.uid() OR NOT is_private` ✓
- `user_org_role(org_id)` SQL function exists and works
- `canWrite = ["admin", "project_manager"].includes(role)` pattern used in `projects/page.tsx` — follow this exactly
- `getTasksData` in `app/actions/tasks.ts` already fetches tasks, projects, members for the org

---

## Changes Required

### 1. Migration — `supabase/migrations/030_tasks_org_write.sql`

Update UPDATE and DELETE policies so admin/PM can act on any org task, not just their own.

```sql
drop policy "update_org_tasks" on tasks;
drop policy "delete_org_tasks" on tasks;

create policy "update_org_tasks" on tasks for update
  using (
    user_has_org_access(org_id)
    and (
      created_by = auth.uid()
      or user_org_role(org_id) in ('admin', 'project_manager')
    )
  );

create policy "delete_org_tasks" on tasks for delete
  using (
    user_has_org_access(org_id)
    and (
      created_by = auth.uid()
      or user_org_role(org_id) in ('admin', 'project_manager')
    )
  );
```

---

### 2. `app/actions/tasks.ts` — `getTasksData`

Add `currentUserRole` to the return value. Insert alongside the existing parallel queries:

```typescript
const { data: roleData } = await supabase.rpc("user_org_role", { org_id: org.id });

return {
  currentUserId: user.id,
  currentUserRole: (roleData ?? "estimator") as string,
  tasks: ...,
  projects: ...,
  members: ...,
};
```

---

### 3. `app/(protected)/orgs/[orgSlug]/planner/page.tsx`

Fetch role and derive `canWrite`. Pass both to `PlannerView`.

```typescript
const data = await getTasksData(params.orgSlug);
const canWrite = ["admin", "project_manager"].includes(data.currentUserRole ?? "");

<PlannerView
  ...existing props...
  canWrite={canWrite}
  currentUserRole={data.currentUserRole}
/>
```

---

### 4. `PlannerView` — `planner-view.tsx`

Add `canWrite: boolean` to the props type and destructuring.

**Gate the following on `canWrite`:**

| Element | Location | When `!canWrite` |
|---|---|---|
| "New task" button | Top bar | Hide entirely |
| `+` inline add button | Calendar day cells (`DroppableDay`) | Hide the button |
| `InlineDateAdd` form | Calendar day cells | Never open |
| Drag handles | `DraggableKanbanCard`, `DraggableCalendarChip`, `DraggableNoDateRow` | Render non-draggable static wrapper instead |
| Delete button | `KanbanCard`, `TaskListCard` | Hide |
| Title click-to-edit | `KanbanCard`, `TaskListCard` | Disable (`cursor-default`, no `onClick`) |
| Priority cycle button | `PriorityBadge` | Make non-interactive (`pointer-events-none`) |
| `DatePickerPopover` | All task cards | Disable `onChange` (pass no-op or read-only variant) |
| Project bar clicks | Banner layer `PopoverTrigger` | Disable (no pointer events) |
| Unscheduled project chips | Unscheduled panel | Hide set-dates popover trigger |

**Pass `canWrite` down to sub-components** that need it:
- `KanbanCard` — add `canWrite: boolean` prop
- `KanbanColumn` — thread through to `DraggableKanbanCard`
- `TaskListCard` — add `canWrite: boolean` prop
- `DroppableDay` — gate the `+` button and `InlineDateAdd` on `canWrite`

**For read-only users**, the planner should still show:
- All shared tasks (already handled by RLS)
- Project date bars (visible but not clickable)
- Date filters, search, tag filters (read-only filtering is fine)

---

### 5. Sharing Toggle — Task Cards

Add a lock/globe icon button to each task card in both the planner and the task drawer panel.

**In `KanbanCard` and `TaskListCard`:**

```tsx
import { Lock, Globe } from "lucide-react";

// In the meta/actions row:
{canWrite && (
  <button
    onClick={() => onShareToggle(!task.is_private)}  // flip is_private
    title={task.is_private ? "Private — click to share" : "Shared — click to make private"}
    className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
  >
    {task.is_private
      ? <Lock className="h-2.5 w-2.5" />
      : <Globe className="h-2.5 w-2.5 text-primary/60" />}
  </button>
)}
```

**Wire up `onShareToggle`** in `PlannerView`:

```typescript
async function handleShareToggle(task: Task, isPrivate: boolean) {
  setTasks(ts => ts.map(t => t.id === task.id ? { ...t, is_private: isPrivate } : t));
  try { await updateTask(task.id, { is_private: isPrivate }, orgSlug); }
  catch { setTasks(initialTasks); }
}
```

**In `updateTask` action** (`app/actions/tasks.ts`): `is_private` is already in the updates type — confirm it's included in the `Partial<{...}>` type (it is, from the existing code). No action changes needed.

**Visual distinction**: Shared tasks (globe icon) should be subtly distinguishable from private tasks on the calendar, e.g. a faint globe badge or slightly different opacity on the task chip.

---

### 6. Task Panel (`components/tasks/task-panel.tsx`)

The task panel (drawer) is accessed globally from the nav bar and is separate from the planner. Approach:

- **Keep it simple**: any org member can still create private tasks from the panel (personal task management). No role restriction here.
- **Add sharing toggle** to `TaskCard` inside the panel — same `Lock`/`Globe` button as above. Users can share their own tasks; the task then becomes visible on the org planner to all members.
- The panel already receives `orgSlug` from context — no changes needed to pass role through.

---

## Out of Scope for This Session

- Assigning tasks to specific members from the calendar (the field exists in DB but no UI)
- Notification when a task is shared or assigned
- Viewer-role-specific calendar (viewers are already read-only by this spec)

---

## File Change Summary

| File | Change type |
|---|---|
| `supabase/migrations/030_tasks_org_write.sql` | New — RLS update |
| `app/actions/tasks.ts` | Edit — add `currentUserRole` to `getTasksData` return |
| `app/(protected)/orgs/[orgSlug]/planner/page.tsx` | Edit — derive `canWrite`, pass to PlannerView |
| `app/(protected)/orgs/[orgSlug]/planner/planner-view.tsx` | Edit — `canWrite` prop + gate all write UI |
| `components/tasks/task-panel.tsx` | Edit — add sharing toggle to TaskCard |

No new DB columns, no new routes, no new server actions beyond what's noted.
