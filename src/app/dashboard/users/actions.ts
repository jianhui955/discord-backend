"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UserActionState = { error?: string; success?: string };

export async function createAuthUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "邮箱和密码不能为空。" };
  }
  if (password.length < 6) {
    return { error: "密码至少需要 6 位。" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "服务端未配置 service_role 密钥。",
    };
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/users");
  return { success: `已创建登录账号：${email}` };
}

export async function deleteAuthUser(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  // 不允许删除当前登录的自己
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === id) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);

  revalidatePath("/dashboard/users");
}
