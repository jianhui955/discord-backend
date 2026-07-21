/**
 * 统一的日期时间格式化。
 * 钉死时区（Asia/Shanghai）与 24 小时制，确保服务端渲染与浏览器 hydration
 * 输出完全一致，避免因时区差异导致的 hydration mismatch 崩溃。
 */
/** 格式化日期（不含时间），用于 birthday / dob 等 date 字段 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return new Date(value).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 将数据库 date 转为 <input type="date"> 所需的 YYYY-MM-DD */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

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
