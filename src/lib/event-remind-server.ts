import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseRemindTimeInput } from "@/lib/remind-time";

type ExistingRow = {
  remind?: boolean;
  channel_id?: string | null;
  remind_time?: string[] | null;
};

export async function upsertEventRemind(
  eventCode: string,
  patch: {
    remind?: boolean;
    channel_id?: string | null;
    remind_time?: string[] | null;
  },
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("event_remind")
    .select("remind, channel_id, remind_time")
    .eq("event_code", eventCode)
    .maybeSingle();

  const row = (existing ?? {}) as ExistingRow;

  return supabase.from("event_remind").upsert(
    {
      event_code: eventCode,
      remind: patch.remind ?? row.remind ?? false,
      channel_id:
        patch.channel_id !== undefined ? patch.channel_id : row.channel_id ?? null,
      remind_time:
        patch.remind_time !== undefined ? patch.remind_time : row.remind_time ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_code" },
  );
}

export function parseRemindTimeFromForm(formData: FormData) {
  const raw = String(formData.get("remind_time") ?? "");
  return parseRemindTimeInput(raw);
}
