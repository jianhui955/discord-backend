import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect ?? "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg shadow-brand-600/30">
            A
          </div>
          <h1 className="text-2xl font-bold text-slate-900">后台管理系统</h1>
          <p className="mt-1 text-sm text-slate-500">请登录以继续</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          使用 Supabase Auth 账户登录
        </p>
      </div>
    </div>
  );
}
