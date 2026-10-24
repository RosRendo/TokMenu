import { useEffect, useState } from "react";
import { PageHeader, StatTile } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function DailyBars({ rows }) {
  const { tr } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.orders));
  if (!rows.length) return <p className="p-4 text-sm text-muted-foreground">{tr("No orders in the last 30 days.", "គ្មានការកុម្ម៉ង់ក្នុង ៣០ ថ្ងៃចុងក្រោយ។")}</p>;
  return (
    <div className="flex h-40 items-end gap-1 p-4" data-testid="admin-daily-orders">
      {rows.map((r) => (
        <div key={r.date} className="flex-1 rounded-t bg-primary/80" style={{ height: `${(r.orders / max) * 100}%` }} title={`${r.date}: ${r.orders}`} />
      ))}
    </div>
  );
}

export default function AdminOverview() {
  const { tr } = useI18n();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/admin/stats").then(({ data: d }) => setData(d)).catch(() => setData(false));
  }, []);
  if (data === null) return <PageLoader />;
  if (!data) return <p className="text-sm" data-testid="admin-stats-error">{tr("Couldn't load platform stats.", "មិនអាចផ្ទុកស្ថិតិបាន។")}</p>;
  const plans = [["trial", "Free Trial"], ["starter", "Starter"], ["pro", "Pro"]];
  return (
    <div>
      <PageHeader title={tr("Platform overview", "ទិដ្ឋភាពវេទិកា")} description={tr("Counts come straight from the database. Nothing here is estimated.", "ចំនួនទាំងអស់មកពីមូលដ្ឋានទិន្នន័យ។")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile testId="admin-stat-restaurants" label={tr("Restaurants", "ភោជនីយដ្ឋាន")} value={data.restaurants} />
        <StatTile testId="admin-stat-active" label={tr("Active (30d)", "សកម្ម (៣០ថ្ងៃ)")} value={data.active_restaurants_30d} />
        <StatTile testId="admin-stat-suspended" label={tr("Suspended", "ផ្អាក")} value={data.suspended} />
        <StatTile testId="admin-stat-orders" label={tr("Orders (30d)", "កុម្ម៉ង់ (៣០ថ្ងៃ)")} value={data.orders_30d} />
        <StatTile testId="admin-stat-users" label={tr("Users", "អ្នកប្រើ")} value={data.users} />
        <StatTile testId="admin-stat-support" tone={data.open_support ? "attention" : undefined} label={tr("Open support", "ជំនួយបើក")} value={data.open_support} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card lg:col-span-2">
          <h2 className="border-b px-4 py-3 font-display font-semibold">{tr("Orders per day (30 days)", "កុម្ម៉ង់ប្រចាំថ្ងៃ (៣០ថ្ងៃ)")}</h2>
          <DailyBars rows={data.daily_orders} />
        </section>
        <section className="rounded-xl border bg-card p-4" data-testid="admin-by-plan">
          <h2 className="font-display font-semibold">{tr("Restaurants by plan", "ភោជនីយដ្ឋានតាមគម្រោង")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {plans.map(([k, name]) => (
              <li key={k} className="flex justify-between" data-testid={`admin-plan-count-${k}`}><span>{name}</span><span className="font-semibold tabular">{data.by_plan[k] || 0}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
