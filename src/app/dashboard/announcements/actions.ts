"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeWeekdays, type Weekday } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const REVALIDATE_PATH = "/dashboard/announcements";

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function parseTime(raw: FormDataEntryValue | null): {
  time?: string;
  error?: string;
} {
  const text = String(raw ?? "").trim();
  if (!text) return { error: "公告时间不能为空。" };
  const match = text.match(TIME_RE);
  if (!match) {
    return { error: "时间格式无效，请使用 HH:MM，例如 10:00。" };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { error: "时间超出范围：小时 0–23，分钟 0–59。" };
  }
  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function parseWeekdaysFromForm(formData: FormData): Weekday[] {
  const all = formData.getAll("date");
  return normalizeWeekdays(all.map((v) => String(v)));
}

function parseStatus(raw: FormDataEntryValue | null): boolean {
  const v = String(raw ?? "").trim();
  return v === "true" || v === "1";
}

export async function upsertAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const weekdays = parseWeekdaysFromForm(formData);
  const timeParsed = parseTime(formData.get("time"));
  const channelId = String(formData.get("channel_id") ?? "").trim();
  const status = parseStatus(formData.get("status"));

  if (!content) return { error: "公告内容不能为空。" };
  if (weekdays.length === 0) return { error: "请至少选择一天（周一至周日）。" };
  if (timeParsed.error || !timeParsed.time) {
    return { error: timeParsed.error ?? "时间无效。" };
  }
  if (!channelId) return { error: "请选择投放平台（频道）。" };

  const supabase = await createClient();
  const payload = {
    content,
    date: weekdays,
    time: timeParsed.time,
    channel_id: channelId,
    status,
  };

  const { error } = id
    ? await supabase.from("announcements").update(payload).eq("id", id)
    : await supabase.from("announcements").insert(payload);

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("announcements").delete().eq("id", id);

  revalidatePath(REVALIDATE_PATH);
}
