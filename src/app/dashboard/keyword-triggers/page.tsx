import { createClient } from "@/lib/supabase/server";
import { KeywordTriggersManager } from "@/components/keyword-triggers-manager";
import { mapKeywordTriggerRow, type Channel, type KeywordTrigger } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KeywordTriggersPage() {
  const supabase = await createClient();

  const [triggersResult, channelsResult] = await Promise.all([
    supabase
      .from("keyword_triggers")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("channel")
      .select("channel_name, channel_id, type")
      .in("type", ["GuildText", "GuildVoice"])
      .order("channel_name", { ascending: true }),
  ]);

  const triggers = ((triggersResult.data ?? []) as Record<string, unknown>[]).map(
    (row) => mapKeywordTriggerRow(row) as KeywordTrigger,
  );

  const channels = ((channelsResult.data ?? []) as Channel[]).map((c) => ({
    channel_name: String(c.channel_name ?? ""),
    channel_id: String(c.channel_id ?? "").trim(),
    type: String(c.type ?? ""),
  }));

  const error = triggersResult.error ?? channelsResult.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">随机回复</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理关键词触发规则：触发关键字、检测平台与回复性格
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认已在 Supabase 中建好{" "}
            <code>keyword_triggers</code> 表，并正确配置环境变量。
          </p>
        </div>
      ) : null}

      <KeywordTriggersManager triggers={triggers} channels={channels} />
    </div>
  );
}
