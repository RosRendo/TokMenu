import { useState } from "react";
import { MoreHorizontal, StickyNote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PaymentBadge } from "@/components/StatusBadge";
import { api, errorCode, errorMessage } from "@/lib/api";
import { formatTime, minutesAgo, useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const NEXT_ACTION = {
  PENDING: { to: "ACCEPTED", en: "Accept", km: "ទទួល" },
  ACCEPTED: { to: "PREPARING", en: "Start preparing", km: "ចាប់ផ្ដើមរៀបចំ" },
  PREPARING: { to: "READY", en: "Mark ready", km: "រួចរាល់" },
  READY: { to: "COMPLETED", en: "Complete", km: "បញ្ចប់" },
};

export function useOrderActions(order, onChanged, onStale) {
  const { tr } = useI18n();
  const [busy, setBusy] = useState(null);
  const run = async (key, request) => {
    setBusy(key);
    try {
      const { data } = await request();
      onChanged(data);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      if (["ORDER_CHANGED", "INVALID_TRANSITION"].includes(errorCode(e))) onStale?.();
      return false;
    } finally {
      setBusy(null);
    }
  };
  const transition = (to, reason = "") => run(to, () => api.post(`/dashboard/orders/${order.id}/transition`, { to, reason }));
  const payment = (status) => run(`pay-${status}`, () => api.post(`/dashboard/orders/${order.id}/payment`, { status, method: "cash" }))
    .then((ok) => ok && toast.success(status === "paid" ? tr("Marked as paid", "បានកត់ថាបង់រួច") : tr("Marked as unpaid", "បានកត់ថាមិនទាន់បង់")));
  return { busy, transition, payment };
}

const QUICK_REASONS = [["Sold out", "អស់ហើយ"], ["Kitchen closing", "ផ្ទះបាយជិតបិទ"], ["Duplicate order", "កុម្ម៉ង់ស្ទួន"]];

export function RejectDialog({ open, onOpenChange, onConfirm, busy }) {
  const { tr } = useI18n();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="reject-dialog">
        <DialogHeader>
          <DialogTitle>{tr("Reject this order?", "បដិសេធការកុម្ម៉ង់នេះ?")}</DialogTitle>
          <DialogDescription>{tr("The customer will see that the order was not accepted, with your reason.", "អតិថិជននឹងឃើញថាការកុម្ម៉ង់មិនត្រូវបានទទួល។")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map(([en, km]) => (
            <button key={en} type="button" onClick={() => setReason(tr(en, km))} data-testid={`reject-quick-${en.toLowerCase().replace(/\s/g, "-")}`} className="rounded-full border px-3 py-1 text-xs hover:bg-secondary">{tr(en, km)}</button>
          ))}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder={tr("Reason (optional)", "មូលហេតុ (ស្រេចចិត្ត)")} data-testid="reject-reason-input" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="reject-cancel-button">{tr("Cancel", "បោះបង់")}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm(reason)} data-testid="reject-confirm-button">{tr("Reject order", "បដិសេធ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderLines({ order, dense }) {
  const { loc } = useI18n();
  return (
    <ul className={cn("space-y-1.5", dense ? "text-[13px]" : "text-sm")}>
      {order.items.map((l, i) => (
        <li key={i}>
          <span className="font-semibold tabular">{l.quantity}×</span> {loc(l)}
          {l.options?.length > 0 && <span className="block pl-5 text-xs text-muted-foreground">{l.options.map((o) => loc(o)).join(" · ")}</span>}
          {l.note && <span className="block pl-5 text-xs font-medium text-amber-800">“{l.note}”</span>}
        </li>
      ))}
    </ul>
  );
}

export function OrderCard({ order, onChanged, onStale, fresh, tz }) {
  const { tr, lang } = useI18n();
  const { busy, transition, payment } = useOrderActions(order, onChanged, onStale);
  const [rejecting, setRejecting] = useState(false);
  const next = NEXT_ACTION[order.status];
  const age = minutesAgo(order.created_at);
  return (
    <article data-testid={`order-card-${order.code}`} className={cn("rounded-xl border bg-card p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]", fresh && "new-order-pulse border-blue-300")}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-bold leading-none">
            #{String(order.daily_number).padStart(3, "0")} <span className="ml-1 text-sm font-semibold">{order.table_label || order.customer_label || tr("No table", "គ្មានតុ")}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{order.display_code} · {formatTime(order.created_at, lang, tz)} · <span className={cn(age >= 15 && order.status === "PENDING" && "font-semibold text-red-600")}>{age} {tr("min", "នាទី")}</span></p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-md hover:bg-secondary" aria-label={tr("More actions", "សកម្មភាពផ្សេង")} data-testid={`order-more-${order.code}`}><MoreHorizontal className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {order.payment_status === "paid"
              ? <DropdownMenuItem onClick={() => payment("unpaid")} data-testid={`order-mark-unpaid-${order.code}`}>{tr("Mark as unpaid", "កត់ថាមិនទាន់បង់")}</DropdownMenuItem>
              : <DropdownMenuItem onClick={() => payment("paid")} data-testid={`order-mark-paid-menu-${order.code}`}>{tr("Mark paid (cash/counter)", "កត់ថាបង់រួច (សាច់ប្រាក់)")}</DropdownMenuItem>}
            {order.status === "PENDING" && <DropdownMenuItem className="text-destructive" onClick={() => setRejecting(true)} data-testid={`order-reject-menu-${order.code}`}>{tr("Reject", "បដិសេធ")}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="mt-3 border-t pt-3"><OrderLines order={order} dense /></div>
      {order.note && <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"><StickyNote className="h-3.5 w-3.5 shrink-0" />{order.note}</p>}
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="font-display font-bold tabular" data-testid={`order-total-${order.code}`}>{formatMoney(order.total, order.currency)}</span>
        <PaymentBadge status={order.payment_status} testId={`order-payment-${order.code}`} />
      </div>
      <div className="mt-3 flex gap-2">
        {order.status === "PENDING" && (
          <Button variant="outline" size="sm" className="flex-1" disabled={!!busy} onClick={() => setRejecting(true)} data-testid={`order-reject-${order.code}`}>{tr("Reject", "បដិសេធ")}</Button>
        )}
        {next && (
          <Button size="sm" className="flex-[2]" disabled={!!busy} onClick={() => transition(next.to)} data-testid={`order-action-${order.code}`}>
            {busy === next.to && <Loader2 className="animate-spin" />}{tr(next.en, next.km)}
          </Button>
        )}
      </div>
      {order.status === "READY" && order.payment_status !== "paid" && (
        <Button variant="ghost" size="sm" className="mt-1 w-full" disabled={!!busy} onClick={() => payment("paid")} data-testid={`order-mark-paid-${order.code}`}>{tr("Mark paid (cash/counter)", "កត់ថាបង់រួច")}</Button>
      )}
      <RejectDialog open={rejecting} onOpenChange={setRejecting} busy={!!busy} onConfirm={async (reason) => { if (await transition("REJECTED", reason)) setRejecting(false); }} />
    </article>
  );
}
