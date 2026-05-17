"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createDrawingRecord({
  projectId,
  drawingId,
  name,
  type,
  storagePath,
  mimeType,
  pageCount,
}: {
  projectId: string;
  drawingId: string;
  name: string;
  type: string;
  storagePath: string;
  mimeType: string;
  pageCount: number;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: drawingError } = await supabase.from("drawings").insert({
    id: drawingId,
    project_id: projectId,
    owner_id: user.id,
    name,
    type,
    storage_path: storagePath,
    mime_type: mimeType,
    page_count: pageCount,
  });

  if (drawingError) throw new Error(drawingError.message);

  const pages = Array.from({ length: pageCount }, (_, i) => ({
    drawing_id: drawingId,
    owner_id: user.id,
    page_number: i + 1,
  }));

  const { error: pagesError } = await supabase.from("drawing_pages").insert(pages);
  if (pagesError) throw new Error(pagesError.message);

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteDrawing(drawingId: string, projectId: string, storagePath: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.storage.from("drawings").remove([storagePath]);

  const { error } = await supabase
    .from("drawings")
    .delete()
    .eq("id", drawingId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}
