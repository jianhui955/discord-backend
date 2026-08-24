import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * 服务端专用的 Supabase 管理客户端，使用 service_role 密钥。
 * 拥有绕过 RLS 的最高权限，绝对不能在浏览器 / 客户端组件中导入。
 * 依赖 SUPABASE_SERVICE_ROLE_KEY（注意：没有 NEXT_PUBLIC_ 前缀）。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "缺少环境变量：请配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function hasServiceRoleKey() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
