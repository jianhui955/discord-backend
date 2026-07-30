"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { formatRemindTimeInput } from "@/lib/remind-time";
import type { Channel } from "@/lib/types";

export type RemindActionState = { error?: string; success?: boolean };

const initialState: RemindActionState = {};

type RemindSettingsProps = {
  title: string;
  eventCode: string;
  enabled: boolean;
  selectedChannelId: string;
  channels: Channel[];
  toggleAction: (
    prev: RemindActionState,
    formData: FormData,
  ) => Promise<RemindActionState>;
  channelAction: (
    prev: RemindActionState,
    formData: FormData,
  ) => Promise<RemindActionState>;
  channelSelectId?: string;
  /** 传入则显示提醒时间输入框 */
  remindTime?: string[] | null;
  remindTimeAction?: (
    prev: RemindActionState,
    formData: FormData,
  ) => Promise<RemindActionState>;
  remindTimeInputId?: string;
};

export function RemindSettings({
  title,
  eventCode,
  enabled,
  selectedChannelId,
  channels,
  toggleAction,
  channelAction,
  channelSelectId = "remind-channel",
  remindTime,
  remindTimeAction,
  remindTimeInputId = "remind-time",
}: RemindSettingsProps) {
  const showRemindTime = !!remindTimeAction;

  const [toggleState, toggleFormAction, togglePending] = useActionState(
    toggleAction,
    initialState,
  );
  const [channelState, channelFormAction, channelPending] = useActionState(
    channelAction,
    initialState,
  );
  const [timeState, timeFormAction, timePending] = useActionState(
    remindTimeAction ?? noopAction,
    initialState,
  );
  const [channelId, setChannelId] = useState(selectedChannelId);
  const [timeInput, setTimeInput] = useState(
    formatRemindTimeInput(remindTime ?? null),
  );

  useEffect(() => {
    setChannelId(selectedChannelId);
  }, [selectedChannelId]);

  useEffect(() => {
    if (showRemindTime) {
      setTimeInput(formatRemindTimeInput(remindTime ?? null));
    }
  }, [remindTime, showRemindTime]);

  function saveRemindTime(value: string) {
    if (!remindTimeAction) return;
    const fd = new FormData();
    fd.set("remind_time", value);
    startTransition(() => {
      timeFormAction(fd);
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              对应 <code className="text-xs">event_remind</code> 表，{" "}
              <code className="text-xs">event_code = {eventCode}</code>
            </p>
          </div>

          <form action={toggleFormAction} className="flex items-center gap-3">
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
              aria-label={enabled ? `关闭${title}` : `开启${title}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </form>
        </div>

        <div
          className={`grid gap-4 border-t border-slate-100 pt-4 ${
            showRemindTime ? "sm:grid-cols-2" : ""
          }`}
        >
          <div className="flex flex-col gap-2 sm:max-w-md">
            <label
              htmlFor={channelSelectId}
              className="text-sm font-medium text-slate-700"
            >
              提醒频道
            </label>
            <select
              id={channelSelectId}
              value={channelId}
              disabled={channels.length === 0 || channelPending}
              onChange={(e) => {
                const next = e.target.value;
                setChannelId(next);
                const fd = new FormData();
                fd.set("channel_id", next);
                startTransition(() => {
                  channelFormAction(fd);
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
              仅显示 <code>type = GuildText</code> 的频道
              {channelPending ? "（保存中…）" : null}
              {!channelPending && channelState.success ? (
                <span className="ml-1 text-green-600">已保存</span>
              ) : null}
            </p>
            {channels.length === 0 ? (
              <p className="text-xs text-amber-600">
                暂无可用频道，请确认 channel 表有 type 为 GuildText 的数据。
              </p>
            ) : null}
          </div>

          {showRemindTime ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={remindTimeInputId}
                className="text-sm font-medium text-slate-700"
              >
                提醒时间
              </label>
              <input
                id={remindTimeInputId}
                type="text"
                value={timeInput}
                disabled={timePending}
                placeholder="10:00,12:00,14:20"
                onChange={(e) => setTimeInput(e.target.value)}
                onBlur={() => saveRemindTime(timeInput)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveRemindTime(timeInput);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="text-xs text-slate-400">
                多个时间用英文逗号分隔，存入{" "}
                <code>event_remind.remind_time</code>（数组）
                {timePending ? "（保存中…）" : null}
                {!timePending && timeState.success ? (
                  <span className="ml-1 text-green-600">已保存</span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {toggleState.error || channelState.error || timeState.error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {toggleState.error ?? channelState.error ?? timeState.error}
        </p>
      ) : null}
    </div>
  );
}

async function noopAction(): Promise<RemindActionState> {
  return {};
}
