import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Loader2, MapPin, Wallet, Wifi, WifiOff, XCircle } from "lucide-react";
import { LangSwitch } from "@/components/LangSwitch";
import { api, errorCode } from "@/lib/api";
import { rememberOrder } from "@/lib/cart";
import { formatTime, useI18n } from "@/lib/i18n";
import { useInterval, useLiveSocket } from "@/lib/live";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MenuMessage, MenuShell } from "./MenuPage";

const STEPS = [
  { status: "PENDING", at: "created_at", en: "Sent to the restaurant", km: "បានផ្ញើទៅភោជនីយដ្ឋាន" },
  { status: "ACCEPTED", at: "accepted_at", en: "Accepted", km: "បានទទួល" },
  { status: "PREPARING", at: "preparing_at", en: "Being prepared", km: "កំពុងរៀបចំ" },
  { status: "READY", at: "ready_at", en: "Ready", km: "រួចរាល់" },
  { status: "COMPLETED", at: "completed_at", en: "Completed", km: "បានបញ្ចប់" },
];
const HEADLINE = {
  PENDING: ["Waiting for the restaurant to confirm", "កំពុងរង់ចាំភោជនីយដ្ឋានបញ្ជាក់"],
  ACCEPTED: ["Your order was accepted", "ការកុម្ម៉ង់របស់អ្នកត្រូវបានទទួល"],
  PREPARING: ["The kitchen is preparing your order", "ផ្ទះបាយកំពុងរៀបចំការកុម្ម៉ង់របស់អ្នក"],
  READY: ["Your order is ready", "ការកុម្ម៉ង់របស់អ្នករួចរាល់ហើយ"],
  COMPLETED: ["Order completed. Enjoy!", "ការកុម្ម៉ង់បានបញ្ចប់។ សូមរីករាយ!"],
  REJECTED: ["The restaurant couldn't accept this order", "ភោជនីយដ្ឋានមិនអាចទទួលការកុម្ម៉ង់នេះបានទេ"],
};

