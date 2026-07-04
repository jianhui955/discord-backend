"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

function envConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard") || "/dashboard";

  if (!email || !password) {
    return { error: "请输入邮箱和密码。" };
  }

  if (!envConfigured()) {
    return {
      error: "尚未配置 Supabase 环境变量，请先在 .env.local 中填写后重启。",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}
