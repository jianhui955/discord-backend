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

export interface EventRemind {
  id: string;
  event_code: string;
  remind: boolean;
  updated_at: string;
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
