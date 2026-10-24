import { useCallback, useEffect, useRef, useState } from "react";
import { BellOff, BellRing, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { STATUS_DOT } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { STATUS_LABELS, useI18n } from "@/lib/i18n";
import { useInterval, useLiveSocket, useOrderSound } from "@/lib/live";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { OrderCard } from "./OrderCard";

const COLUMNS = ["PENDING", "ACCEPTED", "PREPARING", "READY"];

export function OrderBoard() {
  const { tr } = useI18n();
  const { restaurant } = useDash();
  const [orders, setOrders] = useState(null);
  const [fresh, setFresh] = useState(() => new Set());
  const [, setTick] = useState(0);
  const known = useRef(null);
  const sound = useOrderSound();

  const markFresh = useCallback((ids) => {
    if (!ids.length) return;
    sound.play();
    setFresh((prev) => new Set([...prev, ...ids]));
    setTimeout(() => setFresh((prev) => new Set([...prev].filter((id) => !ids.includes(id)))), 6000);
  }, [sound]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard/orders/active");
      const pendingIds = data.orders.filter((o) => o.status === "PENDING").map((o) => o.id);
      if (known.current) markFresh(pendingIds.filter((id) => !known.current.has(id)));
      known.current = new Set([...(known.current || []), ...data.orders.map((o) => o.id)]);
      setOrders(data.orders);
    } catch (e) {
      setOrders((prev) => prev || []);
    }
  }, [markFresh]);

  const upsert = useCallback((order) => {
    setOrders((prev) => {
      const rest = (prev || []).filter((o) => o.id !== order.id);
      return COLUMNS.includes(order.status) ? [...rest, order].sort((a, b) => a.created_at.localeCompare(b.created_at)) : rest;
    });
  }, []);

  const live = useLiveSocket("/ws/dashboard", (msg) => {
    if (!msg.order) return;
    if (msg.type === "order.created" && !(known.current || new Set()).has(msg.order.id)) {
      known.current = new Set([...(known.current || []), msg.order.id]);
      markFresh([msg.order.id]);
      toast.info(`${tr("New order", "ការកុម្ម៉ង់ថ្មី")} #${String(msg.order.daily_number).padStart(3, "0")} · ${msg.order.table_label || msg.order.customer_label || ""}`);
    }
    upsert(msg.order);
  });

  useEffect(() => {
    load();
  }, [load]);
  useInterval(load, live ? 60000 : 10000);
  useInterval(() => setTick((t) => t + 1), 30000);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", live ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800")} data-testid="board-connection-status">
          {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {live ? tr("Live", "ផ្ទាល់") : tr("Reconnecting · refreshing every 10s", "កំពុងភ្ជាប់ឡើងវិញ · ផ្ទុករៀងរាល់ ១០ វិនាទី")}
        </span>
        <Button variant="outline" size="sm" onClick={load} data-testid="board-refresh-button"><RefreshCw />{tr("Refresh", "ផ្ទុកឡើងវិញ")}</Button>
        <Button variant={sound.enabled ? "secondary" : "outline"} size="sm" onClick={sound.enabled ? sound.disable : () => { sound.enable(); toast.success(tr("Sound on for new orders", "បើកសំឡេងសម្រាប់ការកុម្ម៉ង់ថ្មី")); }} data-testid="board-sound-toggle">
          {sound.enabled ? <BellRing /> : <BellOff />}{sound.enabled ? tr("Sound on", "សំឡេងបើក") : tr("Enable sound", "បើកសំឡេង")}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="order-board">
        {COLUMNS.map((status) => {
          const list = (orders || []).filter((o) => o.status === status);
          return (
            <section key={status} className="rounded-xl bg-secondary/70 p-2" data-testid={`board-column-${status}`}>
              <h2 className="flex items-center justify-between px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />{tr(...STATUS_LABELS[status])}</span>
                <span className="rounded-full bg-card px-2 py-0.5 tabular text-foreground" data-testid={`board-count-${status}`}>{list.length}</span>
              </h2>
              <div className="space-y-2">
                {orders === null && <div className="h-24 animate-pulse rounded-xl bg-card" />}
                {orders && list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">{status === "PENDING" ? tr("No new orders", "គ្មានការកុម្ម៉ង់ថ្មី") : "—"}</p>}
                {list.map((o) => <OrderCard key={o.id} order={o} onChanged={upsert} onStale={load} fresh={fresh.has(o.id)} tz={restaurant.settings.timezone} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
