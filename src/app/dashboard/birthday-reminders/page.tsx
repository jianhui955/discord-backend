import { createClient } from "@/lib/supabase/server";
import { BirthdayRemindersManager } from "@/components/birthday-reminders-manager";
import {
  BIRTHDAY_EVENT_CODE,
  type BirthdayReminderTemplate,
  type EventRemind,
  type Sticker,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BirthdayRemindersPage() {
  const supabase = await createClient();

  const [remindResult, templatesResult, stickersResult] = await Promise.all([
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
      .select("pic_name, pic_code, pic_discord_id")
      .order("pic_name", { ascending: true }),
  ]);

  const remindEnabled = (remindResult.data as EventRemind | null)?.remind ?? false;
  const templates = (templatesResult.data ?? []) as BirthdayReminderTemplate[];
  const stickers = (stickersResult.data ?? []) as Sticker[];
  const error =
    remindResult.error ?? templatesResult.error ?? stickersResult.error;

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
        templates={templates}
        stickers={stickers}
      />
    </div>
  );
}
