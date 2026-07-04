"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const isChunkError =
      /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module/i.test(
        message,
      );
    if (isChunkError && typeof window !== "undefined") {
      const KEY = "__chunk_reload_once__";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f7fb",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 32,
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
            页面出错了
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
            页面加载时发生异常，通常刷新即可恢复。
          </p>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                borderRadius: 8,
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
