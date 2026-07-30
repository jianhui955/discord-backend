"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CODES_EVENT_CODE } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/codes";

export async function toggleCodesRemind(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const remind = formData.get("remind") === "true";

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("event_remind")
    .select("channel_id")
    .eq("event_code", CODES_EVENT_CODE)
    .maybeSingle();

  const { error } = await supabase.from("event_remind").upsert(
    {
      event_code: CODES_EVENT_CODE,
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

export async function updateCodesChannel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const channelId = String(formData.get("channel_id") ?? "").trim() || null;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("event_remind")
    .select("remind")
    .eq("event_code", CODES_EVENT_CODE)
    .maybeSingle();

  const { error } = await supabase.from("event_remind").upsert(
    {
      event_code: CODES_EVENT_CODE,
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
