"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/companion-chats";

function parseEnabled(raw: FormDataEntryValue | null): boolean {
  const v = String(raw ?? "").trim();
  return v === "true" || v === "1";
}

function parseReplyRate(raw: FormDataEntryValue | null): {
  value?: number;
  error?: string;
} {
  const text = String(raw ?? "").trim();
  if (!text) return { error: "回复频率不能为空。" };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: "回复频率必须是数字。" };
  if (n < 0 || n > 100) return { error: "回复频率需在 0–100 之间。" };
  return { value: n };
}

function parseDurationMinutes(raw: FormDataEntryValue | null): {
  value?: number;
  error?: string;
} {
  const text = String(raw ?? "").trim();
  if (!text) return { error: "持续时间不能为空。" };
  const n = Number(text);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { error: "持续时间必须是整数分钟。" };
  }
  if (n < 1) return { error: "持续时间至少 1 分钟。" };
  if (n > 60 * 24 * 30) return { error: "持续时间不能超过 30 天。" };
  return { value: n };
}

function expiryFrom(enabledAtIso: string, durationMinutes: number): string {
  const start = new Date(enabledAtIso).getTime();
  return new Date(start + durationMinutes * 60 * 1000).toISOString();
}

export async function upsertCompanionChat(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const channelId = String(formData.get("channel_id") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const enabled = parseEnabled(formData.get("enabled"));
  const rate = parseReplyRate(formData.get("reply_rate"));
  const duration = parseDurationMinutes(formData.get("duration_minutes"));

  if (!channelId) return { error: "请选择一个频道。" };
  if (!prompt) return { error: "Bot 提示词不能为空。" };
  if (rate.error || rate.value === undefined) return { error: rate.error };
  if (duration.error || duration.value === undefined) {
    return { error: duration.error };
  }

  const supabase = await createClient();

  let previousEnabled = false;
  let previousEnabledAt: string | null = null;

  if (id) {
    const { data: existing, error: fetchError } = await supabase
      .from("companion_chats")
      .select("enabled, enabled_at, channel_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) return { error: fetchError.message };
    if (!existing) return { error: "找不到这条陪聊设置。" };

    previousEnabled = Boolean(existing.enabled);
    previousEnabledAt =
      existing.enabled_at != null ? String(existing.enabled_at) : null;
  } else {
    const { data: duplicate, error: dupError } = await supabase
      .from("companion_chats")
      .select("id")
      .eq("channel_id", channelId)
      .maybeSingle();

    if (dupError) return { error: dupError.message };
    if (duplicate) return { error: "这个频道已经有陪聊设置，每个频道只能一条。" };
  }

  let enabledAt: string | null = null;
  let expiresAt: string | null = null;

  if (enabled) {
    const startAt =
      !previousEnabled || !previousEnabledAt
        ? new Date().toISOString()
        : previousEnabledAt;
    enabledAt = startAt;
    expiresAt = expiryFrom(startAt, duration.value);
  }

  const payload = {
    channel_id: channelId,
    prompt,
    enabled,
    reply_rate: rate.value,
    duration_minutes: duration.value,
    enabled_at: enabledAt,
    expires_at: expiresAt,
  };

  const { error } = id
    ? await supabase.from("companion_chats").update(payload).eq("id", id)
    : await supabase.from("companion_chats").insert(payload);

  if (error) {
    if (error.code === "23505") {
      return { error: "这个频道已经有陪聊设置，每个频道只能一条。" };
    }
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function toggleCompanionChat(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const nextEnabled = parseEnabled(formData.get("enabled"));
  if (!id) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("companion_chats")
    .select("duration_minutes")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return;

  const durationMinutes = Number(existing.duration_minutes) || 60;
  const now = new Date().toISOString();

  const payload = nextEnabled
    ? {
        enabled: true,
        enabled_at: now,
        expires_at: expiryFrom(now, durationMinutes),
      }
    : {
        enabled: false,
        enabled_at: null,
        expires_at: null,
      };

  await supabase.from("companion_chats").update(payload).eq("id", id);
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteCompanionChat(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("companion_chats").delete().eq("id", id);
  revalidatePath(REVALIDATE_PATH);
}
