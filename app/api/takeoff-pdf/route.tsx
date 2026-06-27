import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { TakeoffPdfDocument } from "@/components/pdf/takeoff-pdf-document";
import type { TakeoffRow } from "@/lib/takeoff-types";
import React from "react";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const orgSlug = searchParams.get("orgSlug");
  const takeoffIdsParam = searchParams.get("takeoffIds");
  if (!projectId || !orgSlug) return new Response("Missing params", { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [
    { data: project },
    { data: org },
    { data: profile },
    { data: takeoffList },
  ] = await Promise.all([
    supabase.from("projects").select("name, brand, location, head_client").eq("id", projectId).single(),
    supabase.from("organizations").select("name").eq("slug", orgSlug).single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("takeoffs").select("id").eq("project_id", projectId),
  ]);

  if (!project || !org) return new Response("Not found", { status: 404 });

  const allTakeoffIds = (takeoffList ?? []).map((t) => t.id as string);
  const allowedIds = takeoffIdsParam ? takeoffIdsParam.split(",") : null;
  const takeoffIds = allowedIds
    ? allTakeoffIds.filter((id) => allowedIds.includes(id))
    : allTakeoffIds;
  const { data: rawRows } = takeoffIds.length > 0
    ? await supabase.from("project_takeoff").select("id, takeoff_id, scope_category, finish_code, description, manufacturer, colour, location, level, product_type, qty, unit, waste_pct, notes, sort_order, parent_finish_code, cove_height_mm").in("takeoff_id", takeoffIds).order("scope_category").order("sort_order")
    : { data: [] };

  const packDate = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const buffer = await renderToBuffer(
    React.createElement(TakeoffPdfDocument, {
      projectName: project.name,
      projectLocation: project.location ?? "",
      orgName: org.name,
      headClient: project.head_client ?? undefined,
      brand: project.brand ?? "spm",
      packDate,
      preparedBy: profile?.display_name ?? user.email ?? "",
      rows: (rawRows ?? []) as TakeoffRow[],
    }) as React.ReactElement<any>
  );

  return new Response(Uint8Array.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="takeoff.pdf"`,
    },
  });
}
