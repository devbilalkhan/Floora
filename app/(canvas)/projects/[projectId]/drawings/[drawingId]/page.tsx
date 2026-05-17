import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import type TakeoffCanvasComponent from "@/components/canvas/takeoff-canvas";

const TakeoffCanvas = dynamic(
  () => import("@/components/canvas/takeoff-canvas"),
  { ssr: false }
) as typeof TakeoffCanvasComponent;

export default async function CanvasPage({
  params,
}: {
  params: { projectId: string; drawingId: string };
}) {
  const supabase = createClient();

  const [{ data: drawing }, { data: project }, { data: pages }] = await Promise.all([
    supabase
      .from("drawings")
      .select("id, name, type, mime_type, page_count, storage_path")
      .eq("id", params.drawingId)
      .single(),
    supabase
      .from("projects")
      .select("id, name")
      .eq("id", params.projectId)
      .single(),
    supabase
      .from("drawing_pages")
      .select("id, page_number, scale_factor, scale_calibrated_at")
      .eq("drawing_id", params.drawingId)
      .order("page_number"),
  ]);

  if (!drawing || !project) notFound();

  const { data: signedData } = await supabase.storage
    .from("drawings")
    .createSignedUrl(drawing.storage_path, 3600);

  const signedUrl = signedData?.signedUrl ?? "";

  return (
    <TakeoffCanvas
      drawingId={drawing.id}
      drawingName={drawing.name}
      mimeType={drawing.mime_type}
      pageCount={drawing.page_count}
      signedUrl={signedUrl}
      projectId={project.id}
      projectName={project.name}
      initialPages={pages ?? []}
    />
  );
}
