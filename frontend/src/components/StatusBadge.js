import { STATUS_LABELS, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const STATUS_STYLES = {
  PENDING: "bg-blue-50 text-blue-700 border-blue-200",
  ACCEPTED: "bg-violet-50 text-violet-700 border-violet-200",
  PREPARING: "bg-amber-50 text-amber-800 border-amber-200",
  READY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-stone-100 text-stone-700 border-stone-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export const STATUS_DOT = {
  PENDING: "bg-blue-500",
  ACCEPTED: "bg-violet-500",
  PREPARING: "bg-amber-500",
  READY: "bg-emerald-500",
  COMPLETED: "bg-stone-400",
  REJECTED: "bg-red-500",
};

export function StatusBadge({ status, className, testId }) {
  const { tr } = useI18n();
  const [en, km] = STATUS_LABELS[status] || [status, status];
  return (
    <span data-testid={testId} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[status], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {tr(en, km)}
    </span>
  );
}

export function PaymentBadge({ status, testId }) {
  const { tr } = useI18n();
  const paid = status === "paid";
  return (
    <span data-testid={testId} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", paid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-600")}>
      {paid ? tr("Paid", "បានបង់") : tr("Unpaid", "មិនទាន់បង់")}
    </span>
  );
}
