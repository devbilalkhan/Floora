import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshGoogleToken } from "@/lib/gmail";

type Contact = { name: string; email: string };

function parseResults(results: any[]): Contact[] {
  return results.flatMap((r: any) => {
    const name = r.person?.names?.[0]?.displayName ?? "";
    return (r.person?.emailAddresses ?? []).map((e: any) => ({
      name,
      email: e.value as string,
    }));
  }).filter((c: Contact) => Boolean(c.email));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ contacts: [] });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ contacts: [] }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    console.error("[contacts] no gmail token for user", user.id);
    return NextResponse.json({ contacts: [] });
  }

  try {
    const accessToken = await refreshGoogleToken(tokenRow.refresh_token);
    const encoded = encodeURIComponent(q);

    // Search personal contacts and other contacts (auto-saved) in parallel
    const [personalRes, otherRes] = await Promise.all([
      fetch(
        `https://people.googleapis.com/v1/people:searchContacts?query=${encoded}&readMask=names,emailAddresses&pageSize=7`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ),
      fetch(
        `https://people.googleapis.com/v1/otherContacts:search?query=${encoded}&readMask=names,emailAddresses&pageSize=7`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ),
    ]);

    const [personalData, otherData] = await Promise.all([
      personalRes.ok ? personalRes.json() : Promise.resolve({ results: [] }),
      otherRes.ok ? otherRes.json() : Promise.resolve({ results: [] }),
    ]);

    if (!personalRes.ok) console.error("[contacts] searchContacts error", await personalRes.text().catch(() => ""));
    if (!otherRes.ok) console.error("[contacts] otherContacts error", await otherRes.text().catch(() => ""));

    // Merge and dedupe by email
    const all = [
      ...parseResults(personalData.results ?? []),
      ...parseResults(otherData.results ?? []),
    ];
    const seen = new Set<string>();
    const contacts = all.filter((c) => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });

    return NextResponse.json({ contacts });
  } catch (err) {
    console.error("[contacts] error", err);
    return NextResponse.json({ contacts: [] });
  }
}
