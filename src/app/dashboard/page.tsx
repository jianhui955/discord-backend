import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  type Member,
} from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  const members = (data ?? []) as Member[];

  const stats = {
    total: members.length,
    active: members.filter((m) => m.status === "active").length,
    banned: members.filter((m) => m.status === "banned").length,
    admins: members.filter((m) => m.role === "admin").length,
  };

  const recent = members.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">仪表盘</h1>
        <p className="mt-1 text-sm text-slate-500">系统数据概览</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认已在 Supabase 中执行 <code>supabase/schema.sql</code>{" "}
            建表，并正确配置 <code>.env.local</code>。
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="成员总数" value={stats.total} accent="brand" />
        <StatCard label="正常成员" value={stats.active} accent="green" />
        <StatCard label="管理员" value={stats.admins} accent="indigo" />
        <StatCard label="已封禁" value={stats.banned} accent="red" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">最近加入</h2>
          <Link
            href="/dashboard/members"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            查看全部 →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            暂无数据
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {m.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {m.username}
                    </p>
                    <p className="text-xs text-slate-400">
                      {m.email ?? "无邮箱"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {ROLE_LABELS[m.role]}
                  </span>
                  <StatusBadge status={m.status} label={STATUS_LABELS[m.status]} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "brand" | "green" | "indigo" | "red";
}) {
  const accents: Record<string, string> = {
    brand: "text-brand-600",
    green: "text-green-600",
    indigo: "text-indigo-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accents[accent]}`}>{value}</p>
    </div>
  );
}
