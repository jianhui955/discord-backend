"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseNicknamesInput } from "@/lib/member-nickname";
import type { MemberStatus } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const STATUSES: MemberStatus[] = ["active", "inactive", "banned"];

export async function upsertMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const status = String(formData.get("status") ?? "active") as MemberStatus;
  const note = String(formData.get("note") ?? "").trim();
  const introduce = String(formData.get("introduce") ?? "").trim();
  const nicknames = parseNicknamesInput(String(formData.get("nickname") ?? ""));
  const dobRaw = String(formData.get("dob") ?? "").trim();

  if (!username) {
    return { error: "用户名不能为空。" };
  }
  if (!STATUSES.includes(status)) {
    return { error: "状态取值非法。" };
  }
  if (dobRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    return { error: "生日格式无效，请使用 YYYY-MM-DD。" };
  }

  const supabase = await createClient();
  const payload = {
    username,
    email: email || null,
    dob: dobRaw || null,
    status,
    note: note || null,
    introduce: introduce || null,
    nickname: nicknames.length > 0 ? nicknames : null,
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
