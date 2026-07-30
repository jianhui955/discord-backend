/** 将 remind_time 数组格式化为输入框显示：10:00,12:00,14:20 */
export function formatRemindTimeInput(
  times: string[] | null | undefined,
): string {
  if (!times?.length) return "";
  return times.join(",");
}

/** 解析输入框内容为 HH:MM 数组，空字符串返回 null */
export function parseRemindTimeInput(raw: string): {
  times: string[] | null;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { times: null };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { times: null };
  }

  const normalized: string[] = [];
  for (const part of parts) {
    const match = part.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return {
        times: null,
        error: `时间格式无效：「${part}」。请使用 HH:MM，多个时间用逗号分隔，例如 10:00,12:00,14:20`,
      };
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return {
        times: null,
        error: `时间超出范围：「${part}」。小时 0–23，分钟 0–59`,
      };
    }

    normalized.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  }

  return { times: normalized };
}

/** 从数据库读取的 remind_time 规范为 string[] */
export function normalizeRemindTimeFromDb(
  value: unknown,
): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const arr = value.map(String).filter(Boolean);
    return arr.length > 0 ? arr : null;
  }
  if (typeof value === "string") {
    return parseRemindTimeInput(value).times;
  }
  return null;
}
