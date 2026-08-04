# Spec: Split Google Login from Gmail Connect

## Problem

`handleGoogle()` in `app/login/login-form.tsx` requests Gmail + Contacts
scopes (`gmail.send`, `gmail.readonly`, `gmail.modify`,
`contacts.readonly`, `contacts.other.readonly`) at plain sign-in time, and
passes `prompt: "consent"` on every login. This means every user sees a
Gmail permissions screen just to log in, and — because these are
sensitive/restricted Google scopes — Google also shows an "unverified app"
warning page in front of it if the OAuth consent screen isn't verified.
Two extra screens, neither of which is actually from Supabase.

## Goal

Login with Google should only ever ask for `email` + `profile` (no
permission screen in the common case). Gmail access should be requested
separately, only when a user explicitly chooses to connect Gmail to send
emails from the app, using incremental authorization.

## Scope

Two flows:

1. **Login** (`app/login/login-form.tsx`) — Google OAuth, `email profile`
   scopes only, no `prompt: "consent"`.
2. **Connect Gmail** — a new, separate OAuth trigger requesting the Gmail
   + Contacts scopes with `access_type: "offline"` + `prompt: "consent"`
   (needed once, to get a refresh token), available only from inside the
   app to already-logged-in users, not from `/login`.

## Changes

### 1. `app/login/login-form.tsx`

In `handleGoogle()`, change `scopes` to just:

```ts
scopes: "email profile",
```

Remove `queryParams: { access_type: "offline", prompt: "consent" }`
entirely from this call — login doesn't need offline access.

### 2. New: "Connect Gmail" trigger

Add a reusable function/component (e.g. `lib/gmail-connect.ts` or a
`ConnectGmailButton` client component) that calls:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${location.origin}/auth/callback?next=<current path>`,
    scopes: [
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/contacts.readonly",
      "https://www.googleapis.com/auth/contacts.other.readonly",
    ].join(" "),
    queryParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
});
```

This re-authenticates the already-logged-in user through Google with the
broader scope set — `app/auth/callback/route.ts` already stores
`session.provider_refresh_token` into `user_gmail_tokens` on any
successful callback, so no callback changes are needed as long as `next`
still gets passed through and preserved (it already is, via the `next`
query param → `rawNext` → redirect).

Before requesting `gmail.modify`, confirm it's actually needed —
`gmail.send` + `gmail.readonly` already cover send/read; `gmail.modify`
is only required if `applyGmailLabel` (`lib/gmail.ts`) is actually used
in a live code path. If it isn't wired up yet, drop it from both scope
lists to shrink the consent screen. (Flag this to Bilal rather than
deciding silently — check call sites of `applyGmailLabel` /
`createGmailLabel` first.)

### 3. Replace "Sign in with Google" prompts that actually mean "Connect Gmail"

These four spots currently link to `/login` when Gmail isn't connected,
which is the wrong flow now (that page would just do a plain login and
never grant Gmail scopes). Point them at the new Connect Gmail
trigger instead, and update the copy from "Sign in with Google" to
"Connect Gmail":

- `app/(protected)/orgs/[orgSlug]/projects/[projectId]/price-requests/page.tsx` (~line 123-124)
- `app/(protected)/orgs/[orgSlug]/projects/[projectId]/price-requests/new/composer.tsx` (~line 466)
- `app/(protected)/orgs/[orgSlug]/projects/[projectId]/submission-pack/send/send-email-composer.tsx` (~line 555-558)
- `app/(protected)/orgs/[orgSlug]/projects/[projectId]/submission-pack/compose-modal.tsx` (~line 198, copy only — check if it's already a link or just text; make it a working "Connect Gmail" action if not)

Each of these currently gates on `!hasGmail` / "Gmail not connected" —
keep that gating logic, just swap the destination/action and label.

### 4. No DB/migration changes

`user_gmail_tokens` (see `supabase/migrations/015_price_requests.sql`)
and the callback's upsert logic are unaffected — same table, same
`provider_refresh_token` capture path, just triggered from a different
UI entry point.

### 5. Google Cloud Console (manual, not code)

Not something Claude Code can do, but note it in the PR description:
if the OAuth consent screen is still in "Testing" mode, add team members
as test users to skip the "unverified app" warning for them. For
production users, the consent screen needs to go through Google's
verification for the sensitive Gmail/Contacts scopes to avoid that
warning for everyone else.

## Testing checklist

- [ ] Fresh login via `/login` → Google → only an `email`/`profile`
      consent (or no screen at all, if already granted) → lands on
      `/orgs`.
- [ ] Logged-in user with no `user_gmail_tokens` row clicks "Connect
      Gmail" from price-requests / composer / send-email-composer /
      compose-modal → sees Gmail+Contacts consent screen once → row
      appears in `user_gmail_tokens` → `hasGmail` flips true in the UI.
- [ ] Sending a price request / submission email still works end to end
      after reconnecting (`refreshGoogleToken` + `sendGmailMessage*`
      unaffected).
- [ ] `scripts/seed_test_users.py` note about "not Google OAuth" still
      accurate — no change needed there.
