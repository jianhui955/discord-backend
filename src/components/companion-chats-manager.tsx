"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteCompanionChat,
  toggleCompanionChat,
  upsertCompanionChat,
  type ActionState,
} from "@/app/dashboard/companion-chats/actions";
import { formatDateTime } from "@/lib/format";
import type { Channel, CompanionChat } from "@/lib/types";

const initialState: ActionState = {};

export function CompanionChatsManager({
  chats,
  channels,
}: {
  chats: CompanionChat[];
  channels: Channel[];
}) {
  const [editing, setEditing] = useState<CompanionChat | null | undefined>(
    undefined,
  );
  const modalOpen = editing !== undefined;

  const channelMap = useMemo(() => {
    const m = new Map<string, Channel>();
    for (const c of channels) m.set(c.channel_id, c);
    return m;
  }, [channels]);

  const usedChannelIds = useMemo(
    () => new Set(chats.map((c) => c.channel_id)),
    [chats],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">频道设置</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            对应 <code>companion_chats</code> 表；每个 <code>channel_id</code>{" "}
            只能有一条
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新增频道
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">频道</th>
                <th className="px-5 py-3 font-medium">提示词</th>
                <th className="px-5 py-3 font-medium">频率</th>
                <th className="px-5 py-3 font-medium">持续时间</th>
                <th className="px-5 py-3 font-medium">到期时间</th>
                <th className="px-5 py-3 font-medium">开关</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    暂无设置，点击「新增频道」添加
                  </td>
                </tr>
              ) : (
                chats.map((chat) => {
                  const channel = channelMap.get(chat.channel_id);
                  return (
                    <tr key={chat.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">
                          {channel?.channel_name || chat.channel_id}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {chat.channel_id}
                        </p>
                      </td>
                      <td className="max-w-xs truncate px-5 py-3.5 text-slate-600">
                        {chat.prompt || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {chat.reply_rate}%
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {formatDuration(chat.duration_minutes)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500" suppressHydrationWarning>
                        {chat.enabled && chat.expires_at
                          ? formatDateTime(chat.expires_at)
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <EnabledBadge enabled={chat.enabled} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <ToggleButton chat={chat} />
                          <button
                            onClick={() => setEditing(chat)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
                          >
                            编辑
                          </button>
                          <DeleteButton chat={chat} channelName={channel?.channel_name} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <ChatModal
          chat={editing ?? null}
          channels={channels}
          usedChannelIds={usedChannelIds}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        enabled
          ? "bg-green-50 text-green-700 ring-green-600/20"
          : "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {enabled ? "开" : "关"}
    </span>
  );
}

function ToggleButton({ chat }: { chat: CompanionChat }) {
  return (
    <form action={toggleCompanionChat}>
      <input type="hidden" name="id" value={chat.id} />
      <input type="hidden" name="enabled" value={chat.enabled ? "false" : "true"} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
      >
        {chat.enabled ? "关闭" : "打开"}
      </button>
    </form>
  );
}

function DeleteButton({
  chat,
  channelName,
}: {
  chat: CompanionChat;
  channelName?: string;
}) {
  const label = channelName || chat.channel_id;
  return (
    <form
      action={deleteCompanionChat}
      onSubmit={(e) => {
        if (!confirm(`确定删除「${label}」的陪聊设置吗？`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={chat.id} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        删除
      </button>
    </form>
  );
}

function ChatModal({
  chat,
  channels,
  usedChannelIds,
  onClose,
}: {
  chat: CompanionChat | null;
  channels: Channel[];
  usedChannelIds: Set<string>;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertCompanionChat,
    initialState,
  );
  const isEdit = !!chat;
  const availableChannels = channels.filter(
    (c) => c.channel_id === chat?.channel_id || !usedChannelIds.has(c.channel_id),
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "编辑陪聊" : "新增陪聊"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-6 py-5">
          {isEdit ? <input type="hidden" name="id" value={chat.id} /> : null}

          <Field label="频道" required>
            <select
              name="channel_id"
              required
              defaultValue={chat?.channel_id ?? ""}
              disabled={isEdit || availableChannels.length === 0}
              className={inputClass}
            >
              <option value="">请选择频道…</option>
              {availableChannels.map((c) => (
                <option key={c.channel_id} value={c.channel_id}>
                  {c.channel_name}
                </option>
              ))}
            </select>
            {isEdit ? (
              <input type="hidden" name="channel_id" value={chat.channel_id} />
            ) : null}
            <p className="mt-1 text-xs text-slate-400">
              每个频道只能有一条设置；已添加过的频道不会出现在列表里
            </p>
          </Field>

          <Field label="Bot 提示词" required>
            <textarea
              name="prompt"
              required
              rows={6}
              defaultValue={chat?.prompt ?? ""}
              placeholder="描述 bot 在这个频道怎么陪聊，例如人设、语气、禁忌…"
              className={`${inputClass} resize-y`}
            />
          </Field>

          <Field label="回复频率" required>
            <div className="relative">
              <input
                name="reply_rate"
                type="number"
                required
                min={0}
                max={100}
                step="any"
                defaultValue={chat?.reply_rate ?? 100}
                className={`${inputClass} pr-8`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              0–100，表示这个频道里 bot 回复的概率
            </p>
          </Field>

          <Field label="持续时间" required>
            <div className="relative">
              <input
                name="duration_minutes"
                type="number"
                required
                min={1}
                step={1}
                defaultValue={chat?.duration_minutes ?? 60}
                className={`${inputClass} pr-12`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                分钟
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              打开开关时记录开始时间；开始时间 + 持续时间 = 到期时间。到期后 bot 会把开关关掉。
            </p>
          </Field>

          <Field label="开关">
            <select
              name="enabled"
              defaultValue={chat?.enabled ? "true" : "false"}
              className={inputClass}
            >
              <option value="true">开</option>
              <option value="false">关</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              从关→开会重新计时；已经是开着时改持续时间，会按原来的开始时间重算到期时间。
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
