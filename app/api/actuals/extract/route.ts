import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// ── Constants ──────────────────────────────────────────────────────────────────

const VISION_MODEL = "claude-sonnet-5";
const SPREADSHEET_MODEL = "claude-haiku-4-5-20251001";

// Strict whitelist — never accept arbitrary MIME types
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

const VISION_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ~27 MB base64 = 20 MB binary
const MAX_BASE64_LEN = 28_000_000;

// ── Default prompts ────────────────────────────────────────────────────────────

const VISION_PROMPT = `You are an invoice data extraction assistant for a commercial flooring company.
Extract every line item from this invoice.
Return a JSON array with this exact shape — nothing else, no explanation, no markdown fences:
[
  {
    "invoice_date": "YYYY-MM-DD or null",
    "invoice_number": "string or null",
    "supplier": "string or null",
    "description": "string",
    "qty": number or null,
    "unit_price": number or null,
    "subtotal": number
  }
]
Rules:
- All monetary amounts must be EXCLUDING GST (10% Australian GST). If the invoice shows inc-GST amounts, divide by 1.1 before returning.
- If qty and unit_price are both present, subtotal = qty × unit_price.
- If only a lump-sum line (no qty/unit_price), set qty and unit_price to null and put the amount in subtotal.
- invoice_date: convert any Australian date format (DD/MM/YYYY) to ISO (YYYY-MM-DD).
- invoice_number: use the invoice/reference number printed on the document. If multiple, use the invoice number.
- supplier: the company or business name issuing the invoice (e.g. "Carpet Court", "Dunlop Flooring"). Use the same value for every line on the same invoice.
- description: the line item description as printed. Keep it concise.
- Do not invent data. If a field is not on the invoice, return null.
- Do not include GST line items as separate rows.`;

const SPREADSHEET_PROMPT = `You are an invoice data extraction assistant for a commercial flooring company.
The following is CSV data from an invoice or expense spreadsheet.
Extract every line item that represents a billable item, cost, or expense.
Ignore header rows, summary rows, totals rows, and blank rows.
Return a JSON array with this exact shape — nothing else, no explanation, no markdown fences:
[
  {
    "invoice_date": "YYYY-MM-DD or null",
    "invoice_number": "string or null",
    "supplier": "string or null",
    "description": "string",
    "qty": number or null,
    "unit_price": number or null,
    "subtotal": number
  }
]
Rules:
- All monetary amounts must be EXCLUDING GST (10% Australian GST). If any column label contains "inc GST" or "incl GST", divide those values by 1.1.
- If both qty and unit_price columns exist and are populated, set subtotal = qty × unit_price.
- invoice_date: convert any Australian date format (DD/MM/YYYY) to ISO (YYYY-MM-DD).
- invoice_number: look for columns named "Invoice No", "Inv #", "Reference", "Ref No".
- supplier: look for columns named "Supplier", "Vendor", "Company", "From". If none, return null.
- description: use the most descriptive column available (Description, Item, Details).
- If a row has no description and no subtotal, skip it.
- Do not invent data. If a field is not present, return null.`;

// ── Types ──────────────────────────────────────────────────────────────────────

type ExtractedLine = {
  invoice_date: string | null;
  invoice_number: string | null;
  supplier: string | null;
  description: string;
  qty: number | null;
  unit_price: number | null;
  subtotal: number;
};

type RequestBody = {
  file_base64?: string;
  structured_text?: string;
  file_name?: string;
  file_mime_type?: string;
  type?: string;
  org_id?: string;
  project_id?: string;
  group_id?: string | null;
};

