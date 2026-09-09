import { createClient } from "@/lib/supabase/server";
import { CompanionChatsManager } from "@/components/companion-chats-manager";
import { mapCompanionChatRow, type Channel, type CompanionChat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanionChatsPage() {
  const supabase = await createClient();

  const [rowsResult, channelsResult] = await Promise.all([
    supabase
      .from("companion_chats")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("channel")
      .select("channel_name, channel_id, type")
      .eq("type", "GuildText")
      .order("channel_name", { ascending: true }),
  ]);

  const chats = ((rowsResult.data ?? []) as Record<string, unknown>[]).map(
    (row) => mapCompanionChatRow(row) as CompanionChat,
  );

  const channels = ((channelsResult.data ?? []) as Channel[]).map((c) => ({
    channel_name: String(c.channel_name ?? ""),
    channel_id: String(c.channel_id ?? "").trim(),
    type: String(c.type ?? ""),
  }));

  const error = rowsResult.error ?? channelsResult.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">陪聊</h1>
        <p className="mt-1 text-sm text-slate-500">
          每个频道一条设置：提示词、开关、回复频率、持续时间。打开开关时记录{" "}
          <code>enabled_at</code>，到期时间写入 <code>expires_at</code>
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请先在 Supabase SQL Editor 执行{" "}
            <code>supabase/schema.sql</code> 里陪聊表的建表语句。
          </p>
        </div>
      ) : null}

      <CompanionChatsManager chats={chats} channels={channels} />
    </div>
  );
}
