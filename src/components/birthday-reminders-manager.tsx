"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteTemplate,
  toggleBirthdayRemind,
  upsertTemplate,
  type ActionState,
} from "@/app/dashboard/birthday-reminders/actions";
import { formatDateTime } from "@/lib/format";
import type { BirthdayReminderTemplate } from "@/lib/types";

const initialState: ActionState = {};

export function BirthdayRemindersManager({
  remindEnabled,
  templates,
}: {
  remindEnabled: boolean;
  templates: BirthdayReminderTemplate[];
}) {
  const [editing, setEditing] = useState<BirthdayReminderTemplate | null | undefined>(
    undefined,
  );
  const modalOpen = editing !== undefined;

  return (
    <div className="space-y-6">
      <RemindToggle enabled={remindEnabled} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">提醒模板</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              可添加多个生日提醒消息模板，支持变量 {"{{username}}"}、{"{{dob}}"}
            </p>
          </div>
          <button
            onClick={() => setEditing(null)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            新增模板
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">内容</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">创建时间</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                      暂无模板，点击「新增模板」添加
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="transition hover:bg-slate-50/60">
                      <td className="max-w-md truncate px-5 py-3.5 text-slate-800">
                        {t.content}
                      </td>
                      <td className="px-5 py-3.5">
                        <TemplateStatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-400" suppressHydrationWarning>
                        {formatDateTime(t.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(t)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
                          >
                            编辑
                          </button>
                          <DeleteTemplateButton id={t.id} preview={t.content} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <TemplateModal
          template={editing ?? null}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function TemplateStatusBadge({ status }: { status: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        status
          ? "bg-green-50 text-green-700 ring-green-600/20"
          : "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {status ? "启用" : "停用"}
    </span>
  );
}

function RemindToggle({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(
    toggleBirthdayRemind,
    initialState,
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">生日提醒功能</h2>
          <p className="mt-1 text-sm text-slate-500">
            对应 <code className="text-xs">event_remind</code> 表，{" "}
            <code className="text-xs">event_code = BIRTHDAY</code>
          </p>
        </div>

        <form action={formAction} className="flex items-center gap-3">
          <input type="hidden" name="remind" value={enabled ? "false" : "true"} />
          <span
            className={`text-sm font-medium ${
              enabled ? "text-green-600" : "text-slate-400"
            }`}
          >
            {enabled ? "已开启" : "已关闭"}
          </span>
          <button
            type="submit"
            disabled={pending}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
              enabled ? "bg-brand-600" : "bg-slate-300"
            } disabled:opacity-60`}
            aria-label={enabled ? "关闭生日提醒" : "开启生日提醒"}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </form>
      </div>

      {state.error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function DeleteTemplateButton({ id, preview }: { id: string; preview: string }) {
  const label = preview.length > 30 ? `${preview.slice(0, 30)}…` : preview;

  return (
    <form
      action={deleteTemplate}
      onSubmit={(e) => {
        if (!confirm(`确定要删除模板「${label}」吗？`)) {
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

function TemplateModal({
  template,
  onClose,
}: {
  template: BirthdayReminderTemplate | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(upsertTemplate, initialState);
  const isEdit = !!template;
  const defaultStatus = template?.status ?? true;

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "编辑模板" : "新增模板"}
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
          {isEdit ? <input type="hidden" name="id" value={template.id} /> : null}

          <Field label="模板内容" required>
            <textarea
              name="content"
              required
              rows={5}
              defaultValue={template?.content ?? ""}
              placeholder="例如：亲爱的 {{username}}，祝您生日快乐！您的生日是 {{dob}}。"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="状态">
            <select
              name="status"
              defaultValue={defaultStatus ? "true" : "false"}
              className={inputClass}
            >
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
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