// Structured outputs schema — constrains the model to return only a valid
// JSON array matching this shape, so it can't reply with prose instead.
const LINE_ITEMS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      invoice_date: { type: ["string", "null"] },
      invoice_number: { type: ["string", "null"] },
      supplier: { type: ["string", "null"] },
      description: { type: "string" },
      qty: { type: ["number", "null"] },
      unit_price: { type: ["number", "null"] },
      subtotal: { type: "number" },
    },
    required: [
      "invoice_date",
      "invoice_number",
      "supplier",
      "description",
      "qty",
      "unit_price",
      "subtotal",
    ],
    additionalProperties: false,
  },
};

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Authentication (server-validated, not just JWT) ────────────────────────
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    file_base64,
    structured_text,
    file_name,
    file_mime_type,
    type: invoiceType,
    org_id,
    project_id,
    group_id,
  } = body;

  // ── Input validation ───────────────────────────────────────────────────────
  if (!project_id || !UUID_RE.test(project_id)) {
    return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });
  }
  if (!org_id || !UUID_RE.test(org_id)) {
    return NextResponse.json({ error: "Invalid org_id" }, { status: 400 });
  }
  if (group_id != null && !UUID_RE.test(group_id)) {
    return NextResponse.json({ error: "Invalid group_id" }, { status: 400 });
  }
  if (invoiceType !== "income" && invoiceType !== "expense") {
    return NextResponse.json({ error: "Invalid invoice type" }, { status: 400 });
  }
  if (!file_mime_type || !ALLOWED_MIME.has(file_mime_type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (!file_name || typeof file_name !== "string" || file_name.trim() === "") {
    return NextResponse.json({ error: "file_name is required" }, { status: 400 });
  }
  if (!file_base64 && !structured_text) {
    return NextResponse.json(
      { error: "file_base64 or structured_text is required" },
      { status: 400 }
    );
  }
  if (file_base64 && file_base64.length > MAX_BASE64_LEN) {
    return NextResponse.json({ error: "File too large — max 20 MB" }, { status: 413 });
  }

  // ── Role check (admin or project_manager only) ─────────────────────────────
  const { data: role } = await supabase.rpc("user_project_role", {
    proj_id: project_id,
  });
  if (!["admin", "project_manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Fetch org-level custom prompt (falls back to defaults if not set) ───────
  const { data: promptConfig } = await supabase
    .from("actuals_prompt_config")
    .select("income_system_prompt, expense_system_prompt")
    .eq("org_id", org_id)
    .maybeSingle();

  const isSpreadsheet = !VISION_MIME.has(file_mime_type);
  const systemPrompt = isSpreadsheet
    ? SPREADSHEET_PROMPT
    : (invoiceType === "income"
        ? (promptConfig?.income_system_prompt ?? VISION_PROMPT)
        : (promptConfig?.expense_system_prompt ?? VISION_PROMPT));

  // ── Claude API call ────────────────────────────────────────────────────────
  const anthropic = new Anthropic();
  let lines: ExtractedLine[] = [];
  let runStatus: "completed" | "failed" = "completed";
  let errorMessage: string | null = null;
  let rawResponse: unknown = null;

  try {
    let response: Anthropic.Message;

    if (!isSpreadsheet && file_base64) {
      // Vision pathway — image or PDF
      type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      // Use `any` for the content block — the PDF document block type is not yet
      // exported in all SDK versions, but the API accepts it at runtime.
      const contentBlock: any =
        file_mime_type === "application/pdf"
          ? {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: file_base64 },
            }
          : {
              type: "image",
              source: {
                type: "base64",
                media_type: file_mime_type.replace("image/jpg", "image/jpeg") as ImageMediaType,
                data: file_base64,
              },
            };

      response = (await anthropic.messages.create({
        model: VISION_MODEL,
        max_tokens: 4096,
        thinking: { type: "disabled" },
        system: systemPrompt,
        messages: [{ role: "user", content: [contentBlock] }],
        output_config: { format: { type: "json_schema", schema: LINE_ITEMS_SCHEMA } },
      })) as Anthropic.Message;
    } else {
      // Spreadsheet pathway — CSV/structured text
      response = (await anthropic.messages.create({
        model: SPREADSHEET_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Invoice data:\n\n${structured_text ?? file_base64}`,
          },
        ],
        output_config: { format: { type: "json_schema", schema: LINE_ITEMS_SCHEMA } },
      })) as Anthropic.Message;
    }

    rawResponse = response;

    // Extract text, strip markdown code fences if present
    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed: unknown = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error("Response was not a JSON array");

    lines = parsed
      .filter(
        (r): r is Record<string, unknown> =>
          r !== null && typeof r === "object" && typeof r.description === "string"
      )
      .map((r) => ({
        invoice_date:
          typeof r.invoice_date === "string" && r.invoice_date ? r.invoice_date : null,
        invoice_number:
          typeof r.invoice_number === "string" && r.invoice_number
            ? r.invoice_number
            : null,
        supplier:
          typeof r.supplier === "string" && r.supplier ? r.supplier : null,
        description: (r.description as string).trim(),
        qty: typeof r.qty === "number" && !isNaN(r.qty) ? r.qty : null,
        unit_price:
          typeof r.unit_price === "number" && !isNaN(r.unit_price) ? r.unit_price : null,
        subtotal:
          typeof r.subtotal === "number" && !isNaN(r.subtotal) ? r.subtotal : 0,
      }))
      .filter((l) => l.description.length > 0);
  } catch (err) {
    runStatus = "failed";
    console.error("[actuals/extract] Claude error:", err);
    if (err instanceof SyntaxError) {
      // Claude returned prose instead of JSON — file was unreadable or not an invoice
      errorMessage =
        "Claude could not extract structured data from this file. " +
        "The file may be a scanned image that is too blurry, password-protected, or does not contain a recognisable invoice. " +
        "Try a clearer photo or a searchable PDF, or add lines manually.";
    } else {
      errorMessage =
        err instanceof Error && err.message.length < 200 ? err.message : "Extraction failed";
    }
  }

  // ── Always log the extraction run (audit trail) ────────────────────────────
  const { data: run } = await supabase
    .from("extraction_runs")
    .insert({
      project_id,
      owner_id: user.id,
      group_id: group_id ?? null,
      file_name: file_name.slice(0, 255),
      file_mime_type,
      prompt_used: systemPrompt,
      raw_response: rawResponse as object,
      line_items_extracted: lines.length,
      status: runStatus,
      error_message: errorMessage,
    })
    .select("id")
    .single();

  if (runStatus === "failed") {
    return NextResponse.json({ error: errorMessage }, { status: 422 });
  }

  return NextResponse.json({ run_id: run?.id ?? null, lines });
}
