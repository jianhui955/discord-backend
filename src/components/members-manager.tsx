"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  STATUS_LABELS,
  type DiscordRole,
  type Member,
  type MemberStatus,
} from "@/lib/types";
import {
  upsertMember,
  deleteMember,
  type ActionState,
} from "@/app/dashboard/members/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/format";
import { formatNicknamesInput } from "@/lib/member-nickname";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [MemberStatus, string][];

type DobSort = "none" | "asc" | "desc";

/** 只看月日，忽略年份；无效/空返回 null */
function dobMonthDayKey(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const match = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return month * 100 + day;
    }
    return null;
  }
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  return (date.getMonth() + 1) * 100 + date.getDate();
}

export function MembersManager({
  members,
  discordRoles,
}: {
  members: Member[];
  discordRoles: DiscordRole[];
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "">("active");
  const [editing, setEditing] = useState<Member | null | undefined>(undefined);
  const [dobSort, setDobSort] = useState<DobSort>("none");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = members;

    if (statusFilter) {
      list = list.filter((m) => m.status === statusFilter);
    }

    if (roleFilter) {
      list = list.filter((m) => m.roles?.includes(roleFilter));
    }

    list = q
      ? list.filter(
          (m) =>
            m.username.toLowerCase().includes(q) ||
            (m.email ?? "").toLowerCase().includes(q),
        )
      : list;

    if (dobSort === "none") return list;

    return [...list].sort((a, b) => {
      const ka = dobMonthDayKey(a.dob);
      const kb = dobMonthDayKey(b.dob);
      if (ka == null && kb == null) return 0;
      if (ka == null) return 1;
      if (kb == null) return -1;
      const diff = ka - kb;
      return dobSort === "asc" ? diff : -diff;
    });
  }, [members, query, roleFilter, statusFilter, dobSort]);

  function cycleDobSort() {
    setDobSort((prev) =>
      prev === "none" ? "asc" : prev === "asc" ? "desc" : "none",
    );
  }

  const modalOpen = editing !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:min-w-[180px]"
          >
            <option value="">全部身份组</option>
            {discordRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | "")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:min-w-[140px]"
          >
            <option value="">全部状态</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
                <th className="px-5 py-3 font-medium">
                  <button
                    type="button"
                    onClick={cycleDobSort}
                    className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 transition hover:text-slate-800"
                    title="按月日排序（忽略年份），空值排最后"
                  >
                    生日
                    <span className="text-[10px] text-slate-400" aria-hidden>
                      {dobSort === "asc" ? "↑" : dobSort === "desc" ? "↓" : "↕"}
                    </span>
                  </button>
                </th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
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

          <Field label="小名">
            <input
              name="nickname"
              defaultValue={formatNicknamesInput(member?.nickname)}
              placeholder="多个小名用逗号分隔，例如：小明,阿明"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              多个小名用英文逗号分隔，存入 <code>nickname</code>（JSON 数组）
            </p>
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

          <Field label="备注">
            <textarea
              name="note"
              rows={3}
              defaultValue={member?.note ?? ""}
              placeholder="可选备注信息"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="人物介绍（DeepSeek 提示词）">
            <textarea
              name="introduce"
              rows={4}
              defaultValue={member?.introduce ?? ""}
              placeholder="给 DeepSeek / AI 用的人物介绍（可包含角色设定、语气风格、禁忌等）"
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-xs text-slate-400">
              将写入 `members.introduce`，用于后续 AI 生成时作为提示词。
            </p>
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
