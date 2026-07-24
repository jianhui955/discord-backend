"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BIRTHDAY_EVENT_CODE } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/birthday-reminders";

export async function toggleBirthdayRemind(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const remind = formData.get("remind") === "true";

  const supabase = await createClient();

  // 保留已有 channel_id，避免开关时被覆盖掉
  const { data: existing } = await supabase
    .from("event_remind")
    .select("channel_id")
    .eq("event_code", BIRTHDAY_EVENT_CODE)
    .maybeSingle();

  const { error } = await supabase.from("event_remind").upsert(
    {
      event_code: BIRTHDAY_EVENT_CODE,
      remind,
      channel_id: existing?.channel_id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_code" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function updateBirthdayChannel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const channelId = String(formData.get("channel_id") ?? "").trim() || null;

  const supabase = await createClient();

  // 保留已有 remind 状态
  const { data: existing } = await supabase
    .from("event_remind")
    .select("remind")
    .eq("event_code", BIRTHDAY_EVENT_CODE)
    .maybeSingle();

  const { error } = await supabase.from("event_remind").upsert(
    {
      event_code: BIRTHDAY_EVENT_CODE,
      remind: existing?.remind ?? false,
      channel_id: channelId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_code" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function upsertTemplate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const status = formData.get("status") === "true";

  if (!content) {
    return { error: "模板内容不能为空。" };
  }

  const supabase = await createClient();
  const payload = { content, status };

  const { error } = id
    ? await supabase.from("birthday_reminder_templates").update(payload).eq("id", id)
    : await supabase.from("birthday_reminder_templates").insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("birthday_reminder_templates").delete().eq("id", id);

  revalidatePath(REVALIDATE_PATH);
}
