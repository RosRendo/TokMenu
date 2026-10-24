import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Circle, ClipboardList, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatTile } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatTime, useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { reasonLabel, useDash } from "./context";

const CHECKS = [
  ["profile", "Add a description or photo", "បន្ថែមការពិពណ៌នា ឬរូបភាព", "/dashboard/settings"],
  ["categories", "Create menu categories", "បង្កើតប្រភេទម៉ឺនុយ", "/dashboard/menu/categories"],
  ["items", "Add dishes with photos and prices", "បន្ថែមមុខម្ហូប រូបភាព និងតម្លៃ", "/dashboard/menu?new=1"],
  ["tables", "Create tables and print QR codes", "បង្កើតតុ និងបោះពុម្ពកូដ QR", "/dashboard/tables"],
  ["first_order", "Receive your first order", "ទទួលការកុម្ម៉ង់ដំបូង", "/dashboard/orders"],
];

export default function Overview() {
  const { tr, lang } = useI18n();
  const { restaurant } = useDash();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/overview").then(({ data: d }) => setData(d)).catch(() => setData(false));
  }, []);

  if (data === null) return <PageLoader />;
  if (!data) return <p className="text-sm">{tr("Couldn't load the overview.", "មិនអាចផ្ទុកបាន។")}</p>;
  const cur = data.currency;
  const doneCount = Object.values(data.checklist).filter(Boolean).length;
  const tz = restaurant.settings.timezone;

  return (
    <div>
      <PageHeader
        title={tr("Today", "ថ្ងៃនេះ")}
        description={tr("Sales count completed orders only. Payments are recorded by your staff.", "ការលក់រាប់តែការកុម្ម៉ង់ដែលបានបញ្ចប់។")}
        actions={<>
          <Button asChild variant="outline" data-testid="overview-print-qr-button"><Link to="/dashboard/qr-codes"><Printer />{tr("Print QR codes", "បោះពុម្ពកូដ QR")}</Link></Button>
          <Button asChild data-testid="overview-add-item-button"><Link to="/dashboard/menu?new=1"><Plus />{tr("Add menu item", "បន្ថែមមុខម្ហូប")}</Link></Button>
        </>}
      />
      {!data.ordering.can_order && (
        <div className="mb-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="overview-ordering-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{reasonLabel(data.ordering.reason, tr)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile testId="overview-orders-today" label={tr("Orders today", "កុម្ម៉ង់ថ្ងៃនេះ")} value={data.orders_today} />
        <StatTile testId="overview-completed-today" label={tr("Completed", "បានបញ្ចប់")} value={data.completed_today} />
        <StatTile testId="overview-sales-today" label={tr("Sales (completed)", "ការលក់ (បានបញ្ចប់)")} value={formatMoney(data.sales_today, cur)} hint={tr("Gross, before refunds", "សរុបដុល")} />
        <StatTile testId="overview-pending" tone={data.pending ? "attention" : undefined} label={tr("Waiting to accept", "រង់ចាំទទួល")} value={data.pending} hint={`${data.in_progress} ${tr("in progress", "កំពុងដំណើរការ")}`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-display font-semibold">{tr("Recent orders", "ការកុម្ម៉ង់ថ្មីៗ")}</h2>
            <Link to="/dashboard/orders" className="text-sm font-medium text-primary" data-testid="overview-open-board-link">{tr("Open order board", "បើកផ្ទាំងកុម្ម៉ង់")} →</Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><ClipboardList className="h-5 w-5" />{tr("No orders yet. Share your menu QR to get the first one.", "មិនទាន់មានការកុម្ម៉ង់ទេ។")}</div>
          ) : (
            <ul className="divide-y" data-testid="overview-recent-orders">
              {data.recent.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-12 font-semibold tabular">#{String(o.daily_number).padStart(3, "0")}</span>
                  <span className="hidden w-24 font-mono text-xs text-muted-foreground sm:block">{o.display_code}</span>
                  <span className="min-w-0 flex-1 truncate">{o.table_label || o.customer_label || "—"}</span>
                  <StatusBadge status={o.status} />
                  <span className="w-20 text-right font-semibold tabular">{formatMoney(o.total, o.currency)}</span>
                  <span className="hidden w-12 text-right text-xs text-muted-foreground sm:block">{formatTime(o.created_at, lang, tz)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-4" data-testid="overview-checklist">
          <h2 className="font-display font-semibold">{tr("Setup checklist", "បញ្ជីរៀបចំ")}</h2>
          <p className="text-xs text-muted-foreground">{doneCount} / {CHECKS.length} {tr("done", "រួចរាល់")}</p>
          <ul className="mt-4 space-y-1">
            {CHECKS.map(([key, en, km, to]) => (
              <li key={key}>
                <Link to={to} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary" data-testid={`checklist-${key}`}>
                  {data.checklist[key] ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={data.checklist[key] ? "text-muted-foreground line-through" : ""}>{tr(en, km)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
