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

/** Discord sticker CDN 缩略图 URL */
export function discordStickerUrl(discordId: string, size = 160): string {
  return `https://cdn.discordapp.com/stickers/${discordId}.png?size=${size}&passthrough=false`;
}
