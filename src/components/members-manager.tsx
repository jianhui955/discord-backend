"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  type Member,
  type MemberRole,
  type MemberStatus,
} from "@/lib/types";
import {
  upsertMember,
  deleteMember,
  type ActionState,
} from "@/app/dashboard/members/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/format";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [MemberRole, string][];
const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [MemberStatus, string][];

export function MembersManager({ members }: { members: Member[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Member | null | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.username.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q),
    );
  }, [members, query]);

  const modalOpen = editing !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索用户名或邮箱…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <button
          onClick={() => setEditing(null)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新增成员
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">用户名</th>
                <th className="px-5 py-3 font-medium">邮箱</th>
                <th className="px-5 py-3 font-medium">生日</th>
                <th className="px-5 py-3 font-medium">角色</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    没有匹配的成员
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {m.username?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="font-medium text-slate-800">
                          {m.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {m.email ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500" suppressHydrationWarning>
                      {formatDate(m.dob)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {ROLE_LABELS[m.role]}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={m.status} label={STATUS_LABELS[m.status]} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400" suppressHydrationWarning>
                      {formatDateTime(m.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditing(m)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
                        >
                          编辑
                        </button>
                        <DeleteButton id={m.id} name={m.username} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <MemberModal
          member={editing ?? null}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteMember}
      onSubmit={(e) => {
        if (!confirm(`确定要删除成员「${name}」吗？此操作不可撤销。`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        删除
      </button>
    </form>
  );
}

const initialState: ActionState = {};

function MemberModal({
  member,
  onClose,
}: {
  member: Member | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertMember,
    initialState,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const isEdit = !!member;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "编辑成员" : "新增成员"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-6 py-5">
          {isEdit ? <input type="hidden" name="id" value={member.id} /> : null}

          <Field label="用户名" required>
            <input
              name="username"
              required
              defaultValue={member?.username ?? ""}
              placeholder="请输入用户名"
              className={inputClass}
            />
          </Field>

          <Field label="邮箱">
            <input
              name="email"
              type="email"
              defaultValue={member?.email ?? ""}
              placeholder="name@example.com"
              className={inputClass}
            />
          </Field>

          <Field label="生日">
            <input
              name="dob"
              type="date"
              defaultValue={toDateInputValue(member?.dob)}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="角色">
              <select
                name="role"
                defaultValue={member?.role ?? "member"}
                className={inputClass}
              >
                {ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="状态">
              <select
                name="status"
                defaultValue={member?.status ?? "active"}
                className={inputClass}
              >
                {STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="备注">
            <textarea
              name="note"
              rows={3}
              defaultValue={member?.note ?? ""}
              placeholder="可选备注信息"
              className={`${inputClass} resize-none`}
            />
          </Field>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}
