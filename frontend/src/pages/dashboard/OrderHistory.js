import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/Blocks";
import { PaymentBadge, StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { STATUS_LABELS, formatDate, formatTime, useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { useDash } from "./context";
import { NEXT_ACTION, OrderLines, RejectDialog, useOrderActions } from "./OrderCard";

function OrderDetail({ order, onChanged, onClose }) {
  const { tr, lang } = useI18n();
  const { restaurant } = useDash();
  const { busy, transition, payment } = useOrderActions(order, onChanged);
  const [rejecting, setRejecting] = useState(false);
  const next = NEXT_ACTION[order.status];
  const tz = restaurant.settings.timezone;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="order-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">#{String(order.daily_number).padStart(3, "0")} · <span className="font-mono text-base">{order.display_code}</span></DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={order.status} testId="order-detail-status" />
          <PaymentBadge status={order.payment_status} testId="order-detail-payment" />
          <span className="text-muted-foreground">{order.table_label || order.customer_label || tr("No table", "គ្មានតុ")} · {formatDate(order.created_at, lang, tz)} {formatTime(order.created_at, lang, tz)}</span>
        </div>
        <div className="rounded-lg border p-3"><OrderLines order={order} /></div>
        {order.note && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{order.note}</p>}
        {order.reject_reason && <p className="text-sm text-red-700">{tr("Reject reason", "មូលហេតុបដិសេធ")}: {order.reject_reason}</p>}
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>{tr("Subtotal", "សរុបរង")}</dt><dd className="tabular">{formatMoney(order.subtotal, order.currency)}</dd></div>
          {order.service_charge > 0 && <div className="flex justify-between"><dt>{tr("Service charge", "ថ្លៃសេវា")}</dt><dd className="tabular">{formatMoney(order.service_charge, order.currency)}</dd></div>}
          {order.tax > 0 && <div className="flex justify-between"><dt>{tr("VAT", "អាករ")}</dt><dd className="tabular">{formatMoney(order.tax, order.currency)}</dd></div>}
          <div className="flex justify-between font-bold"><dt>{tr("Total", "សរុប")}</dt><dd className="tabular">{formatMoney(order.total, order.currency)}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {order.status === "PENDING" && <Button variant="outline" onClick={() => setRejecting(true)} disabled={!!busy} data-testid="order-detail-reject">{tr("Reject", "បដិសេធ")}</Button>}
          {next && <Button onClick={() => transition(next.to)} disabled={!!busy} data-testid="order-detail-next">{tr(next.en, next.km)}</Button>}
          {order.status !== "REJECTED" && (order.payment_status === "paid"
            ? <Button variant="ghost" onClick={() => payment("unpaid")} disabled={!!busy} data-testid="order-detail-unpaid">{tr("Mark as unpaid", "កត់ថាមិនទាន់បង់")}</Button>
            : <Button variant="secondary" onClick={() => payment("paid")} disabled={!!busy} data-testid="order-detail-paid">{tr("Mark paid (cash/counter)", "កត់ថាបង់រួច")}</Button>)}
        </div>
        <RejectDialog open={rejecting} onOpenChange={setRejecting} busy={!!busy} onConfirm={async (r) => { if (await transition("REJECTED", r)) setRejecting(false); }} />
      </DialogContent>
    </Dialog>
  );
}

export function OrderHistory() {
  const { tr, lang } = useI18n();
  const { restaurant } = useDash();
  const [filters, setFilters] = useState({ status: "all", payment: "all", q: "", date_from: "", date_to: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const tz = restaurant.settings.timezone;

  const load = useCallback(async () => {
    const params = { page };
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") params[k] = v; });
    const { data: d } = await api.get("/dashboard/orders", { params });
    setData(d);
  }, [filters, page]);

  useEffect(() => {
    load().catch(() => setData({ orders: [], total: 0, page: 1, page_size: 25 }));
  }, [load]);

  const set = (k) => (v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v?.target ? v.target.value : v })); };
  const onChanged = (o) => { setSelected(o); load(); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={filters.q} onChange={set("q")} placeholder={tr("Search code, table or #number", "ស្វែងរកកូដ តុ ឬលេខ")} className="pl-9" data-testid="history-search-input" />
        </div>
        <Select value={filters.status} onValueChange={set("status")}>
          <SelectTrigger data-testid="history-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("All statuses", "គ្រប់ស្ថានភាព")}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{tr(...v)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filters.date_from} onChange={set("date_from")} aria-label={tr("From", "ពី")} data-testid="history-date-from" />
        <Input type="date" value={filters.date_to} onChange={set("date_to")} aria-label={tr("To", "ដល់")} data-testid="history-date-to" />
      </div>
      {data?.history_limited_from && <p className="mb-3 text-xs text-muted-foreground" data-testid="history-plan-limit">{tr("Your plan shows orders from", "គម្រោងរបស់អ្នកបង្ហាញការកុម្ម៉ង់ចាប់ពី")} {formatDate(data.history_limited_from, lang, tz)}. {tr("Upgrade for full history.", "ដំឡើងដើម្បីមើលប្រវត្តិពេញ។")}</p>}
      {data && data.orders.length === 0 ? (
        <EmptyState title={tr("No orders match", "គ្មានការកុម្ម៉ង់ត្រូវគ្នា")} testId="history-empty">{tr("Try a different filter or date range.", "សាកល្បងតម្រងផ្សេង។")}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table data-testid="history-table">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead><TableHead>{tr("Code", "កូដ")}</TableHead><TableHead>{tr("Table", "តុ")}</TableHead>
                <TableHead>{tr("Date", "កាលបរិច្ឆេទ")}</TableHead><TableHead>{tr("Status", "ស្ថានភាព")}</TableHead>
                <TableHead>{tr("Payment", "ការបង់ប្រាក់")}</TableHead><TableHead className="text-right">{tr("Total", "សរុប")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.orders || []).map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)} data-testid={`history-row-${o.code}`}>
                  <TableCell className="font-semibold tabular">{String(o.daily_number).padStart(3, "0")}</TableCell>
                  <TableCell className="font-mono text-xs">{o.display_code}</TableCell>
                  <TableCell>{o.table_label || o.customer_label || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(o.created_at, lang, tz)} {formatTime(o.created_at, lang, tz)}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell><PaymentBadge status={o.payment_status} /></TableCell>
                  <TableCell className="text-right font-semibold tabular">{formatMoney(o.total, o.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && data.total > data.page_size && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="history-prev">{tr("Previous", "មុន")}</Button>
          <span className="tabular">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)} data-testid="history-next">{tr("Next", "បន្ទាប់")}</Button>
        </div>
      )}
      {selected && <OrderDetail order={selected} onChanged={onChanged} onClose={() => setSelected(null)} />}
    </div>
  );
}
