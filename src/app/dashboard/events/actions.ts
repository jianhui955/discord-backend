"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/events";

export async function updateEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!id) return { error: "缺少活动 id。" };
  if (!title) return { error: "活动标题不能为空。" };
  if (!content) return { error: "活动内容不能为空。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event")
    .update({ title, content })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("event_guild").delete().eq("event_id", id);
  await supabase.from("event").delete().eq("id", id);

  revalidatePath(REVALIDATE_PATH);
}
