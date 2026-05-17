import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Standard SSR client — use for auth checks and read queries in Server Components. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookie writes silently ignored
          }
        },
      },
    }
  );
}

/**
 * Validates the current user then returns a service-role Supabase client for
 * use in server actions. The service role bypasses RLS — security is enforced
 * at the application layer (getUser() validates the session before any DB op).
 *
 * Never expose this client or SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export async function createAuthedClient() {
  const base = createClient();
  const {
    data: { user },
  } = await base.auth.getUser();

  if (!user) redirect("/login");

  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  return { supabase: admin, user };
}
