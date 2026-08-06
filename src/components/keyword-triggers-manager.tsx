"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteKeywordTrigger,
  toggleKeywordTriggerStatus,
  upsertKeywordTrigger,
  type ActionState,
} from "@/app/dashboard/keyword-triggers/actions";
import { formatDateTime } from "@/lib/format";
import type { Channel, KeywordTrigger } from "@/lib/types";

const initialState: ActionState = {};

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  GuildText: "文字",
  GuildVoice: "语音",
};

export function KeywordTriggersManager({
  triggers,
  channels,
}: {
  triggers: KeywordTrigger[];
  channels: Channel[];
}) {
  const [editing, setEditing] = useState<KeywordTrigger | null | undefined>(
    undefined,
  );
  const modalOpen = editing !== undefined;

  const channelMap = useMemo(() => {
    const m = new Map<string, Channel>();
    for (const c of channels) m.set(c.channel_id, c);
    return m;
  }, [channels]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">触发规则</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            对应 <code>keyword_triggers</code> 表；检测平台来自{" "}
            <code>channel</code>（GuildText / GuildVoice）
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新增规则
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">触发关键字</th>
                <th className="px-5 py-3 font-medium">检测平台</th>
                <th className="px-5 py-3 font-medium">回复性格</th>
                <th className="px-5 py-3 font-medium">百分比</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">更新时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {triggers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    暂无规则，点击「新增规则」添加
                  </td>
                </tr>
              ) : (
                triggers.map((t) => (
                  <tr key={String(t.id)} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {t.keyword}
                    </td>
                    <td className="px-5 py-3.5">
                      <ChannelIdsCell
                        ids={t.channel_ids}
                        channelMap={channelMap}
                      />
                    </td>
                    <td className="max-w-xs truncate px-5 py-3.5 text-slate-600">
                      {t.personality}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {t.percentage}%
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400" suppressHydrationWarning>
                      {formatDateTime(t.updated_at || t.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <ToggleStatusButton id={t.id} status={t.status} />
                        <button
                          onClick={() => setEditing(t)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
                        >
                          编辑
                        </button>
                        <DeleteButton id={t.id} keyword={t.keyword} />
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
        <TriggerModal
          trigger={editing ?? null}
          channels={channels}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function ChannelIdsCell({
  ids,
  channelMap,
}: {
  ids: string[];
  channelMap: Map<string, Channel>;
}) {
  if (ids.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      {ids.map((id) => {
        const ch = channelMap.get(id);
        const label = ch
          ? `${ch.channel_name}（${CHANNEL_TYPE_LABEL[ch.type] ?? ch.type}）`
          : id;
        return (
          <span
            key={id}
            title={id}
            className="inline-flex max-w-[160px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const on = status === 1;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        on
          ? "bg-green-50 text-green-700 ring-green-600/20"
          : "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {on ? "启用" : "停用"}
    </span>
  );
}

function ToggleStatusButton({
  id,
  status,
}: {
  id: number | string;
  status: number;
}) {
  const next = status === 1 ? 0 : 1;
  return (
    <form action={toggleKeywordTriggerStatus}>
      <input type="hidden" name="id" value={String(id)} />
      <input type="hidden" name="status" value={String(next)} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
      >
        {status === 1 ? "停用" : "启用"}
      </button>
    </form>
  );
}

function DeleteButton({
  id,
  keyword,
}: {
  id: number | string;
  keyword: string;
}) {
  return (
    <form
      action={deleteKeywordTrigger}
      onSubmit={(e) => {
        if (!confirm(`确定要删除规则「${keyword}」吗？`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={String(id)} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        删除
      </button>
    </form>
  );
}

function TriggerModal({
  trigger,
  channels,
  onClose,
}: {
  trigger: KeywordTrigger | null;
  channels: Channel[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertKeywordTrigger,
    initialState,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    trigger?.channel_ids ?? [],
  );
  const isEdit = !!trigger;

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  function toggleChannel(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const textChannels = channels.filter((c) => c.type === "GuildText");
  const voiceChannels = channels.filter((c) => c.type === "GuildVoice");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "编辑规则" : "新增规则"}
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
          {isEdit ? (
            <input type="hidden" name="id" value={String(trigger.id)} />
          ) : null}

          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="channel_ids" value={id} />
          ))}

          <Field label="触发关键字" required>
            <input
              name="keyword"
              required
              defaultValue={trigger?.keyword ?? ""}
              placeholder="例如：晚安"
              className={inputClass}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              检测平台
              <span className="ml-0.5 text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-slate-400">
                可多选 · GuildText / GuildVoice
              </span>
            </p>
            {channels.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                暂无可用频道，请确认 channel 表有 type 为 GuildText 或 GuildVoice 的数据。
              </p>
            ) : (
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 scrollbar-thin">
                <ChannelGroup
                  title="文字频道（GuildText）"
                  channels={textChannels}
                  selectedIds={selectedIds}
                  onToggle={toggleChannel}
                />
                <ChannelGroup
                  title="语音频道（GuildVoice）"
                  channels={voiceChannels}
                  selectedIds={selectedIds}
                  onToggle={toggleChannel}
                />
              </div>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              已选 {selectedIds.length} 个频道
            </p>
          </div>

          <Field label="回复性格" required>
            <textarea
              name="personality"
              required
              rows={6}
              defaultValue={trigger?.personality ?? ""}
              placeholder="描述 AI 的回复语气与性格，例如：你是一个温柔、体贴的朋友…"
              className={`${inputClass} resize-y`}
            />
          </Field>

          <Field label="百分比" required>
            <div className="relative">
              <input
                name="percentage"
                type="number"
                required
                min={0}
                max={100}
                step="any"
                defaultValue={trigger?.percentage ?? 0}
                placeholder="0–100"
                className={`${inputClass} pr-8`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              触发概率，范围 0–100，对应 <code>percentage</code> 列
            </p>
          </Field>

          <Field label="状态">
            <select
              name="status"
              defaultValue={String(trigger?.status ?? 1)}
              className={inputClass}
            >
              <option value="1">启用</option>
              <option value="0">停用</option>
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

function ChannelGroup({
  title,
  channels,
  selectedIds,
  onToggle,
}: {
  title: string;
  channels: Channel[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (channels.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">{title}</p>
      <div className="space-y-1">
        {channels.map((c) => {
          const checked = selectedIds.includes(c.channel_id);
          return (
            <label
              key={c.channel_id}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition ${
                checked ? "bg-brand-50 text-brand-800" : "hover:bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(c.channel_id)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="flex-1 truncate">{c.channel_name}</span>
              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                {c.channel_id}
              </span>
            </label>
          );
        })}
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
