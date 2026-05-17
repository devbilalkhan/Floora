"use server";

import { revalidatePath } from "next/cache";
import { createAuthedClient } from "@/lib/supabase/server";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function friendlyError(msg: string): string {
  if (msg.includes("23505") || msg.includes("unique"))
    return "An organization with that name already exists.";
  if (msg.includes("JWT") || msg.includes("auth"))
    return "Your session has expired. Please log in again.";
  return "Something went wrong. Please try again.";
}

export async function createOrganization(formData: FormData) {
  const { supabase, user } = await createAuthedClient();

  const name = formData.get("name") as string;
  const slug = toSlug(name);

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, slug })
    .select("id, slug")
    .single();

  if (orgError) {
    console.error("[org insert]", orgError.code, orgError.message);
    throw new Error(friendlyError(orgError.message));
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "admin" });

  if (memberError) throw new Error(friendlyError(memberError.message));

  revalidatePath("/orgs");
  return { slug: org.slug };
}
