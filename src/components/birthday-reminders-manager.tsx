"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import {
  deleteTemplate,
  toggleBirthdayRemind,
  updateBirthdayChannel,
  upsertTemplate,
  type ActionState,
} from "@/app/dashboard/birthday-reminders/actions";
import { formatDateTime } from "@/lib/format";
import {
  discordStickerUrlCandidates,
  type BirthdayReminderTemplate,
  type Channel,
  type Sticker,
} from "@/lib/types";

const initialState: ActionState = {};

export function BirthdayRemindersManager({
  remindEnabled,
  selectedChannelId,
  channels,
  templates,
  stickers,
}: {
  remindEnabled: boolean;
  selectedChannelId: string;
  channels: Channel[];
  templates: BirthdayReminderTemplate[];
  stickers: Sticker[];
}) {
  const [editing, setEditing] = useState<BirthdayReminderTemplate | null | undefined>(
    undefined,
  );
  const modalOpen = editing !== undefined;

  return (
    <div className="space-y-6">
      <RemindSettings
        enabled={remindEnabled}
        selectedChannelId={selectedChannelId}
        channels={channels}
      />

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
          stickers={stickers}
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

function RemindSettings({
  enabled,
  selectedChannelId,
  channels,
}: {
  enabled: boolean;
  selectedChannelId: string;
  channels: Channel[];
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleBirthdayRemind,
    initialState,
  );
  const [channelState, channelAction, channelPending] = useActionState(
    updateBirthdayChannel,
    initialState,
  );
  const [channelId, setChannelId] = useState(selectedChannelId);

  // 服务端 revalidate 后，用最新 prop 同步本地状态
  useEffect(() => {
    setChannelId(selectedChannelId);
  }, [selectedChannelId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">生日提醒功能</h2>
            <p className="mt-1 text-sm text-slate-500">
              对应 <code className="text-xs">event_remind</code> 表，{" "}
              <code className="text-xs">event_code = BIRTHDAY</code>
            </p>
          </div>

          <form action={toggleAction} className="flex items-center gap-3">
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
              disabled={togglePending}
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

        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-col gap-2 sm:max-w-md">
            <label
              htmlFor="birthday-channel"
              className="text-sm font-medium text-slate-700"
            >
              提醒频道
            </label>
            <select
              id="birthday-channel"
              value={channelId}
              disabled={channels.length === 0 || channelPending}
              onChange={(e) => {
                const next = e.target.value;
                setChannelId(next);
                const fd = new FormData();
                fd.set("channel_id", next);
                startTransition(() => {
                  channelAction(fd);
                });
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">请选择频道…</option>
              {channels.map((c) => (
                <option key={c.channel_id} value={c.channel_id}>
                  {c.channel_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              仅显示 <code>type = GuildText</code> 的频道；更改后写入{" "}
              <code>event_remind.channel_id</code>
              {channelPending ? "（保存中…）" : null}
            </p>
            {channels.length === 0 ? (
              <p className="text-xs text-amber-600">
                暂无可用频道，请确认 channel 表有 type 为 GuildText 的数据。
              </p>
            ) : null}
            {!channelPending && channelState.success ? (
              <p className="text-xs text-green-600">已保存</p>
            ) : null}
          </div>
        </div>
      </div>

      {toggleState.error || channelState.error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {toggleState.error ?? channelState.error}
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
  stickers,
  onClose,
}: {
  template: BirthdayReminderTemplate | null;
  stickers: Sticker[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(upsertTemplate, initialState);
  const [content, setContent] = useState(template?.content ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = !!template;
  const defaultStatus = template?.status ?? true;

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

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

    // 插入后把光标移到 pic_code 后面
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
              ref={textareaRef}
              name="content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="例如：亲爱的 {{username}}，祝您生日快乐！您的生日是 {{dob}}。"
              className={`${inputClass} resize-none`}
            />
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
