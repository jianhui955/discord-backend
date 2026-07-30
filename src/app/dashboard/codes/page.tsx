import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CodesTable } from "@/components/codes-table";
import { CODES_PAGE_SIZE, type CodeRecord } from "@/lib/codes";

export const dynamic = "force-dynamic";

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * CODES_PAGE_SIZE;
  const to = from + CODES_PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("codes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const codes = (data ?? []) as CodeRecord[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CODES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">兑换码管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          查看与管理 Supabase codes 表中的兑换码
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">无法读取数据</p>
          <p className="mt-1">
            {error.message}。请确认 codes 表已存在且已配置读取权限。
          </p>
        </div>
      ) : null}

      <CodesTable codes={codes} />

      {total > 0 ? (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={total}
          from={from + 1}
          to={Math.min(from + CODES_PAGE_SIZE, total)}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        共 {total} 条，显示第 {from}–{to} 条
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink href={`/dashboard/codes?page=${page - 1}`} disabled={page <= 1}>
          上一页
        </PaginationLink>
        <span className="px-3 text-sm text-slate-600">
          {page} / {totalPages}
        </span>
        <PaginationLink
          href={`/dashboard/codes?page=${page + 1}`}
          disabled={page >= totalPages}
        >
          下一页
        </PaginationLink>
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-sm text-slate-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}
