/**
 * 统一的日期时间格式化。
 * 钉死时区（Asia/Shanghai）与 24 小时制，确保服务端渲染与浏览器 hydration
 * 输出完全一致，避免因时区差异导致的 hydration mismatch 崩溃。
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
