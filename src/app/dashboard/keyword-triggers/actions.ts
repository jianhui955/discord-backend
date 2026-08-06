"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/keyword-triggers";

function parseStatus(raw: FormDataEntryValue | null): number {
  const v = String(raw ?? "").trim();
  return v === "0" || v === "false" ? 0 : 1;
}

function parseChannelIdsFromForm(formData: FormData): string[] {
  const all = formData.getAll("channel_ids");
  const ids = all
    .flatMap((v) => String(v).split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

export async function upsertKeywordTrigger(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const keyword = String(formData.get("keyword") ?? "").trim();
  const personality = String(formData.get("personality") ?? "").trim();
  const status = parseStatus(formData.get("status"));
  const channelIds = parseChannelIdsFromForm(formData);

  if (!keyword) return { error: "触发关键字不能为空。" };
  if (!personality) return { error: "回复性格不能为空。" };
  if (channelIds.length === 0) {
    return { error: "请至少选择一个检测平台（频道）。" };
  }

  const supabase = await createClient();
  const payload = {
    keyword,
    channel_ids: channelIds,
    personality,
    status,
  };

  const { error } = id
    ? await supabase.from("keyword_triggers").update(payload).eq("id", id)
    : await supabase.from("keyword_triggers").insert(payload);

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function toggleKeywordTriggerStatus(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const next = parseStatus(formData.get("status"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("keyword_triggers").update({ status: next }).eq("id", id);

  revalidatePath(REVALIDATE_PATH);
}

export async function deleteKeywordTrigger(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("keyword_triggers").delete().eq("id", id);

  revalidatePath(REVALIDATE_PATH);
}
