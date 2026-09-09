export type MemberStatus = "active" | "inactive" | "banned";

export interface Member {
  id: string;
  username: string;
  email: string | null;
  dob: string | null;
  status: MemberStatus;
  note: string | null;
  /**
   * 人物介绍（DeepSeek 提示词用）
   * 用于生成回复/角色扮演时提供更完整的人设背景
   */
  introduce: string | null;
  /** 小名列表，DB 存 json/jsonb 数组 */
  nickname: string[] | null;
  /** Discord 用户 ID（sync-members 写入） */
  discord_id?: string | null;
  /** Discord 身份组 ID 列表（sync-members 写入 text[]） */
  roles?: string[] | null;
  created_at: string;
}

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

/** Discord 伺服器身份组（roles 表） */
export interface DiscordRole {
  id: string;
  guild_id: string;
  name: string;
  color: number;
  position: number;
  hoist: boolean;
  managed: boolean;
  mentionable: boolean;
  icon: string | null;
  unicode_emoji: string | null;
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

export interface GameRole {
  id: number;
  name: string;
  role: string | null;
  icon: string | null;
  color: string | null;
}

export interface EventSignup {
  user_id: string;
  game_role_id: number | null;
  username: string;
}

export interface EventGuild {
  id: string;
  event_id: string;
  date: string;
  time: string | null;
  member: EventSignup[];
  reminded: boolean;
  created_at: string | null;
}

export interface GuildEvent {
  id: string;
  title: string;
  content: string;
  channel_id: string | null;
  message_id: string | null;
  created_at: string;
  guilds: EventGuild[];
}

export function normalizeEventSignups(raw: unknown): EventSignup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (typeof entry === "string") {
        const id = entry.trim();
        return id ? { user_id: id, game_role_id: null, username: id } : null;
      }
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        const userId = String(row.user_id ?? "").trim();
        if (!userId) return null;
        const roleId = row.game_role_id == null ? null : Number(row.game_role_id);
        return {
          user_id: userId,
          game_role_id: Number.isFinite(roleId) ? roleId : null,
          username: String(row.username ?? userId),
        };
      }
      return null;
    })
    .filter((entry): entry is EventSignup => entry != null);
}

export function mapEventGuildRow(row: Record<string, unknown>): EventGuild {
  const remindedRaw = row.reminded;
  const reminded =
    typeof remindedRaw === "boolean"
      ? remindedRaw
      : Number(remindedRaw) !== 0 &&
        remindedRaw !== false &&
        remindedRaw !== "false";

  return {
    id: String(row.id ?? ""),
    event_id: String(row.event_id ?? ""),
    date: String(row.date ?? "").trim(),
    time: row.time == null ? null : String(row.time).trim() || null,
    member: normalizeEventSignups(row.member),
    reminded,
    created_at: row.created_at != null ? String(row.created_at) : null,
  };
}

export function mapGuildEventRow(
  row: Record<string, unknown>,
  guilds: EventGuild[] = [],
): GuildEvent {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "").trim() || "未命名活动",
    content: String(row.content ?? ""),
    channel_id: row.channel_id != null ? String(row.channel_id).trim() || null : null,
    message_id: row.message_id != null ? String(row.message_id).trim() || null : null,
    created_at: String(row.created_at ?? ""),
    guilds,
  };
}

export function eventSignupCount(guilds: EventGuild[]): number {
  const ids = new Set<string>();
  for (const guild of guilds) {
    for (const member of guild.member) ids.add(member.user_id);
  }
  return ids.size;
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

/** 陪聊：每个频道一条设置 */
export interface CompanionChat {
  id: string;
  channel_id: string;
  prompt: string;
  enabled: boolean;
  /** 回复频率 0–100 */
  reply_rate: number;
  /** 持续时间（分钟） */
  duration_minutes: number;
  /** 本次打开开关的时间；关闭时为 null */
  enabled_at: string | null;
  /** enabled_at + duration；bot 用 expires_at <= now() 关开关 */
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapCompanionChatRow(row: Record<string, unknown>): CompanionChat {
  const enabledRaw = row.enabled;
  const enabled =
    typeof enabledRaw === "boolean"
      ? enabledRaw
      : Number(enabledRaw) !== 0 &&
        enabledRaw !== false &&
        enabledRaw !== "false";
  const rate = Number(row.reply_rate);
  const duration = Number(row.duration_minutes);

  return {
    id: String(row.id ?? ""),
    channel_id: String(row.channel_id ?? "").trim(),
    prompt: String(row.prompt ?? ""),
    enabled,
    reply_rate: Number.isFinite(rate) ? rate : 100,
    duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
    enabled_at: row.enabled_at != null ? String(row.enabled_at) : null,
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
