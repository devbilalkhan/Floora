import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { projectName, estimateId, userPrompt } = await req.json();

    if (!estimateId) {
      return NextResponse.json({ error: "Missing estimateId" }, { status: 400 });
    }

    const { data: rawItems } = await supabase
      .from("estimate_items")
      .select("scope_category, finish_code, description, qty, unit, type")
      .eq("estimate_id", estimateId)
      .eq("type", "primary")
      .order("sort_order");

    const items = rawItems ?? [];

    const itemSummary = items
      .map((item) => {
        const parts = [item.scope_category.replace(/_/g, " ")];
        if (item.finish_code) parts.push(`(${item.finish_code})`);
        if (item.description) parts.push(`- ${item.description}`);
        parts.push(`${item.qty} ${item.unit}`);
        return parts.join(" ");
      })
      .join("\n");

    const promptAdditions = userPrompt
      ? `\n\nThe client has also requested the following adjustments — incorporate these naturally into the scope:\n${userPrompt}`
      : "";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `You are an expert commercial flooring estimator and contract administrator specialising in Australian commercial flooring projects.

You are writing the "Scope of Works" section for a professional flooring installation quote for project "${projectName}".

Based on these estimate line items:
${itemSummary}${promptAdditions}

Write a concise, professional Scope of Works in email style for a builder/client.

Requirements:

* Begin with a short opening paragraph:

  * Start with: "Hi {{Builder Name}} Team,"
  * Thank them for the opportunity to provide pricing or submit the proposal.
  * Keep the tone professional, clear, and friendly.

* The main scope must be written ONLY as bullet points.

* Every bullet point must:

  * Start with "• "
  * End with a full stop.
  * Be client-friendly and easy to understand.
  * Avoid internal notes or estimator jargon.
  * Clearly describe the works being carried out.
  * Mention relevant areas, materials, finishes, and accessories where applicable.
  * Start with "Supply and install" where appropriate.

Specific flooring rules:

* For vinyl sheet flooring:

  * Always include: "including feather finish and adhesives."
  * If matching coving is included, also state:

    * coving height,
    * contact adhesive,
    * coved fillet.
  * Example wording:
    "including 100mm high coving, contact adhesive, coved fillet, feather finish and adhesives."

* For carpet tiles:

  * Always include: "including adhesives."

* If product codes are available:

  * Include the product code naturally within the sentence.

* Use clean commercial wording suitable for quotations, tenders, and scope clarifications.

* After the bullet points, finish with a short professional closing paragraph expressing appreciation and willingness to assist further.

Output format rules:

* Do not use headings.
* Do not use numbering.
* Do not use markdown.
* Keep formatting clean and ready to paste into an email or quotation.`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ summary: text });
  } catch (err) {
    console.error("Quote summary error:", err);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 },
    );
  }
}
