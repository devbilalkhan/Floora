"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAuthedClient } from "@/lib/supabase/server";

function friendlyError(msg: string): string {
  if (msg.includes("JWT") || msg.includes("auth"))
    return "Your session has expired. Please log in again.";
  return msg;
}

async function requireProjectManagerRole(projectId: string) {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_project_role", { proj_id: projectId });
  if (!["admin", "project_manager"].includes(role ?? "")) {
    throw new Error("You don't have permission to do this.");
  }
}

export async function createEstimate(
  projectId: string,
  orgSlug: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireProjectManagerRole(projectId);
  const { supabase, user } = await createAuthedClient();

  const sourceId = (formData.get("source_takeoff_id") as string) || null;

  const { data, error } = await supabase
    .from("estimates")
    .insert({
      project_id: projectId,
      created_by: user.id,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      status: "draft",
      source_takeoff_id: sourceId,
    })
    .select("id")
    .single();

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  return { id: data.id };
}

export async function renameProject(
  projectId: string,
  orgSlug: string,
  name: string
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("projects")
    .update({ name })
    .eq("id", projectId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/orgs/${orgSlug}/projects`);
}

export async function updateProjectDetails(
  projectId: string,
  orgSlug: string,
  details: {
    name?: string;
    location: string | null;
    head_client: string | null;
    specifier: string | null;
    contact_person: string | null;
    notes: string | null;
    retention_pct: number | null;
  }
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("projects")
    .update(details)
    .eq("id", projectId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/orgs/${orgSlug}/projects`);
}

const DOCS_BUCKET = "project-documents";

async function ensureDocsBucket(supabase: Awaited<ReturnType<typeof createAuthedClient>>["supabase"]) {
  await supabase.storage.createBucket(DOCS_BUCKET, { public: false });
  // createBucket errors if the bucket already exists — that's fine, ignore it
}

export async function uploadProjectDocument(
  projectId: string,
  orgSlug: string,
  formData: FormData
): Promise<{ id: string; name: string; size_bytes: number | null; created_at: string }> {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_project_role", { proj_id: projectId });
  if (!role || role === "viewer") throw new Error("You don't have permission to upload documents.");

  const { supabase, user } = await createAuthedClient();

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided.");

  const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("File type not allowed. Upload a PDF, image, or Excel file.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("File too large. Maximum size is 20 MB.");
  }

  await ensureDocsBucket(supabase);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/${Date.now()}-${safeName}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/pdf" });
  if (uploadError) throw new Error(uploadError.message);

  const displayName = file.name.replace(/\.[^/.]+$/, "");
  const { data: doc, error: dbError } = await supabase
    .from("project_documents")
    .insert({
      project_id: projectId,
      name: displayName,
      storage_path: path,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      created_by: user.id,
    })
    .select("id, name, size_bytes, created_at")
    .single();
  if (dbError) throw new Error(dbError.message);

  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/takeoff`);
  return doc;
}

export async function getProjectDocumentUrl(docId: string, projectId: string): Promise<string> {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_project_role", { proj_id: projectId });
  if (!role) throw new Error("Access denied.");

  const { data: doc } = await userDb
    .from("project_documents")
    .select("storage_path")
    .eq("id", docId)
    .single();
  if (!doc) throw new Error("Document not found.");

  const { supabase } = await createAuthedClient();
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(doc.storage_path, 3600);
  if (error || !data?.signedUrl) throw new Error("Failed to generate document URL.");
  return data.signedUrl;
}

export async function deleteProjectDocument(
  docId: string,
  projectId: string,
  orgSlug: string
): Promise<void> {
  const userDb = createClient();
  const { data: role } = await userDb.rpc("user_project_role", { proj_id: projectId });
  if (!role) throw new Error("Access denied.");

  const { data: doc } = await userDb
    .from("project_documents")
    .select("storage_path, created_by")
    .eq("id", docId)
    .single();
  if (!doc) throw new Error("Document not found.");

  const { supabase, user } = await createAuthedClient();
  const canDelete =
    ["admin", "project_manager"].includes(role) || doc.created_by === user.id;
  if (!canDelete) throw new Error("You don't have permission to delete this document.");

  await supabase.storage.from(DOCS_BUCKET).remove([doc.storage_path]);
  await supabase.from("project_documents").delete().eq("id", docId);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}/takeoff`);
}

export async function renameEstimate(
  estimateId: string,
  projectId: string,
  orgSlug: string,
  name: string
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("estimates")
    .update({ name })
    .eq("id", estimateId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}

export async function deleteEstimate(
  estimateId: string,
  projectId: string,
  orgSlug: string
) {
  await requireProjectManagerRole(projectId);
  const { supabase } = await createAuthedClient();

  const { error } = await supabase
    .from("estimates")
    .delete()
    .eq("id", estimateId);

  if (error) throw new Error(friendlyError(error.message));
  revalidatePath(`/orgs/${orgSlug}/projects/${projectId}`);
}
