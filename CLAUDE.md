# Flooring Estimator — Project Rules for Claude Code

This file is read automatically alongside the global ~/.claude/CLAUDE.md.
These rules apply to ALL work in this codebase. Do not deviate without flagging
the exception and explaining why.

---

## Stack

- Framework: Next.js (App Router)
- Database: Supabase (PostgreSQL)
- Deployment: Vercel — region pinned to **syd1 (Sydney)**
- Supabase region: **ap-southeast-2 (Sydney)**
- Auth: Supabase SSR via middleware.ts
- Styling: Tailwind CSS + shadcn/ui (components.json)

---

## Performance Rules

These rules exist because the app makes frequent Supabase calls and every
unnecessary round-trip is felt by the user. Follow them on every new feature.

### 1. Always fetch in parallel — never sequentially

If a page or layout needs more than one independent piece of data, use
Promise.all. Sequential awaits are a bug.

```ts
// ✅ DO
const [org, user] = await Promise.all([getOrg(slug), getUser()])

// ❌ DON'T
const org = await getOrg(slug)
const user = await getUser()
```

### 2. Never use select("*")

Always specify only the columns the component actually renders.
Read the JSX first to see what's used, then write the select list.

```ts
// ✅ DO
.select("id, name, status, created_at")

// ❌ DON'T
.select("*")
```

### 3. Server Components by default — Client Components only when necessary

A component only needs `'use client'` if it uses:
- `useState` / `useEffect` / `useRef`
- Browser APIs
- Event handlers that update UI state

Fetching data is NOT a reason to add `'use client'`.

### 4. Keep Client Components as leaf nodes

Fetch data in a Server Component wrapper and pass it down as props.
Never let a Client Component reach directly to Supabase on mount.

```ts
// ✅ Pattern
// page.tsx (Server Component) — fetches everything
const data = await getData()
return <ClientForm initialData={data} />

// ClientForm.tsx ('use client') — receives props, handles interaction
```

### 5. Add Suspense boundaries on every page with multiple data fetches

Wrap independent sections in `<Suspense fallback={<Skeleton />}>` so fast UI
ships to the browser immediately while slow sections load in.
Never let the slowest query block the entire page render.
Always provide a skeleton fallback — not a spinner, not null.

### 6. Lazy-load heavy libraries with dynamic()

Any import over ~100KB that isn't needed on initial render must use
`dynamic()` with `ssr: false`.

Libraries already lazy-loaded in this project (do not revert):
- TipTap / @tiptap/react → SWMS editor
- PDF renderer → project detail page
- Konva / canvas → canvas route

Any new rich text editor, chart library, or canvas library must follow
the same pattern.

---

## Supabase Rules

### Use the connection pooler endpoint

The `SUPABASE_URL` in `.env` must use port **6543** with `?pgbouncer=true`
for all serverless Vercel functions. Direct connections (port 5432) will
exhaust connection limits under load.

### Never bypass RLS without explicit approval

When converting a client fetch to a server fetch, confirm that Supabase RLS
policies still apply. Use the anon/user client — not the service role client
— unless you have explicit sign-off and document why.

### Watch for sequential queries that could be a single RPC

If two queries are sequential because the second depends on the result of the
first, consider a Postgres RPC function to collapse them into one round-trip.
Flag this as a suggestion rather than implementing it without discussion.

---

## Caching Rules

Do not add caching speculatively. Only introduce `unstable_cache` or fetch
cache options when pointing to a specific, measured problem.

When you do cache:
- Add a comment explaining what is cached and why the TTL was chosen
- Use `revalidateTag` / `revalidatePath` for invalidation — never set
  `Cache-Control` headers manually unless you explain the exception
- Flag any user-specific or auth-gated data — it must use per-user cache
  keys and must never be shared across users

---

## Infrastructure — Do Not Change Without Discussion

- `vercel.json` regions must stay as `["syd1"]`
- Do not add `runtime = 'edge'` to any route without discussing it first —
  Edge Runtime has constraints with Supabase SSR that need evaluation
- Do not change the Supabase client configuration in `lib/` without flagging it

---

## Project Structure

```
app/
  (canvas)/         # Konva canvas routes — SSR disabled for canvas libs
  (print)/          # Print/PDF views
  (protected)/      # All authenticated routes — wrapped by auth layout
    orgs/[orgSlug]/ # Org-scoped routes (layout fetches org + user in parallel)
  actions/          # Server Actions for mutations
  api/              # API routes
  auth/             # Auth callback/confirm routes
components/         # Shared UI components (shadcn/ui base)
hooks/              # Client-side hooks
lib/                # Supabase clients, helpers, utils
middleware.ts       # Auth middleware — do not modify without care
supabase/           # DB migrations and types
```

---

## Pre-Shipping Checklist

Before marking any feature ready for review, confirm:

- [ ] No sequential awaits where `Promise.all` would work
- [ ] No `select("*")` queries — explicit column lists only
- [ ] No data fetched in `useEffect` that could be fetched server-side
- [ ] Any new library >100KB is lazy-loaded with `dynamic()`
- [ ] New pages with multiple data sections have `<Suspense>` boundaries
- [ ] No new Client Components fetching from Supabase directly
- [ ] RLS still applies correctly if fetch was moved server-side
- [ ] `vercel.json` region unchanged (syd1)
