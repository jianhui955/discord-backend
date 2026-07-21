import { createClient } from "@/lib/supabase/server";
import { BirthdayRemindersManager } from "@/components/birthday-reminders-manager";
import {
  BIRTHDAY_EVENT_CODE,
  type BirthdayReminderTemplate,
  type EventRemind,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BirthdayRemindersPage() {
  const supabase = await createClient();

  const [remindResult, templatesResult] = await Promise.all([
    supabase
      .from("event_remind")
      .select("*")
      .eq("event_code", BIRTHDAY_EVENT_CODE)
      .maybeSingle(),
    supabase
      .from("birthday_reminder_templates")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const remindEnabled = (remindResult.data as EventRemind | null)?.remind ?? false;
  const templates = (templatesResult.data ?? []) as BirthdayReminderTemplate[];
  const error = remindResult.error ?? templatesResult.error;

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
            {error.message}。请确认已在 Supabase 中执行{" "}
            <code>supabase/schema.sql</code> 建表。
          </p>
        </div>
      ) : null}

      <BirthdayRemindersManager
        remindEnabled={remindEnabled}
        templates={templates}
      />
    </div>
  );
}
