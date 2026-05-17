import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SCOPE_CATEGORIES = ["vinyl", "carpet", "wall_vinyl", "coving_skirting", "matting", "stairs", "transition", "other"] as const;
const UNITS = ["m2", "lm", "blm", "ea"] as const;
const LEVELS = ["B2", "B1", "GF", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"] as const;

export async function POST(req: NextRequest) {
  try {
    const { sheets, fileName } = await req.json();

    if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
      return NextResponse.json({ error: "No sheet data provided" }, { status: 400 });
    }

    // Build combined sheet content for the prompt
    const sheetContent = sheets
      .map((s: { name: string; csv: string }) => `=== SHEET: ${s.name} ===\n${s.csv}`)
      .join("\n\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      tools: [
        {
          name: "extract_takeoff",
          description: "Extract structured flooring takeoff data from a Bill of Quantities spreadsheet",
          input_schema: {
            type: "object" as const,
            properties: {
              project_name: {
                type: "string",
                description: "Project name from the 'Project:' header row (e.g. 'PPS Stream 4 Newcastle')",
              },
              project_address: {
                type: "string",
                description: "Full address from the 'Address:' header row",
              },
              specifier_name: {
                type: "string",
                description: "Architect or specifier name from the Supply Summary sheet 'Architect:' row, if present",
              },
              takeoff_name: {
                type: "string",
                description: "A concise name for this takeoff. Use the project name if it is a single-site project. If the spreadsheet covers multiple sub-projects (e.g. numbered schools like '1. BOORAGUL'), use the project name as the takeoff name — each sub-project location will appear in the location field of each row.",
              },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    scope_category: {
                      type: "string",
                      enum: [...SCOPE_CATEGORIES],
                      description: `Map from the section header above each item:
- CARPET FLOORING / CARPET TILES → carpet
- VINYL FLOORING / VINYL FLOORINGS → vinyl
- VINYL COVINGS / SKIRTINGS/COVINGS → coving_skirting
- WALL VINYL / WALL VINYLS / WALL FINISHES (WF: codes) → wall_vinyl
- FLOOR TRANSITIONS / TRANSITIONS → transition
- ENTRY MAT / ENTRY MATS → matting
- STAIRS / NOSINGS → stairs
- ACOUSTIC PANELS / TIMBER FLOORING / FLOOR PROTECTION → other`,
                    },
                    finish_code: {
                      type: "string",
                      description: `Extract the finish code from the START of the description field. Common patterns:
- Starts with a code like: CP-01, VYL-01, FF:01, FF:02D, FLCP-007, FLVY-007, MAT1, EM-01, WF:13D, SK:02, SK:03, AB, AP1, TM1
- The code is typically the first word/token before a space or newline
- If no code is present, generate one with the SPM- prefix:
  * Floor transitions → SPM-TR
  * Vinyl covings/skirtings → SPM-CV
  * Entry matting (no code) → SPM-MAT
  * Wall vinyl (no code) → SPM-WV
  * Generic vinyl floor (no code) → SPM-VY
  * Generic carpet (no code) → SPM-CP
  * Other → SPM-OT`,
                    },
                    description: {
                      type: "string",
                      description: "The product type and full spec description, WITHOUT the leading finish code. For multi-line descriptions (with \\n), extract the first line (product type). E.g. 'carpet tiles, Interface Upon Common Ground – Escarpment, HERITAGE OPTION 1' or 'vinyl flooring, Polyflor Forest FX PUR, Colour Classic Oak 3100, Slip Rating R10'",
                    },
                    manufacturer: {
                      type: "string",
                      description: "Supplier/manufacturer name. For multi-line descriptions look for the 'Supplier:' line (e.g. 'Interface', 'Armstrong Flooring', 'Birrus Matting', 'Polyflor'). For single-line descriptions, identify the brand name embedded in the description.",
                    },
                    colour: {
                      type: "string",
                      description: "Colour name/code. For multi-line descriptions look for 'Colour:' or 'Colourway:' line. For single-line descriptions, extract the colour mentioned (e.g. 'Camden Grey', 'Classic Oak 3100', 'Bilby', 'Desert').",
                    },
                    location: {
                      type: "string",
                      description: "For multi-site spreadsheets (e.g. PPS with numbered schools like '1. BOORAGUL', '2. CESSNOCK'), use the school/sub-project name as the location for all rows beneath that heading. For single-site projects, leave blank unless a specific room/area is mentioned.",
                    },
                    level: {
                      type: "string",
                      enum: [...LEVELS],
                      description: "Floor level if mentioned (B2, B1, GF, L1–L10). Usually not specified; leave blank.",
                    },
                    qty: {
                      type: "number",
                      description: "Quantity value from the QTY column. Must be greater than 0.",
                    },
                    unit: {
                      type: "string",
                      enum: [...UNITS],
                      description: `Map from the UNIT column:
- m2 → m2
- m → lm (all linear measurements use 'm' in these spreadsheets, map to 'lm')
- Broadloom carpet (CP3, 4M roll width mentioned, or 'broadloom' in description) → blm
- ea / each / no. → ea`,
                    },
                    waste_pct: {
                      type: "number",
                      description: "Waste percentage. Default 10 unless specified. The Supply Summary sheet may show '10% wastage added' confirming the default.",
                    },
                    notes: {
                      type: "string",
                      description: "Drawing reference from DWG. NO. column, or any spec notes (slip rating, LRV, fire rating, lead time). Keep concise.",
                    },
                  },
                  required: ["scope_category", "qty", "unit"],
                },
              },
            },
            required: ["project_name", "takeoff_name", "rows"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_takeoff" },
      messages: [
        {
          role: "user",
          content: `You are an expert flooring estimator's assistant for SPM / DFO Flooring, an Australian commercial flooring company.

Analyse this Bill of Quantities (BoQ) spreadsheet and extract all flooring takeoff line items.

## SPREADSHEET STRUCTURE

The "Detailed Estimate" sheet has these columns:
  Col A: SR# (row number — blank for header/section rows)
  Col B: DWG. NO. (drawing reference)
  Col C: DETAIL NO. (e.g. "Finishes Schedule")
  Col D: DESCRIPTION (product description, sometimes multi-line with \\n)
  Col E: QTY
  Col F: UNIT

Header block (rows 1–7):
  Row 1: "Project: {name}"
  Row 2: "Address: {address}"
  Row 3: Submission date
  Row 4: Plan/revision date
  Row 5: Scope of Work
  Row 6: TOTAL BASE BID (summary — skip)
  Row 7: Column headers — skip

The "Supply Summary" sheet has the architect/specifier name in row 3: "Architect: {name}"

## ROW TYPES

1. **Section category header** — Col A is blank, Col D is a category name in ALL CAPS (e.g. "CARPET FLOORING", "VINYL COVINGS", "FLOOR TRANSITIONS"). These set the scope_category context for the rows below. Do NOT extract as a row.

2. **Sub-project header** — Col A is blank, Col D is a numbered name (e.g. "1. BOORAGUL", "2. CESSNOCK"). These set the location context for rows below. Do NOT extract as a row.

3. **Data row** — Col A has a number (SR#). EXTRACT these as takeoff rows.

4. **Total/summary row** — Col A is blank, Col D starts with "Total" or "TOTAL", or says "floor protection" / "Rambord". SKIP these.

5. **Non-flooring sections** — ACOUSTIC WALL PANELS, TIMBER FLOORING, FLOOR PROTECTION. Map to scope "other" or skip entirely.

## MULTI-LINE DESCRIPTIONS

Many descriptions use \\n to pack multiple fields:
  Line 1: "{CODE} {product type}"
  Line 2: "Range: {range name}"
  Line 3: "Colourway: {colour}" or "Colour: {colour}"
  Line 4: "Code: {product code}"
  Line 5: "Size: {dimensions}"
  Line 6: "Supplier: {manufacturer}"

Parse these carefully — extract finish_code from line 1 prefix, manufacturer from Supplier line, colour from Colour/Colourway line.

## UNIT MAPPING

- "m2" → m2
- "m" → lm (these spreadsheets always use "m" for linear metres)
- Broadloom carpet (roll width mentioned, or "broadloom" in description) → blm
- "ea", "no." → ea

## FILENAME

${fileName || ""}

---

${sheetContent}`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Extraction failed — no tool response" }, { status: 500 });
    }

    return NextResponse.json(toolUse.input);
  } catch (err) {
    console.error("extract-takeoff error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
