export type MemberRole = "admin" | "moderator" | "member";
export type MemberStatus = "active" | "inactive" | "banned";

export interface Member {
  id: string;
  username: string;
  email: string | null;
  dob: string | null;
  role: MemberRole;
  status: MemberStatus;
  note: string | null;
  /**
   * 人物介绍（DeepSeek 提示词用）
   * 用于生成回复/角色扮演时提供更完整的人设背景
   */
  introduce: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "管理员",
  moderator: "版主",
  member: "成员",
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "正常",
  inactive: "未激活",
  banned: "已封禁",
};

export const BIRTHDAY_EVENT_CODE = "BIRTHDAY" as const;
export const CODES_EVENT_CODE = "CODES" as const;

export interface EventRemind {
  id: string;
  event_code: string;
  remind: boolean;
  channel_id: string | null;
  remind_time: string[] | null;
  updated_at: string;
}

export interface Channel {
  channel_name: string;
  channel_id: string;
  type: string;
}

export interface BirthdayReminderTemplate {
  id: string;
  content: string;
  status: boolean;
  created_at: string;
}

/** 公告：date 存周几 JSON 数组（1=周一 … 7=周日） */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" },
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "周一",
  2: "周二",
  3: "周三",
  4: "周四",
  5: "周五",
  6: "周六",
  7: "周日",
};

export interface Announcement {
  id: string;
  content: string;
  /** 周几列表，1–7 */
  date: Weekday[];
  /** HH:MM */
  time: string;
  /** 投放频道 ID */
  channel_id: string;
  status: boolean;
  created_at: string;
}

/** 规范化公告 date（jsonb / 数组）为 1–7 */
export function normalizeWeekdays(raw: unknown): Weekday[] {
  let arr: unknown[] = [];
  if (raw == null) return [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = raw.split(",").map((s) => s.trim());
    }
  }

  const out: Weekday[] = [];
  for (const v of arr) {
    const n = Number(v);
    if (n >= 1 && n <= 7 && !out.includes(n as Weekday)) {
      out.push(n as Weekday);
    }
  }
  return out.sort((a, b) => a - b);
}

export function mapAnnouncementRow(row: Record<string, unknown>): Announcement {
  const statusRaw = row.status;
  const status =
    typeof statusRaw === "boolean"
      ? statusRaw
      : Number(statusRaw) !== 0 && statusRaw !== false && statusRaw !== "false";

  return {
    id: String(row.id ?? ""),
    content: String(row.content ?? ""),
    date: normalizeWeekdays(row.date),
    time: String(row.time ?? "").trim(),
    channel_id: String(row.channel_id ?? "").trim(),
    status,
    created_at: String(row.created_at ?? ""),
  };
}

export function formatWeekdays(days: Weekday[]): string {
  if (!days.length) return "—";
  return days.map((d) => WEEKDAY_LABELS[d]).join("、");
}

export interface Sticker {
  pic_name: string;
  pic_code: string;
  pic_discord_id: string;
}

/** 关键词触发 / 随机回复规则（status: 1=启用, 0=禁用） */
export interface KeywordTrigger {
  id: number | string;
  keyword: string;
  channel_ids: string[];
  personality: string;
  percentage: number;
  status: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** 将 DB 中的 channel_ids（jsonb / 数组）规范为 string[] */
export function normalizeChannelIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      return normalizeChannelIds(JSON.parse(raw));
    } catch {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/** 规范化 keyword_triggers 行 */
export function mapKeywordTriggerRow(row: Record<string, unknown>): KeywordTrigger {
  const pct = Number(row.percentage);
  return {
    id: row.id as number | string,
    keyword: String(row.keyword ?? ""),
    channel_ids: normalizeChannelIds(row.channel_ids),
    personality: String(row.personality ?? ""),
    percentage: Number.isFinite(pct) ? pct : 0,
    status: Number(row.status) === 0 ? 0 : 1,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    created_by: row.created_by != null ? String(row.created_by) : null,
  };
}

/**
 * Discord emoji / sticker 图片候选 URL
 * 你的 pic_discord_id 实际是 emoji id：
 *   https://cdn.discordapp.com/emojis/{id}.png?size=64
 * 注意：ID 必须按字符串处理，不能转成 Number（会超过 JS 安全整数丢精度）
 */
export function discordStickerUrlCandidates(discordIdRaw: string): string[] {
  const id = String(discordIdRaw ?? "").trim();
  if (!id) return [];

  if (/^https?:\/\//i.test(id)) {
    return [id];
  }

  return [
    `https://cdn.discordapp.com/emojis/${id}.png?size=64`,
    `https://cdn.discordapp.com/emojis/${id}.webp?size=64`,
    `https://cdn.discordapp.com/emojis/${id}.gif?size=64`,
    `https://media.discordapp.net/emojis/${id}.png?size=64`,
    `https://cdn.discordapp.com/stickers/${id}.png?size=160&passthrough=false`,
    `https://media.discordapp.net/stickers/${id}.gif?size=160`,
  ];
}

/** Discord 缩略图 URL（优先 emoji png） */
export function discordStickerUrl(discordId: string, size = 64): string {
  const id = String(discordId ?? "").trim();
  if (!id) return "";
  if (/^https?:\/\//i.test(id)) return id;
  return `https://cdn.discordapp.com/emojis/${id}.png?size=${size}`;
}
