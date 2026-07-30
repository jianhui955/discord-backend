import { createClient } from "@/lib/supabase/server";
import { BirthdayRemindersManager } from "@/components/birthday-reminders-manager";
import {
  BIRTHDAY_EVENT_CODE,
  type BirthdayReminderTemplate,
  type Channel,
  type EventRemind,
  type Sticker,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BirthdayRemindersPage() {
  const supabase = await createClient();

  const [remindResult, templatesResult, stickersResult, channelsResult] =
    await Promise.all([
      supabase
        .from("event_remind")
        .select("*")
        .eq("event_code", BIRTHDAY_EVENT_CODE)
        .maybeSingle(),
      supabase
        .from("birthday_reminder_templates")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("sticker")
        // pic_discord_id 若是 bigint，JSON 传到 JS 会丢精度，务必在 DB 用 text 存
        .select("pic_name, pic_code, pic_discord_id")
        .order("pic_name", { ascending: true }),
      supabase
        .from("channel")
        .select("channel_name, channel_id, type")
        .eq("type", "GuildText")
        .order("channel_name", { ascending: true }),
    ]);

  const remindRow = remindResult.data as EventRemind | null;
  const remindEnabled = remindRow?.remind ?? false;
  const selectedChannelId = remindRow?.channel_id
    ? String(remindRow.channel_id)
    : "";

  const templates = (templatesResult.data ?? []) as BirthdayReminderTemplate[];
  const stickers = ((stickersResult.data ?? []) as Sticker[]).map((s) => ({
    pic_name: String(s.pic_name ?? ""),
    pic_code: String(s.pic_code ?? ""),
    // 必须保持字符串：Discord snowflake 会超过 Number.MAX_SAFE_INTEGER
    pic_discord_id: String(s.pic_discord_id ?? "").trim(),
  }));
  const channels = ((channelsResult.data ?? []) as Channel[]).map((c) => ({
    channel_name: String(c.channel_name ?? ""),
    channel_id: String(c.channel_id ?? "").trim(),
    type: String(c.type ?? ""),
  }));

  const error =
    remindResult.error ??
    templatesResult.error ??
    stickersResult.error ??
    channelsResult.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">生日提醒</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理生日提醒开关与提醒消息模板
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认已在 Supabase 中建好相关表，并正确配置环境变量。
          </p>
        </div>
      ) : null}

      <BirthdayRemindersManager
        remindEnabled={remindEnabled}
        selectedChannelId={selectedChannelId}
        channels={channels}
        templates={templates}
        stickers={stickers}
      />
    </div>
  );
}
