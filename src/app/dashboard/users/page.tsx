import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UsersManager, type AuthUserRow } from "@/components/users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const header = (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">登录账号</h1>
      <p className="mt-1 text-sm text-slate-500">
        管理可以登录后台的账号（Supabase Auth 用户）
      </p>
    </div>
  );

  if (!hasServiceRoleKey()) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">尚未配置 service_role 密钥</p>
          <p className="mt-1">
            此功能需要在环境变量中新增{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code>
            （service_role 私钥，切勿加 <code>NEXT_PUBLIC_</code> 前缀）。配置后重新部署即可使用。
          </p>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const supabase = await createClient();
  const {
    data: { user: current },
  } = await supabase.auth.getUser();

  const users: AuthUserRow[] = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  }));

  return (
    <div className="space-y-6">
      {header}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          读取用户列表失败：{error.message}
        </div>
      ) : null}

      <UsersManager users={users} currentUserId={current?.id} />
    </div>
  );
}
