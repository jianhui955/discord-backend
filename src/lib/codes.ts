/** 兑换码记录（字段随 codes 表扩展） */
export type CodeRecord = Record<string, unknown>;

export const CODES_PAGE_SIZE = 20;

const COLUMN_PRIORITY = [
  "id",
  "code",
  "status",
  "used_by",
  "used_at",
  "expires_at",
  "created_at",
  "updated_at",
];

/** 表格列顺序：常见字段优先，其余按字母序 */
export function getCodeColumns(rows: CodeRecord[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((k) => keys.add(k));
  }

  if (keys.size === 0) {
    return ["code", "created_at"];
  }

  const ordered: string[] = [];
  for (const key of COLUMN_PRIORITY) {
    if (keys.has(key)) {
      ordered.push(key);
      keys.delete(key);
    }
  }

  ordered.push(...[...keys].sort());
  return ordered;
}

export function formatCodeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function isDateColumn(key: string): boolean {
  return (
    key === "created_at" ||
    key === "updated_at" ||
    key.endsWith("_at") ||
    key.endsWith("_date")
  );
}
