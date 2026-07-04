import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";
import { MembersManager } from "@/components/members-manager";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  const members = (data ?? []) as Member[];

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

      <MembersManager members={members} />
    </div>
  );
}
