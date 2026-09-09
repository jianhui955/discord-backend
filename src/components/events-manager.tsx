"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteEvent,
  updateEvent,
  type ActionState,
} from "@/app/dashboard/events/actions";
import { formatDateTime } from "@/lib/format";
import {
  eventSignupCount,
  type Channel,
  type EventGuild,
  type GameRole,
  type GuildEvent,
} from "@/lib/types";

const initialState: ActionState = {};

export function EventsManager({
  events,
  channels,
  gameRoles,
}: {
  events: GuildEvent[];
  channels: Channel[];
  gameRoles: GameRole[];
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GuildEvent | null>(null);

  const channelMap = useMemo(() => {
    const m = new Map<string, Channel>();
    for (const c of channels) m.set(c.channel_id, c);
    return m;
  }, [channels]);

  const roleMap = useMemo(() => {
    const m = new Map<number, GameRole>();
    for (const role of gameRoles) m.set(role.id, role);
    return m;
  }, [gameRoles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => {
      const hay = [
        event.id,
        event.title,
        event.content,
        ...event.guilds.map((g) => `${g.date} ${g.time ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">活动列表</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            共 {filtered.length} 条 · 点击行可展开场次与报名名单
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、内容、日期…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="px-5 py-3 font-medium">日期 / 时间</th>
                <th className="px-5 py-3 font-medium">报名</th>
                <th className="px-5 py-3 font-medium">频道</th>
                <th className="px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    {events.length === 0 ? "暂无活动数据" : "没有匹配的活动"}
                  </td>
                </tr>
              ) : (
                filtered.map((event) => {
                  const open = expandedId === event.id;
                  const channel = event.channel_id
                    ? channelMap.get(event.channel_id)
                    : undefined;
                  const primary = event.guilds[0];
                  const signupCount = eventSignupCount(event.guilds);

                  return (
                    <EventRow
                      key={event.id}
                      event={event}
                      open={open}
                      channelName={channel?.channel_name}
                      primary={primary}
                      signupCount={signupCount}
                      roleMap={roleMap}
                      onToggle={() =>
                        setExpandedId(open ? null : event.id)
                      }
                      onEdit={() => setEditing(event)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <EditEventModal event={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function EventRow({
  event,
  open,
  channelName,
  primary,
  signupCount,
  roleMap,
  onToggle,
  onEdit,
}: {
  event: GuildEvent;
  open: boolean;
  channelName?: string;
  primary?: EventGuild;
  signupCount: number;
  roleMap: Map<number, GameRole>;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer transition hover:bg-slate-50/60" onClick={onToggle}>
        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-500">
          #{event.id}
        </td>
        <td className="max-w-xs px-5 py-3.5">
          <p className="truncate font-medium text-slate-800">{event.title}</p>
          {event.content ? (
            <p className="mt-0.5 truncate text-xs text-slate-400">{event.content}</p>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-5 py-3.5 text-slate-700">
          {primary ? (
            <span>
              {primary.date}
              {primary.time && primary.time !== "-" ? ` · ${primary.time}` : ""}
            </span>
          ) : (
            <span className="text-slate-400">无场次</span>
          )}
          {event.guilds.length > 1 ? (
            <span className="ml-1 text-xs text-slate-400">
              +{event.guilds.length - 1}
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3.5 text-slate-700">{signupCount}</td>
        <td className="max-w-[10rem] truncate px-5 py-3.5 text-slate-600">
          {channelName || event.channel_id || "—"}
        </td>
        <td className="whitespace-nowrap px-5 py-3.5 text-slate-500" suppressHydrationWarning>
          {formatDateTime(event.created_at)}
        </td>
        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              编辑
            </button>
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={event.id} />
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm(`确定删除活动 #${event.id}「${event.title}」及其场次？`)) {
                    e.preventDefault();
                  }
                }}
                className="rounded-lg border border-red-100 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </form>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-50/70">
          <td colSpan={7} className="px-5 py-4">
            <EventDetail event={event} roleMap={roleMap} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EventDetail({
  event,
  roleMap,
}: {
  event: GuildEvent;
  roleMap: Map<number, GameRole>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          活动内容
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
          {event.content || "—"}
        </p>
      </div>

      {event.guilds.length === 0 ? (
        <p className="text-sm text-slate-400">
          没有关联的 <code>event_guild</code> 场次
        </p>
      ) : (
        event.guilds.map((guild) => (
          <div
            key={guild.id}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-slate-800">
                场次 #{guild.id}
              </span>
              <span className="text-slate-600">📅 {guild.date || "—"}</span>
              <span className="text-slate-600">
                🕐 {guild.time && guild.time !== "-" ? guild.time : "未填时间"}
              </span>
              <span className="text-slate-600">
                👥 {new Set(guild.member.map((m) => m.user_id)).size} 人
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  guild.reminded
                    ? "bg-slate-100 text-slate-500"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {guild.reminded ? "已提醒" : "未提醒"}
              </span>
            </div>

            {guild.member.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">暂无报名</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {guild.member.map((member, index) => {
                  const role =
                    member.game_role_id != null
                      ? roleMap.get(member.game_role_id)
                      : undefined;
                  return (
                    <li
                      key={`${member.user_id}-${member.game_role_id ?? "none"}-${index}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700"
                    >
                      {member.username || member.user_id}
                      {role ? (
                        <span className="ml-1 text-slate-400">
                          · {role.icon ? `${role.icon} ` : ""}
                          {role.name}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function EditEventModal({
  event,
  onClose,
}: {
  event: GuildEvent;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(updateEvent, initialState);

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
            编辑活动 #{event.id}
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
          <input type="hidden" name="id" value={event.id} />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              标题<span className="ml-0.5 text-red-500">*</span>
            </span>
            <input
              name="title"
              required
              defaultValue={event.title}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              内容<span className="ml-0.5 text-red-500">*</span>
            </span>
            <textarea
              name="content"
              required
              rows={6}
              defaultValue={event.content}
              className={`${inputClass} resize-y`}
            />
          </label>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
