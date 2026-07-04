"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createAuthUser,
  deleteAuthUser,
  type UserActionState,
} from "@/app/dashboard/users/actions";

export type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

const initialState: UserActionState = {};

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsersManager({
  users,
  currentUserId,
}: {
  users: AuthUserRow[];
  currentUserId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createAuthUser,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* 新增登录账号 */}
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-800">
            新增登录账号
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            创建后对方即可用此邮箱密码登录后台
          </p>

          <form ref={formRef} action={formAction} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                邮箱<span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                密码<span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                name="password"
                type="text"
                required
                minLength={6}
                placeholder="至少 6 位"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                建议设置一个初始密码，交给对方后让其自行修改
              </p>
            </div>

            {state.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {state.success}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "创建中…" : "创建账号"}
            </button>
          </form>
        </div>
      </div>

      {/* 已有登录账号列表 */}
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">
              登录账号（{users.length}）
            </h2>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">邮箱</th>
                  <th className="px-5 py-3 font-medium">创建时间</th>
                  <th className="px-5 py-3 font-medium">最后登录</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                      暂无登录账号
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <tr key={u.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">
                              {u.email ?? "—"}
                            </span>
                            {isSelf ? (
                              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-600">
                                当前账号
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {formatTime(u.created_at)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {formatTime(u.last_sign_in_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end">
                            {isSelf ? (
                              <span className="text-xs text-slate-300">
                                不可删除
                              </span>
                            ) : (
                              <DeleteUserButton id={u.id} email={u.email} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteUserButton({
  id,
  email,
}: {
  id: string;
  email: string | null;
}) {
  return (
    <form
      action={deleteAuthUser}
      onSubmit={(e) => {
        if (!confirm(`确定要删除登录账号「${email ?? id}」吗？删除后将无法登录。`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        删除
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
