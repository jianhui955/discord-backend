import { createClient } from "@/lib/supabase/server";
import { EventsManager } from "@/components/events-manager";
import {
  mapEventGuildRow,
  mapGuildEventRow,
  type Channel,
  type EventGuild,
  type GameRole,
  type GuildEvent,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();

  const [eventsResult, guildsResult, channelsResult, rolesResult] =
    await Promise.all([
      supabase.from("event").select("*").order("created_at", { ascending: false }),
      supabase.from("event_guild").select("*").order("id", { ascending: false }),
      supabase
        .from("channel")
        .select("channel_name, channel_id, type")
        .eq("type", "GuildText")
        .order("channel_name", { ascending: true }),
      supabase
        .from("game_role")
        .select("id, name, role, icon, color")
        .order("name", { ascending: true }),
    ]);

  const guildsByEvent = new Map<string, EventGuild[]>();
  for (const row of (guildsResult.data ?? []) as Record<string, unknown>[]) {
    const guild = mapEventGuildRow(row);
    const list = guildsByEvent.get(guild.event_id) ?? [];
    list.push(guild);
    guildsByEvent.set(guild.event_id, list);
  }

  const events: GuildEvent[] = (
    (eventsResult.data ?? []) as Record<string, unknown>[]
  ).map((row) => {
    const mapped = mapGuildEventRow(row);
    return {
      ...mapped,
      guilds: guildsByEvent.get(mapped.id) ?? [],
    };
  });

  const channels = ((channelsResult.data ?? []) as Channel[]).map((c) => ({
    channel_name: String(c.channel_name ?? ""),
    channel_id: String(c.channel_id ?? "").trim(),
    type: String(c.type ?? ""),
  }));

  const gameRoles = ((rolesResult.data ?? []) as Record<string, unknown>[]).map(
    (row) =>
      ({
        id: Number(row.id),
        name: String(row.name ?? ""),
        role: row.role != null ? String(row.role) : null,
        icon: row.icon != null ? String(row.icon) : null,
        color: row.color != null ? String(row.color) : null,
      }) satisfies GameRole,
  );

  const error =
    eventsResult.error ??
    guildsResult.error ??
    channelsResult.error ??
    rolesResult.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">活动</h1>
        <p className="mt-1 text-sm text-slate-500">
          查看 <code>event</code> 标题与内容，关联场次来自{" "}
          <code>event_guild</code>（event.id = event_guild.event_id）
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认已在 Supabase 中建好 <code>event</code>、{" "}
            <code>event_guild</code> 表，并配置 RLS 策略。
          </p>
        </div>
      ) : null}

      <EventsManager events={events} channels={channels} gameRoles={gameRoles} />
    </div>
  );
}
