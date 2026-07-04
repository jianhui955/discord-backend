export type MemberRole = "admin" | "moderator" | "member";
export type MemberStatus = "active" | "inactive" | "banned";

export interface Member {
  id: string;
  username: string;
  email: string | null;
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
