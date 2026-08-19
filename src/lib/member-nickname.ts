/** 将 nickname JSON 规范为 string[] */
export function normalizeNicknames(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      return normalizeNicknames(JSON.parse(raw));
    } catch {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/** 格式化为输入框显示：小明,阿明 */
export function formatNicknamesInput(
  nicknames: string[] | null | undefined,
): string {
  if (!nicknames?.length) return "";
  return nicknames.join(",");
}

/** 解析逗号分隔输入为数组 */
export function parseNicknamesInput(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}
