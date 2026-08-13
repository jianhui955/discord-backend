"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAnnouncement,
  upsertAnnouncement,
  type ActionState,
} from "@/app/dashboard/announcements/actions";
import { formatDateTime } from "@/lib/format";
import {
  WEEKDAY_OPTIONS,
  discordStickerUrlCandidates,
  formatWeekdays,
  type Announcement,
  type Channel,
  type Sticker,
  type Weekday,
} from "@/lib/types";

const initialState: ActionState = {};

export function AnnouncementsManager({
  announcements,
  stickers,
  channels,
}: {
  announcements: Announcement[];
  stickers: Sticker[];
  channels: Channel[];
}) {
  const [editing, setEditing] = useState<Announcement | null | undefined>(
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
          <h2 className="text-base font-semibold text-slate-800">公告列表</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            对应 <code>announcements</code> 表；投放频道存入{" "}
            <code>channel_id</code>
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新增公告
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">内容</th>
                <th className="px-5 py-3 font-medium">投放平台</th>
                <th className="px-5 py-3 font-medium">周几</th>
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {announcements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    暂无公告，点击「新增公告」添加
                  </td>
                </tr>
              ) : (
                announcements.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/60">
                    <td className="max-w-md truncate px-5 py-3.5 text-slate-800">
                      {a.content}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {channelMap.get(a.channel_id)?.channel_name ??
                        (a.channel_id || "—")}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {formatWeekdays(a.date)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700">
                      {a.time || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400" suppressHydrationWarning>
                      {formatDateTime(a.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditing(a)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
                        >
                          编辑
                        </button>
                        <DeleteButton id={a.id} preview={a.content} />
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
        <AnnouncementModal
          announcement={editing ?? null}
          stickers={stickers}
          channels={channels}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: boolean }) {
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

function DeleteButton({ id, preview }: { id: string; preview: string }) {
  const label = preview.length > 30 ? `${preview.slice(0, 30)}…` : preview;

  return (
    <form
      action={deleteAnnouncement}
      onSubmit={(e) => {
        if (!confirm(`确定要删除公告「${label}」吗？`)) {
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

function AnnouncementModal({
  announcement,
  stickers,
  channels,
  onClose,
}: {
  announcement: Announcement | null;
  stickers: Sticker[];
  channels: Channel[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertAnnouncement,
    initialState,
  );
  const [content, setContent] = useState(announcement?.content ?? "");
  const [selectedDays, setSelectedDays] = useState<Weekday[]>(
    announcement?.date ?? [],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = !!announcement;

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  function toggleDay(day: Weekday) {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  function insertPicCode(picCode: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}${picCode}`);
      return;
    }

    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + picCode + content.slice(end);
    setContent(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + picCode.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "编辑公告" : "新增公告"}
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
            <input type="hidden" name="id" value={announcement.id} />
          ) : null}

          {selectedDays.map((d) => (
            <input key={d} type="hidden" name="date" value={String(d)} />
          ))}

          <Field label="公告内容" required>
            <textarea
              ref={textareaRef}
              name="content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入要发送的公告内容… 可用 {{role_id}} tag 身份组"
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              提示：输入{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-600">
                {"{{role_id}}"}
              </code>{" "}
              可 tag 身份组（将 role_id 替换为实际的 Discord 身份组 ID）
            </p>
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              Discord Sticker
              <span className="ml-2 text-xs font-normal text-slate-400">
                点击插入 pic_code
              </span>
            </p>
            {stickers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                暂无 sticker 数据（请确认 Supabase 的 sticker 表有记录）
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 scrollbar-thin">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {stickers.map((s) => (
                    <StickerButton
                      key={`${s.pic_discord_id}-${s.pic_code}`}
                      sticker={s}
                      onPick={insertPicCode}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Field label="投放平台" required>
            <select
              name="channel_id"
              required
              defaultValue={announcement?.channel_id ?? ""}
              disabled={channels.length === 0}
              className={inputClass}
            >
              <option value="">请选择频道…</option>
              {channels.map((c) => (
                <option key={c.channel_id} value={c.channel_id}>
                  {c.channel_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              来自 <code>channel</code> 表（type = GuildText），存入{" "}
              <code>channel_id</code>
            </p>
            {channels.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600">
                暂无可用频道，请确认 channel 表有 type 为 GuildText 的数据。
              </p>
            ) : null}
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              发送周几
              <span className="ml-0.5 text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-slate-400">
                可多选 · 存入 date（JSON）
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((opt) => {
                const checked = selectedDays.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleDay(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      checked
                        ? "bg-brand-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              已选 {selectedDays.length} 天
              {selectedDays.length > 0
                ? `：${formatWeekdays(selectedDays)}`
                : ""}
            </p>
          </div>

          <Field label="发送时间" required>
            <input
              name="time"
              type="text"
              required
              defaultValue={announcement?.time ?? ""}
              placeholder="10:00"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              格式 HH:MM，对应 <code>time</code> 列
            </p>
          </Field>

          <Field label="状态">
            <select
              name="status"
              defaultValue={(announcement?.status ?? true) ? "true" : "false"}
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

function StickerButton({
  sticker,
  onPick,
}: {
  sticker: Sticker;
  onPick: (picCode: string) => void;
}) {
  const candidates = discordStickerUrlCandidates(sticker.pic_discord_id);
  const [index, setIndex] = useState(0);
  const failed = index >= candidates.length;
  const src = candidates[index] ?? "";

  return (
    <button
      type="button"
      title={`${sticker.pic_name}（${sticker.pic_code}）\nID: ${sticker.pic_discord_id}`}
      onClick={() => onPick(sticker.pic_code)}
      className="group flex flex-col items-center gap-1 rounded-lg border border-transparent bg-white p-1.5 transition hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm"
    >
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-slate-100">
        {failed || !src ? (
          <span className="px-1 text-center text-[9px] leading-tight text-slate-400">
            {sticker.pic_name || "?"}
            <br />
            <span className="text-[8px] text-red-400">{sticker.pic_discord_id}</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={sticker.pic_name}
            className="h-12 w-12 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setIndex((i) => i + 1)}
          />
        )}
      </div>
      <span className="w-full truncate text-[10px] text-slate-500 group-hover:text-brand-600">
        {sticker.pic_name}
      </span>
    </button>
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