function Timeline({ order }) {
  const { tr, lang } = useI18n();
  const index = STEPS.findIndex((s) => s.status === order.status);
  return (
    <ol className="mt-6 space-y-0" data-testid="order-timeline">
      {STEPS.map((s, i) => {
        const done = i <= index;
        return (
          <li key={s.status} className="relative flex gap-3 pb-5 last:pb-0">
            {i < STEPS.length - 1 && <span className={cn("absolute left-[11px] top-6 h-full w-0.5", i < index ? "bg-primary" : "bg-border")} />}
            <span className={cn("relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", done ? "border-primary bg-primary text-white" : "border-border bg-background")}>
              {done && <Check className="h-3.5 w-3.5" />}
            </span>
            <div className="flex flex-1 justify-between text-sm">
              <span className={cn(done ? "font-semibold" : "text-muted-foreground")} data-testid={`order-step-${s.status}`}>{tr(s.en, s.km)}</span>
              {order[s.at] && <span className="text-xs text-muted-foreground tabular">{formatTime(order[s.at], lang)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderStatusPage() {
  const { slug, code } = useParams();
  const { tr, loc } = useI18n();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/public/orders/${encodeURIComponent(code)}`);
      setOrder(data);
      setError(null);
    } catch (e) {
      setError(errorCode(e));
    }
  }, [code]);

  useEffect(() => {
    load();
    rememberOrder(slug, (code || "").replace(/-/g, "").toUpperCase());
  }, [load, slug, code]);

  const finished = order && ["COMPLETED", "REJECTED"].includes(order.status);
  const live = useLiveSocket(order && !finished ? `/ws/orders/${order.code}` : null, (msg) => {
    if (msg.type === "order.updated" && msg.order) setOrder(msg.order);
  });
  useInterval(load, live ? 60000 : 10000, !!order && !finished);

  if (error === "ORDER_NOT_FOUND") return <MenuMessage testId="order-not-found" title={tr("Order not found", "រកមិនឃើញការកុម្ម៉ង់")}>{tr("Please check the link or ask our staff.", "សូមពិនិត្យតំណ ឬសួរបុគ្គលិក។")}</MenuMessage>;
  if (!order) return <MenuShell><div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div></MenuShell>;

  const [h1en, h1km] = HEADLINE[order.status];
  const rejected = order.status === "REJECTED";

  return (
    <MenuShell>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <p className="font-display font-semibold">{loc(order.restaurant)}</p>
        <LangSwitch testId="order-lang-switch" />
      </header>
      <div className="px-4 pt-6" data-testid="order-status-page">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr("Order code", "លេខកូដកុម្ម៉ង់")}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wider" data-testid="order-code">{order.display_code}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border px-2.5 py-1 font-semibold">#{String(order.daily_number).padStart(3, "0")}</span>
          {(order.table_label || order.customer_label) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-semibold text-background" data-testid="order-table-label">
              <MapPin className="h-3 w-3" />{order.table_label || order.customer_label}
            </span>
          )}
          {!finished && (
            <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid="order-live-indicator">
              {live ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5" />}
              {live ? tr("Live updates", "ធ្វើបច្ចុប្បន្នភាពផ្ទាល់") : tr("Refreshing every 10s", "ផ្ទុកឡើងវិញរៀងរាល់ ១០ វិនាទី")}
            </span>
          )}
        </div>

        <div className={cn("mt-6 rounded-2xl border p-5", rejected ? "border-red-200 bg-red-50" : "bg-card")}>
          <p className={cn("flex items-start gap-2 font-display text-lg font-bold leading-snug", rejected && "text-red-800")} data-testid="order-status-headline" data-status={order.status}>
            {rejected && <XCircle className="mt-1 h-5 w-5 shrink-0" />}{tr(h1en, h1km)}
          </p>
          {rejected ? (
            <p className="mt-2 text-sm text-red-800" data-testid="order-reject-reason">
              {order.reject_reason ? `${tr("Reason", "មូលហេតុ")}: ${order.reject_reason}` : tr("Please ask our staff for help.", "សូមសួរបុគ្គលិក។")}
            </p>
          ) : <Timeline order={order} />}
        </div>

        <div className={cn("mt-4 flex items-center gap-2 rounded-xl p-3 text-sm", order.payment_status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-secondary")} data-testid="order-payment-status">
          <Wallet className="h-4 w-4 shrink-0" />
          {order.payment_status === "paid" ? tr("Payment received. Thank you!", "បានទទួលការបង់ប្រាក់។ អរគុណ!") : tr("Pay at the counter or at your table.", "សូមបង់ប្រាក់នៅបញ្ជរ ឬនៅតុ។")}
        </div>

        <h2 className="mt-8 font-display text-base font-semibold">{tr("Items", "មុខម្ហូប")}</h2>
        <ul className="mt-2 divide-y" data-testid="order-items">
          {order.items.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{l.quantity} × {loc(l)}</p>
                {l.options.length > 0 && <p className="text-[13px] text-muted-foreground">{l.options.map((o) => loc(o)).join(" · ")}</p>}
                {l.note && <p className="text-[13px] italic text-muted-foreground">“{l.note}”</p>}
              </div>
              <span className="tabular">{formatMoney(l.line_total, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between"><dt>{tr("Subtotal", "សរុបរង")}</dt><dd className="tabular">{formatMoney(order.subtotal, order.currency)}</dd></div>
          {order.service_charge > 0 && <div className="flex justify-between"><dt>{tr("Service charge", "ថ្លៃសេវា")}</dt><dd className="tabular">{formatMoney(order.service_charge, order.currency)}</dd></div>}
          {order.tax > 0 && <div className="flex justify-between"><dt>{tr("VAT", "អាករ")}</dt><dd className="tabular">{formatMoney(order.tax, order.currency)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>{tr("Total", "សរុប")}</dt><dd className="tabular" data-testid="order-total">{formatMoney(order.total, order.currency)}</dd></div>
        </dl>

        <p className="mt-6 text-xs text-muted-foreground">{tr("Keep this page open to follow your order. Only people with this link can see it.", "សូមបើកទំព័រនេះដើម្បីតាមដាន។ មានតែអ្នកដែលមានតំណនេះទេដែលអាចមើលបាន។")}</p>
        <Link to={`/menu/${order.restaurant.slug || slug}`} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-semibold" data-testid="order-back-to-menu">
          {tr("Order something else", "កុម្ម៉ង់បន្ថែម")}
        </Link>
      </div>
    </MenuShell>
  );
}
