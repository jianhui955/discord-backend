"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, MemberStatus } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const ROLES: MemberRole[] = ["admin", "moderator", "member"];
const STATUSES: MemberStatus[] = ["active", "inactive", "banned"];

export async function upsertMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "member") as MemberRole;
  const status = String(formData.get("status") ?? "active") as MemberStatus;
  const note = String(formData.get("note") ?? "").trim();
  const dobRaw = String(formData.get("dob") ?? "").trim();

  if (!username) {
    return { error: "用户名不能为空。" };
  }
  if (!ROLES.includes(role) || !STATUSES.includes(status)) {
    return { error: "角色或状态取值非法。" };
  }
  if (dobRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    return { error: "生日格式无效，请使用 YYYY-MM-DD。" };
  }

  const supabase = await createClient();
  const payload = {
    username,
    email: email || null,
    dob: dobRaw || null,
    role,
    status,
    note: note || null,
  };

  const { error } = id
    ? await supabase.from("members").update(payload).eq("id", id)
    : await supabase.from("members").insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMember(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("members").delete().eq("id", id);

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard");
}
