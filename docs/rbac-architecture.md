# Role-Based Access Control — Architecture Reference

**App:** Floora Flooring Estimator  
**Migration:** `021_rbac_enhancement.sql`  
**Last updated:** 2026-05-19

---

## 1. Role Hierarchy

```
Platform Superadmin   ← app_role = 'superadmin' on profiles table
      │
      └── Org Admin   ┐
      └── PM          ├─ org_role on organization_members table
      └── Estimator   │
      └── Viewer      ┘
```

Roles are defined at two levels:

| Level | Column | Table | Values |
|---|---|---|---|
| Platform | `app_role` | `profiles` | `superadmin`, `user` |
| Organisation | `role` | `organization_members` | `admin`, `project_manager`, `estimator`, `viewer` |

A user can hold different org-level roles in different organisations. Their platform role is global.

---

## 2. Role Definitions

### Platform Superadmin
The platform owner (Floora administrator). Can do everything in the system including creating and deleting organisations. Bypasses all org-level role checks via `is_superadmin()`. Set directly in the `profiles` table — no UI flow needed.

### Org Admin
Full control within their organisation. Manages members, settings, projects, and estimates. Cannot create new organisations (superadmin only).

### Project Manager (PM)
Manages the commercial side of projects. Creates and prices estimates, sends price requests, manages workers and tasks. Cannot create or modify organisations or their membership.

### Estimator
Handles the measurement and documentation side. Creates projects, imports drawings, measures takeoffs, adds line items and markup notes to estimates, and prepares SWMS. Cannot create estimates (pricing documents) or send price requests.

### Viewer
Read-only access to all project data. Useful for clients, external auditors, or contractors who need visibility without edit rights. Cannot create or modify anything.

---

## 3. Permissions Table

✓ = full access &nbsp;&nbsp; R = read only &nbsp;&nbsp; — = no access

| Resource / Action | Superadmin | Org Admin | PM | Estimator | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| **ORGANISATIONS** | | | | | |
| Create org | ✓ | — | — | — | — |
| View org | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit org settings (name, ABN, email, signature) | ✓ | ✓ | — | — | — |
| Delete org | ✓ | — | — | — | — |
| **ORG MEMBERS** | | | | | |
| View member list | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invite / add member | ✓ | ✓ | — | — | — |
| Change member role | ✓ | ✓ | — | — | — |
| Remove member | ✓ | ✓ | — | — | — |
| **PROJECTS** | | | | | |
| Create project | ✓ | ✓ | ✓ | ✓ | — |
| View project | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit project details (name, client, notes) | ✓ | ✓ | ✓ | — | — |
| Archive project | ✓ | ✓ | ✓ | — | — |
| Delete project | ✓ | ✓ | — | — | — |
| **DRAWINGS / DOCUMENTS** | | | | | |
| Upload drawing | ✓ | ✓ | ✓ | ✓ | — |
| View drawing | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit drawing metadata | ✓ | ✓ | ✓ | ✓ | — |
| Delete drawing | ✓ | ✓ | ✓ | ✓ | — |
| **TAKEOFFS** | | | | | |
| Import takeoff | ✓ | ✓ | ✓ | ✓ | — |
| View takeoff | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit takeoff items (draw, measure, annotate) | ✓ | ✓ | ✓ | ✓ | — |
| Manual data entry on takeoff | ✓ | ✓ | ✓ | ✓ | — |
| Delete takeoff item | ✓ | ✓ | ✓ | ✓ | — |
| **ESTIMATES** | | | | | |
| Create estimate | ✓ | ✓ | ✓ | — | — |
| View estimate | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit pricing (rates, markups, overheads) | ✓ | ✓ | ✓ | — | — |
| Add / edit line items (quantities, notes) | ✓ | ✓ | ✓ | ✓ | — |
| Submit estimate for review | ✓ | ✓ | ✓ | — | — |
| Approve / reject estimate | ✓ | ✓ | — | — | — |
| Delete estimate | ✓ | ✓ | ✓ | — | — |
| **SWMS** | | | | | |
| Create / edit SWMS | ✓ | ✓ | ✓ | ✓ | — |
| View SWMS | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete SWMS | ✓ | ✓ | ✓ | ✓ | — |
| **PRICE REQUESTS** | | | | | |
| Create / send price request | ✓ | ✓ | ✓ | — | — |
| View price requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete price request | ✓ | ✓ | ✓ | — | — |
| **TASKS / PLANNER** | | | | | |
| Create task | ✓ | ✓ | ✓ | ✓ | — |
| View tasks | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update any task | ✓ | ✓ | ✓ | ✓ | — |
| Delete task | ✓ | ✓ | ✓ | — | — |
| **WORKERS** | | | | | |
| View workers | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add / edit / remove workers | ✓ | ✓ | ✓ | — | — |
| **ORG SETTINGS** | | | | | |
| View settings page | ✓ | ✓ | — | — | — |
| Edit settings | ✓ | ✓ | — | — | — |

