import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/orgs";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/orgs";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }

  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  if (user) {
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email },
      { onConflict: "id", ignoreDuplicates: true }
    );

    // Store Google refresh token so server actions can call Gmail API
    if (session?.provider_refresh_token) {
      await supabase.from("user_gmail_tokens").upsert(
        { user_id: user.id, refresh_token: session.provider_refresh_token, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }

    // Process pending org invites (use service role to bypass RLS)
    if (user.email) {
      const adminDb = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: pendingInvites } = await adminDb
        .from("org_invites")
        .select("id, org_id, role")
        .eq("email", user.email.toLowerCase())
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());

      if (pendingInvites && pendingInvites.length > 0) {
        for (const invite of pendingInvites) {
          await adminDb.from("organization_members").upsert(
            { organization_id: invite.org_id, user_id: user.id, role: invite.role },
            { onConflict: "organization_id,user_id", ignoreDuplicates: true }
          );
          await adminDb
            .from("org_invites")
            .update({ status: "accepted" })
            .eq("id", invite.id);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
