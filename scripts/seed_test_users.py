#!/usr/bin/env python3
"""
Creates five test users — one per RBAC role — in the SPM & DFO Flooring org.

Prerequisites:
  - Migration 021_rbac_enhancement.sql must be applied to Supabase first.
    Paste the SQL into the Supabase SQL editor and run it before this script.

Usage:
  python3 scripts/seed_test_users.py

Re-running is safe: existing auth users are detected and reused; profile and
org membership are always updated to match the definitions below.

All accounts share the same password printed in the summary at the end.
"""

import json, os, sys, urllib.request, urllib.error

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ORG_ID       = "f9e488f8-08d8-4dd2-94b7-c0f525ec8528"   # SPM & DFO Flooring
PASSWORD     = "Floora#Test99"

# ── Test personas ──────────────────────────────────────────────────────────────
# Superadmin is also given org_role=admin so they satisfy org-membership SELECT
# policies (read access still requires org membership by design).
TEST_USERS = [
    {
        "email":        "alex.chen@floora.test",
        "display_name": "Alex Chen",
        "app_role":     "superadmin",
        "org_role":     "admin",
        "label":        "Platform Superadmin",
    },
    {
        "email":        "jordan.blake@floora.test",
        "display_name": "Jordan Blake",
        "app_role":     "user",
        "org_role":     "admin",
        "label":        "Org Admin",
    },
    {
        "email":        "sam.rivera@floora.test",
        "display_name": "Sam Rivera",
        "app_role":     "user",
        "org_role":     "project_manager",
        "label":        "Project Manager",
    },
    {
        "email":        "riley.nguyen@floora.test",
        "display_name": "Riley Nguyen",
        "app_role":     "user",
        "org_role":     "estimator",
        "label":        "Estimator",
    },
    {
        "email":        "morgan.lee@floora.test",
        "display_name": "Morgan Lee",
        "app_role":     "user",
        "org_role":     "viewer",
        "label":        "Viewer (read-only)",
    },
]


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _call(method, url, body=None, extra_prefer=None):
    data    = json.dumps(body).encode() if body else None
    prefer  = "return=representation"
    if extra_prefer:
        prefer = f"{extra_prefer},{prefer}"
    req = urllib.request.Request(url, data=data, method=method, headers={
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        prefer,
    })
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        return {"__error": e.code, "__body": e.read().decode()}


def rest(method, path, body=None, extra_prefer=None):
    return _call(method, f"{SUPABASE_URL}/rest/v1/{path}", body, extra_prefer)


def auth_admin(method, path, body=None):
    return _call(method, f"{SUPABASE_URL}/auth/v1/{path}", body)


def is_error(result):
    return isinstance(result, dict) and "__error" in result


def die(msg, result=None):
    print(f"\n  ERROR: {msg}")
    if result:
        print(f"  HTTP {result['__error']}: {result['__body']}")
    sys.exit(1)


# ── Pre-flight check ───────────────────────────────────────────────────────────

def check_migration_021():
    """Exit with a clear message if migration 021 hasn't been applied yet."""
    result = rest("GET", "profiles?select=app_role&limit=1")
    if is_error(result):
        body = result.get("__body", "")
        if "app_role" in body or "column" in body.lower():
            print()
            print("  ERROR: Migration 021_rbac_enhancement.sql has not been applied.")
            print()
            print("  Steps:")
            print("    1. Open supabase/migrations/021_rbac_enhancement.sql")
            print("    2. Paste the SQL into Supabase → SQL Editor")
            print("    3. Run it, then re-run this script.")
            print()
            sys.exit(1)
        die("Unexpected error checking profiles table", result)


# ── Core steps ─────────────────────────────────────────────────────────────────

def create_or_get_user(email):
    """Create user via Auth Admin API. Returns (user_id, created: bool)."""
    result = auth_admin("POST", "admin/users", {
        "email":         email,
        "password":      PASSWORD,
        "email_confirm": True,
    })

    if not is_error(result):
        return result["id"], True

    if result["__error"] == 422:
        # User already exists — find their ID in profiles (service key bypasses RLS)
        rows = rest("GET", f"profiles?email=eq.{email}&select=id")
        if not is_error(rows) and rows:
            return rows[0]["id"], False
        # Fallback: scan auth admin users list
        users = auth_admin("GET", "admin/users?per_page=200")
        if not is_error(users) and "users" in users:
            for u in users["users"]:
                if u.get("email") == email:
                    return u["id"], False

    die(f"Could not create or find user {email}", result)


def upsert_profile(user_id, email, display_name, app_role):
    result = rest("POST", "profiles", {
        "id":           user_id,
        "email":        email,
        "display_name": display_name,
        "app_role":     app_role,
    }, extra_prefer="resolution=merge-duplicates")
    if is_error(result):
        die(f"Profile upsert failed for {email}", result)


def upsert_org_member(user_id, org_role):
    # Delete first so re-runs update the role cleanly
    rest("DELETE", f"organization_members?organization_id=eq.{ORG_ID}&user_id=eq.{user_id}")
    result = rest("POST", "organization_members", {
        "organization_id": ORG_ID,
        "user_id":         user_id,
        "role":            org_role,
    })
    if is_error(result):
        die(f"Org member insert failed (role={org_role})", result)


def seed_user(u):
    user_id, created = create_or_get_user(u["email"])
    status = "created" if created else "already exists"
    print(f"    id:       {user_id}  [{status}]")

    upsert_profile(user_id, u["email"], u["display_name"], u["app_role"])
    print(f"    profile:  {u['display_name']}  /  app_role={u['app_role']}")

    upsert_org_member(user_id, u["org_role"])
    print(f"    org role: {u['org_role']}")

    return user_id


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print()
    print("── Pre-flight ──────────────────────────────────────────────────────")
    check_migration_021()
    print("  Migration 021 confirmed.")
    print()

    print("── Seeding test users ──────────────────────────────────────────────")
    print(f"  Org: SPM & DFO Flooring  ({ORG_ID})")
    print()

    results = []
    for u in TEST_USERS:
        print(f"  {u['label']} — {u['email']}")
        user_id = seed_user(u)
        results.append({**u, "id": user_id})
        print()

    print("── Summary ─────────────────────────────────────────────────────────")
    print()
    print(f"  Password (all accounts): {PASSWORD}")
    print()
    print(f"  {'Role':<24} {'Name':<18} Email")
    print(f"  {'─' * 24} {'─' * 18} {'─' * 32}")
    for r in results:
        print(f"  {r['label']:<24} {r['display_name']:<18} {r['email']}")
    print()
    print("  Sign in at: /login  (email + password — not Google OAuth)")
    print()


if __name__ == "__main__":
    main()