---

## 4. Enforcement Layers

### Layer 1 — Supabase Row Level Security (RLS)
Primary enforcement. All policies live in `021_rbac_enhancement.sql`. Key helper functions:

| Function | Purpose |
|---|---|
| `is_superadmin()` | Returns true if calling user has `app_role = 'superadmin'` |
| `user_org_role(org_id)` | Returns the caller's `org_role` text for a given org |
| `user_project_role(proj_id)` | Returns the caller's role in the org that owns a project |
| `user_has_org_access(org_id)` | True if caller is any member of the org (including viewer) |
| `user_has_project_access(proj_id)` | True if caller is any member of the project's org |
| `user_has_project_write_access(proj_id)` | True if caller is a non-viewer member of the project's org |

### Layer 2 — Server Action / API Guards
RLS cannot block specific field-level changes within an UPDATE. The following transitions **must** also be enforced in server actions:

| Transition | Minimum role |
|---|---|
| Estimate status → `submitted` | `project_manager` |
| Estimate status → `approved` | `admin` |
| Estimate status → `rejected` | `admin` |

Pattern for server action guard:

```ts
const role = await getUserProjectRole(supabase, projectId);
if (!['admin', 'project_manager'].includes(role)) {
  throw new Error('Insufficient permissions');
}
```

### Layer 3 — UI Visibility
Components should hide controls the user cannot use (don't show "Create Estimate" to an estimator, don't show approve buttons to PMs). This is a UX concern — it does not replace layers 1 and 2.

---

## 5. What Changed from the Previous State

| Area | Before | After |
|---|---|---|
| Org creation | Any authenticated user | Superadmin only |
| Org update | Org admin only | Org admin or superadmin |
| Project creation | Admin + PM only | Admin + PM + **Estimator** |
| Estimate creation | Any org member | Admin + PM only |
| Estimate update | Any org member | Admin + PM only |
| Estimate delete | Any org member | Admin + PM only |
| Drawings write | Any org member | Any **non-viewer** org member |
| Takeoff items write | Any org member | Any **non-viewer** org member |
| Price request create | Any org member | Admin + PM only |
| Price request delete | Any org member | Admin + PM only |
| SWMS write | Any org member | Any **non-viewer** org member |
| Tasks delete | Any org member | Admin + PM only |
| Viewer role | Did not exist | **Added** |
| App superadmin | Did not exist | **Added** (`profiles.app_role`) |

---

## 6. How to Bootstrap a Superadmin

Run this in the Supabase SQL editor (or via a migration), substituting the user's UUID:

```sql
update profiles
set app_role = 'superadmin'
where id = '<user-uuid>';
```

To find a user's UUID:

```sql
select id, email from auth.users where email = 'your@email.com';
```

Only one superadmin is needed for the platform owner. Additional superadmins can be promoted the same way.

---

## 7. Adding a Viewer to an Org

```sql
insert into organization_members (organization_id, user_id, role)
values ('<org-id>', '<user-id>', 'viewer');
```

Or via the org settings UI (once the invite flow supports the viewer role).
