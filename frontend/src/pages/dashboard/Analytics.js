import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Lock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatTile } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { STATUS_DOT } from "@/components/StatusBadge";
import { api, errorCode, errorMessage } from "@/lib/api";
import { STATUS_LABELS, formatDate, useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDash } from "./context";

const localToday = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
const shift = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function ChartCard({ title, children, testId }) {
  return (
    <section className="rounded-xl border bg-card p-4" data-testid={testId}>
      <h2 className="mb-3 font-display text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function Analytics() {
  const { tr, loc, lang } = useI18n();
  const { restaurant, plan } = useDash();
  const tz = restaurant.settings.timezone;
  const today = localToday(tz);
  const [range, setRange] = useState({ preset: "7", from: shift(today, -6), to: today });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get("/dashboard/analytics", { params: { date_from: range.from, date_to: range.to } });
      setData(d);
      setError(null);
    } catch (e) {
      setError(errorCode(e) === "PLAN_FEATURE" ? "PLAN" : errorMessage(e));
    }
  }, [range.from, range.to]);
  useEffect(() => {
    if (plan.reports) load();
  }, [load, plan.reports]);

  if (!plan.reports || error === "PLAN") {
    return (
      <div>
        <PageHeader title={tr("Analytics", "ការវិភាគ")} />
        <EmptyState icon={Lock} title={tr("Reports are on the Starter and Pro plans", "របាយការណ៍មាននៅក្នុងគម្រោង Starter និង Pro")} testId="analytics-locked"
          action={<Button asChild data-testid="analytics-upgrade-button"><Link to="/dashboard/billing">{tr("See plans", "មើលគម្រោង")}</Link></Button>}>
          {tr("Your Overview page still shows today's orders and sales.", "ទំព័រទិដ្ឋភាពទូទៅនៅតែបង្ហាញការកុម្ម៉ង់ និងការលក់ថ្ងៃនេះ។")}
        </EmptyState>
      </div>
    );
  }

  const preset = (p) => {
    if (p === "custom") return setRange((r) => ({ ...r, preset: p }));
    const days = Number(p);
    setRange({ preset: p, from: shift(today, -(days - 1)), to: today });
  };
  const exportCsv = async () => {
    try {
      const res = await api.get("/dashboard/analytics/export", { params: { date_from: range.from, date_to: range.to }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${range.from}-to-${range.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(tr("Export failed. Please try again.", "នាំចេញមិនបាន។"));
    }
  };

  const cur = data?.currency || restaurant.settings.currency;
  const money = (v) => formatMoney(v, cur);
  const maxStatus = data ? Math.max(1, ...data.status_breakdown.map((s) => s.count)) : 1;

  return (
    <div>
      <PageHeader
        title={tr("Analytics", "ការវិភាគ")}
        actions={plan.advanced_reports && <Button variant="outline" onClick={exportCsv} data-testid="analytics-export-button"><Download />{tr("Export CSV", "នាំចេញ CSV")}</Button>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2" data-testid="analytics-range">
        {[["1", "Today", "ថ្ងៃនេះ"], ["7", "7 days", "៧ ថ្ងៃ"], ["30", "30 days", "៣០ ថ្ងៃ"], ["custom", "Custom", "ផ្ទាល់ខ្លួន"]].map(([k, en, km]) => (
          <Button key={k} size="sm" variant={range.preset === k ? "default" : "outline"} onClick={() => preset(k)} data-testid={`analytics-preset-${k}`}>{tr(en, km)}</Button>
        ))}
        {range.preset === "custom" && (
          <>
            <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-8 w-40" data-testid="analytics-from" />
            <Input type="date" value={range.to} min={range.from} max={today} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-8 w-40" data-testid="analytics-to" />
          </>
        )}
      </div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {!data ? <PageLoader /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile testId="analytics-total-orders" label={tr("Orders placed", "ការកុម្ម៉ង់")} value={data.totals.orders} />
            <StatTile testId="analytics-completed" label={tr("Completed", "បានបញ្ចប់")} value={data.totals.completed} hint={`${data.totals.rejected} ${tr("rejected", "បានបដិសេធ")}`} />
            <StatTile testId="analytics-gross" label={tr("Gross sales (completed)", "ការលក់សរុបដុល")} value={money(data.totals.gross_completed)} />
            <StatTile testId="analytics-avg" label={tr("Average completed order", "មធ្យមក្នុងមួយកុម្ម៉ង់")} value={money(data.totals.avg_completed)} />
            <StatTile testId="analytics-payments" label={tr("Payments recorded", "ការបង់ប្រាក់ដែលបានកត់")} value={money(data.totals.payments_recorded)} hint={`${data.totals.payments_recorded_count} ${tr("orders marked paid", "កុម្ម៉ង់បានកត់ថាបង់")}`} />
          </div>
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground" data-testid="analytics-disclaimer">
            {tr("Gross sales = totals of completed orders. Tok Menu has no discounts or refunds yet, so net revenue equals gross. “Payments recorded” only counts orders your staff marked as paid — it is not confirmed by any payment provider.",
              "ការលក់សរុបដុល = សរុបនៃការកុម្ម៉ង់ដែលបានបញ្ចប់។ មិនទាន់មានការបញ្ចុះតម្លៃ ឬការសងប្រាក់វិញទេ។ “ការបង់ប្រាក់ដែលបានកត់” រាប់តែកុម្ម៉ង់ដែលបុគ្គលិកកត់ថាបង់។")}
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title={tr("Orders per day", "ការកុម្ម៉ង់ប្រចាំថ្ងៃ")} testId="analytics-daily-orders">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.daily}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} width={28} />
                  <Tooltip />
                  <Bar dataKey="orders" name={tr("Placed", "បានកុម្ម៉ង់")} fill="#D6CFC4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name={tr("Completed", "បានបញ្ចប់")} fill="#B94A00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={tr("Gross sales per day (completed)", "ការលក់ប្រចាំថ្ងៃ")} testId="analytics-daily-sales">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.daily}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
                  <YAxis fontSize={11} width={48} tickFormatter={(v) => (cur === "KHR" ? v : v / 100)} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="gross" name={tr("Gross", "ដុល")} fill="#2F6B55" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <ChartCard title={tr("Best-selling items (completed orders)", "មុខលក់ដាច់បំផុត")} testId="analytics-best-sellers">
              {data.best_sellers.length === 0 ? <p className="text-sm text-muted-foreground">{tr("No completed orders in this range.", "គ្មានការកុម្ម៉ង់បានបញ្ចប់។")}</p> : (
                <ol className="space-y-2 text-sm">
                  {data.best_sellers.map((s, i) => (
                    <li key={s.name} className="flex justify-between gap-2"><span className="truncate"><span className="mr-2 text-muted-foreground tabular">{i + 1}.</span>{loc(s)}</span><span className="shrink-0 tabular">{s.quantity} · {money(s.gross)}</span></li>
                  ))}
                </ol>
              )}
            </ChartCard>
            <ChartCard title={tr("Order status breakdown", "ស្ថានភាពការកុម្ម៉ង់")} testId="analytics-status-breakdown">
              <ul className="space-y-2.5 text-sm">
                {data.status_breakdown.map((s) => (
                  <li key={s.status}>
                    <div className="flex justify-between"><span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s.status])} />{tr(...STATUS_LABELS[s.status])}</span><span className="tabular">{s.count}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-secondary"><div className={cn("h-1.5 rounded-full", STATUS_DOT[s.status])} style={{ width: `${(s.count / maxStatus) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title={tr("Weekly", "ប្រចាំសប្ដាហ៍")} testId="analytics-weekly">
              <Table>
                <TableHeader><TableRow><TableHead>{tr("Week of", "សប្ដាហ៍")}</TableHead><TableHead className="text-right">{tr("Orders", "កុម្ម៉ង់")}</TableHead><TableHead className="text-right">{tr("Gross", "ដុល")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.weekly.map((w) => <TableRow key={w.week_start}><TableCell>{formatDate(w.week_start, lang, tz)}</TableCell><TableCell className="text-right tabular">{w.orders}</TableCell><TableCell className="text-right tabular">{money(w.gross)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </ChartCard>
          </div>
          {data.hourly ? (
            <ChartCard title={tr("Orders by hour (Pro)", "ការកុម្ម៉ង់តាមម៉ោង (Pro)")} testId="analytics-hourly">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.hourly}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="hour" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} width={28} />
                  <Tooltip />
                  <Bar dataKey="orders" name={tr("Orders", "កុម្ម៉ង់")} fill="#B94A00" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="analytics-pro-note"><Lock className="mr-1 inline h-3 w-3" />{tr("Hourly breakdown and CSV export are on the Pro plan.", "ការវិភាគតាមម៉ោង និង CSV មាននៅ Pro។")}</p>
          )}
        </div>
      )}
    </div>
  );
}
