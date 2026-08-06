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
  return {
    id: row.id as number | string,
    keyword: String(row.keyword ?? ""),
    channel_ids: normalizeChannelIds(row.channel_ids),
    personality: String(row.personality ?? ""),
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
