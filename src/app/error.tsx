"use client";

import { useEffect } from "react";

function isChunkLoadError(error?: Error) {
  const message = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module/i.test(
    message,
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 部署更新 / 冷启动后旧的 JS chunk 失效时，自动刷新一次自愈（避免死循环）
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const KEY = "__chunk_reload_once__";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.4 14.53A1.5 1.5 0 0 0 3.24 21h17.52a1.5 1.5 0 0 0 1.3-2.53l-8.4-14.53a1.5 1.5 0 0 0-2.6 0Z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">页面出错了</h1>
        <p className="mt-2 text-sm text-slate-500">
          页面加载时发生异常，通常刷新即可恢复。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            重试
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
}
