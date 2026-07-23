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
 * Discord sticker 图片候选 URL（按优先级尝试）
 * - 若 pic_discord_id 已是完整 URL，直接使用
 * - PNG / APNG：cdn.discordapp.com
 * - GIF：必须用 media.discordapp.net
 */
export function discordStickerUrlCandidates(discordIdRaw: string): string[] {
  const id = String(discordIdRaw ?? "").trim();
  if (!id) return [];

  if (/^https?:\/\//i.test(id)) {
    return [id];
  }

  return [
    `https://cdn.discordapp.com/emojis/${id}.png?size=160&passthrough=false`,
    `https://media.discordapp.net/emojis/${id}.png?size=160&passthrough=false`,
    `https://media.discordapp.net/emojis/${id}.gif?size=160`,
  ];
}

/** Discord sticker CDN 缩略图 URL（取第一个候选） */
export function discordStickerUrl(discordId: string, size = 160): string {
  const candidates = discordStickerUrlCandidates(discordId);
  if (candidates[0]?.includes(".png")) {
    return candidates[0].replace("size=160", `size=${size}`);
  }
  return candidates[0] ?? "";
}
