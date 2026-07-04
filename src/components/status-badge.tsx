import { type MemberStatus } from "@/lib/types";

const STYLES: Record<MemberStatus, string> = {
  active: "bg-green-50 text-green-700 ring-green-600/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  banned: "bg-red-50 text-red-700 ring-red-600/20",
};

export function StatusBadge({
  status,
  label,
}: {
  status: MemberStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {label}
    </span>
  );
}
