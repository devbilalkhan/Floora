import { NextRequest } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

// In-memory rate limiter (per token hash, 10 req/min)
const rateLimits = new Map<string, { count: number; windowStart: number }>();

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
]);

const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function plain(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } });
}

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function checkRateLimit(hash: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(hash);
  if (!entry || now - entry.windowStart > 60_000) {
    rateLimits.set(hash, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

function parseTags(title: string): string[] {
  const matches = title.match(/@([\w-]+)/g) ?? [];
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase())));
}

interface ExtractedTask {
  title: string;
  project_name: string | null;
  assignee: string | null;
  due_date: string | null;
  priority: string;
  is_private: boolean;
  needs_review: boolean;
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI();
  const anthropic = new Anthropic();

  // ── 1. Parse multipart form ─────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return plain("Invalid request.", 400);
  }

  // ── 2. Token auth ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return plain("Invalid token. Check your Shortcut setup.", 401);
  }
  const rawToken = authHeader.slice(7).trim();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // ── 3. Audio validation ──────────────────────────────────────────────────────
  const audio = formData.get("audio");
  if (!audio || !(audio instanceof File) || audio.size === 0) {
    return plain("No audio received.", 400);
  }
  if (audio.size > 25 * 1024 * 1024) {
    return plain("Recording too long. Try a shorter memo.", 413);
  }
  const audioType = audio.type || "audio/mp4";
  if (!ALLOWED_AUDIO_TYPES.has(audioType)) {
    return plain("Unsupported audio format. Record as m4a or mp3.", 415);
  }

  // ── 4. Look up token ─────────────────────────────────────────────────────────
  const db = getDb();
  const { data: tokenRow } = await db
    .from("voice_tokens")
    .select("user_id, org_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!tokenRow) {
    return plain("Invalid token. Check your Shortcut setup.", 401);
  }

  // ── 5. Rate limit ────────────────────────────────────────────────────────────
  if (!checkRateLimit(tokenHash)) {
    return plain("Too many requests. Wait a moment and try again.", 429);
  }

  // ── 6. Role check + fetch org context (parallel) ─────────────────────────────
  const [memberResult, membersResult, projectsResult] = await Promise.all([
    db
      .from("organization_members")
      .select("role")
      .eq("organization_id", tokenRow.org_id)
      .eq("user_id", tokenRow.user_id)
      .maybeSingle(),
    db
      .from("organization_members")
      .select("user_id, profile:profiles!user_id(display_name)")
      .eq("organization_id", tokenRow.org_id),
    db
      .from("projects")
      .select("id, name")
      .eq("organization_id", tokenRow.org_id)
      .order("name"),
  ]);

  const role = memberResult.data?.role;
  if (role !== "admin" && role !== "project_manager") {
    return plain("Your account role can't create tasks this way.", 403);
  }

  // Update last_used (fire and forget — don't await)
  db.from("voice_tokens")
    .update({ last_used: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .then(() => {});

  type Member = { user_id: string; display_name: string };
  const members: Member[] = (membersResult.data ?? [])
    .map((m: any) => {
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      return { user_id: m.user_id as string, display_name: profile?.display_name as string | null };
    })
    .filter((m): m is Member => !!m.display_name);

  const projects = (projectsResult.data ?? []) as { id: string; name: string }[];

  // ── 7. Whisper transcription ─────────────────────────────────────────────────
  let transcript: string;
  try {
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const audioFile = new File([audioBuffer], audio.name || "recording.m4a", { type: audioType });

    transcript = await withTimeout(
      openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
        response_format: "text",
      }) as Promise<string>,
      25_000
    );
  } catch (err: any) {
    if (err.message === "timeout") return plain("Request timed out. Try again.", 504);
    console.error("Whisper error:", err);
    return plain("Transcription failed. Try again.", 502);
  }

  if (!transcript || transcript.trim().length < 3) {
    return plain("Could not hear anything in the recording. Please try again.", 400);
  }

  // ── 8. Claude extraction ─────────────────────────────────────────────────────
  const truncated = transcript.length > 4000 ? transcript.slice(0, 4000) : transcript;
  const today = new Date().toISOString().split("T")[0];
  const memberNames = members.map((m) => m.display_name).join(", ") || "none";
  const projectNames = projects.map((p) => p.name).join(", ") || "none";

  const systemPrompt = `You are a task extraction assistant for a flooring company.
Given a voice transcript, extract one or more tasks and return ONLY a JSON array.

Each task object must have:
  title        string   — the task description, written as an action
  project_name string | null  — project name mentioned, or null
  assignee     string | null  — person's name, or null
  due_date     string | null  — ISO date (YYYY-MM-DD), or null
  priority     "low" | "medium" | "high" | "urgent"  — default "medium"
  is_private   boolean  — true if the speaker says "for me" / "remind me", else false
  needs_review boolean  — true if any field is a guess with low confidence

Today's date is ${today}. Resolve relative dates ("next Monday", "end of week") to absolute ISO dates.
Org members: ${memberNames}
Projects: ${projectNames}

If the transcript contains multiple distinct tasks, return one object per task.
Never return prose. Return only the JSON array.${transcript.length > 4000 ? "\nNote: Transcript was truncated. Extract tasks from what is present." : ""}`;

  let extractedTasks: ExtractedTask[];
  try {
    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: truncated }],
      }),
      25_000
    );

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    extractedTasks = parsed;
  } catch (err: any) {
    if (err.message === "timeout") return plain("Request timed out. Try again.", 504);
    console.error("Claude error:", err);
    return plain("Could not parse tasks. Try again.", 502);
  }

  if (extractedTasks.length === 0) {
    return plain("No tasks found in your recording.");
  }

  // ── 9. Validate, fuzzy-match, build rows ─────────────────────────────────────
  const todayDate = today;

  const resolvedTasks = extractedTasks
    .filter((t) => t.title && typeof t.title === "string" && t.title.trim().length > 0)
    .filter((t) => VALID_PRIORITIES.has(t.priority) || (t.priority = "medium", true))
    .map((t) => {
      let needs_review = !!t.needs_review;
      let assigned_to: string | null = null;
      let project_id: string | null = null;

      if (t.assignee) {
        const q = t.assignee.toLowerCase();
        const hits = members.filter((m) => m.display_name.toLowerCase().includes(q));
        if (hits.length === 1) assigned_to = hits[0].user_id;
        else needs_review = true; // ambiguous or no match
      }

      if (t.project_name) {
        const q = t.project_name.toLowerCase();
        const hits = projects.filter((p) => p.name.toLowerCase().includes(q));
        if (hits.length === 1) project_id = hits[0].id;
        else needs_review = true;
      }

      if (t.due_date && t.due_date < todayDate) needs_review = true;

      const tags = [
        ...parseTags(t.title),
        "voice-import",
        ...(needs_review ? ["needs-review"] : []),
      ];

      return {
        org_id: tokenRow.org_id,
        title: t.title.trim(),
        tags,
        priority: t.priority as "low" | "medium" | "high" | "urgent",
        due_date: t.due_date || null,
        is_private: !!t.is_private,
        assigned_to,
        project_id,
        created_by: tokenRow.user_id,
        source: "voice" as const,
      };
    });

  if (resolvedTasks.length === 0) {
    return plain("Could not parse tasks. Try again.", 502);
  }

  // ── 10. Atomic batch insert ──────────────────────────────────────────────────
  const { error: insertError } = await db.from("tasks").insert(resolvedTasks);
  if (insertError) {
    console.error("Task insert error:", insertError);
    return plain(`Failed to save ${resolvedTasks.length} task(s). Please try again.`, 500);
  }

  // ── 11. Plain-text confirmation ──────────────────────────────────────────────
  const lines = resolvedTasks.map((t) => {
    const parts: string[] = [];
    if (t.due_date) {
      const d = new Date(t.due_date + "T00:00:00");
      parts.push(`due ${d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}`);
    }
    if (t.assigned_to) {
      const m = members.find((m) => m.user_id === t.assigned_to);
      if (m) parts.push(`assigned ${m.display_name}`);
    }
    if (t.tags.includes("needs-review")) parts.push("needs review");
    const meta = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    return `• "${t.title}"${meta}`;
  });

  return plain(
    `✓ ${resolvedTasks.length} task${resolvedTasks.length === 1 ? "" : "s"} created:\n${lines.join("\n")}`
  );
}
