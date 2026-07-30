"use server";

import { revalidatePath } from "next/cache";
import { CODES_EVENT_CODE } from "@/lib/types";
import {
  parseRemindTimeFromForm,
  upsertEventRemind,
} from "@/lib/event-remind-server";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/codes";

export async function toggleCodesRemind(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const remind = formData.get("remind") === "true";
  const { error } = await upsertEventRemind(CODES_EVENT_CODE, { remind });

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function updateCodesChannel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const channelId = String(formData.get("channel_id") ?? "").trim() || null;
  const { error } = await upsertEventRemind(CODES_EVENT_CODE, {
    channel_id: channelId,
  });

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function updateCodesRemindTime(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRemindTimeFromForm(formData);
  if (parsed.error) return { error: parsed.error };

  const { error } = await upsertEventRemind(CODES_EVENT_CODE, {
    remind_time: parsed.times,
  });

  if (error) return { error: error.message };
  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
