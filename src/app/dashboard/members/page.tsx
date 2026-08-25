import { createClient } from "@/lib/supabase/server";
import { normalizeNicknames } from "@/lib/member-nickname";
import type { DiscordRole, Member } from "@/lib/types";
import { MembersManager } from "@/components/members-manager";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const supabase = await createClient();

  const [membersResult, rolesResult] = await Promise.all([
    supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("roles")
      .select("id, guild_id, name, color, position, hoist, managed, mentionable, icon, unicode_emoji")
      .eq("hoist", true)
      .order("position", { ascending: false }),
  ]);

  const members = ((membersResult.data ?? []) as Record<string, unknown>[]).map(
    (row) => ({
      ...(row as unknown as Member),
      nickname: normalizeNicknames(row.nickname),
      roles: Array.isArray(row.roles)
        ? row.roles.map(String)
        : row.roles == null
          ? null
          : [],
    }),
  );

  const discordRoles = (rolesResult.data ?? []) as DiscordRole[];
  const error = membersResult.error ?? rolesResult.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">成员管理</h1>
        <p className="mt-1 text-sm text-slate-500">新增、编辑、删除成员信息</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认已在 Supabase 中执行{" "}
            <code>supabase/schema.sql</code> 建表，并正确配置{" "}
            <code>.env.local</code>。
          </p>
        </div>
      ) : null}

      <MembersManager members={members} discordRoles={discordRoles} />
    </div>
  );
}
