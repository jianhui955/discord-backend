import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm text-slate-400">管理控制台</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user.email}
              </span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                退出登录
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
