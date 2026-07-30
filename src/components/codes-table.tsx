"use client";

import { formatDateTime } from "@/lib/format";
import {
  formatCodeCellValue,
  getCodeColumns,
  isDateColumn,
  type CodeRecord,
} from "@/lib/codes";

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  code: "兑换码",
  status: "状态",
  created_at: "创建时间",
  updated_at: "更新时间",
  used_at: "使用时间",
  used_by: "使用者",
  expires_at: "过期时间",
};

export function CodesTable({ codes }: { codes: CodeRecord[] }) {
  const columns = getCodeColumns(codes);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th key={col} className="px-5 py-3 font-medium">
                  {COLUMN_LABELS[col] ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {codes.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  暂无兑换码数据
                </td>
              </tr>
            ) : (
              codes.map((row, i) => (
                <tr key={String(row.id ?? i)} className="transition hover:bg-slate-50/60">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="max-w-xs truncate px-5 py-3.5 text-slate-700"
                      suppressHydrationWarning={isDateColumn(col)}
                    >
                      {renderCell(row[col], col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(value: unknown, column: string): string {
  if (value === null || value === undefined) return "—";
  if (isDateColumn(column) && typeof value === "string") {
    return formatDateTime(value);
  }
  return formatCodeCellValue(value);
}
