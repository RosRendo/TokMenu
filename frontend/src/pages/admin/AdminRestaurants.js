import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { formatDate, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function useRestaurants() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/restaurants", { params: { q, status: status || undefined } });
      setRows(data);
    } catch (e) {
      setRows(false);
    }
  }, [q, status]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  return { rows, q, setQ, status, setStatus, load };
}

export function RestaurantFilters({ q, setQ, status, setStatus }) {
  const { tr } = useI18n();
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search name or slug", "ស្វែងរកឈ្មោះ")} className="pl-9" data-testid="admin-restaurant-search" />
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm" data-testid="admin-restaurant-status-filter">
        <option value="">{tr("All statuses", "គ្រប់ស្ថានភាព")}</option>
        <option value="active">{tr("Active", "សកម្ម")}</option>
        <option value="suspended">{tr("Suspended", "ផ្អាក")}</option>
      </select>
    </div>
  );
}

function SuspendDialog({ restaurant, onClose, onDone }) {
  const { tr } = useI18n();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/restaurants/${restaurant.id}/suspend`, { reason });
      toast.success(tr("Restaurant suspended", "បានផ្អាក"));
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="admin-suspend-dialog">
        <DialogHeader>
          <DialogTitle>{tr("Suspend", "ផ្អាក")} {restaurant.name}?</DialogTitle>
          <DialogDescription>{tr("The public menu will show “temporarily unavailable” and staff can't use the dashboard until you reactivate it.", "ម៉ឺនុយសាធារណៈនឹងមិនអាចប្រើបាន រហូតដល់បើកវិញ។")}</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={tr("Reason (internal)", "មូលហេតុ")} data-testid="admin-suspend-reason" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="admin-suspend-cancel">{tr("Cancel", "បោះបង់")}</Button>
          <Button variant="destructive" onClick={submit} disabled={busy} data-testid="admin-suspend-confirm">{tr("Suspend", "ផ្អាក")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ r, onSuspend, onReactivate }) {
  const { tr, lang } = useI18n();
  const suspended = r.status === "suspended";
  return (
    <tr className="border-t align-top" data-testid={`admin-restaurant-row-${r.slug}`}>
      <td className="px-4 py-3">
        <p className="font-semibold">{r.name} {r.is_demo && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase text-accent-foreground">Demo</span>}</p>
        <p className="text-xs text-muted-foreground">/{r.slug} · {formatDate(r.created_at, lang)}</p>
      </td>
      <td className="px-4 py-3 text-xs"><p>{r.owner_name}</p><p className="text-muted-foreground">{r.owner_email}</p></td>
      <td className="px-4 py-3 text-xs">{r.subscription?.plan || "trial"} · {r.subscription?.status || "—"}</td>
      <td className="px-4 py-3 text-right tabular">{r.orders_30d}</td>
      <td className="px-4 py-3 text-right tabular">{r.items}</td>
      <td className="px-4 py-3">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", suspended ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")} data-testid={`admin-restaurant-status-${r.slug}`}>{suspended ? tr("Suspended", "ផ្អាក") : tr("Active", "សកម្ម")}</span>
        {suspended && r.suspended_reason && <p className="mt-1 max-w-[180px] text-xs text-muted-foreground">{r.suspended_reason}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost" size="sm" data-testid={`admin-open-menu-${r.slug}`}><a href={`/menu/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>
          {suspended
            ? <Button size="sm" variant="outline" onClick={() => onReactivate(r)} data-testid={`admin-reactivate-${r.slug}`}>{tr("Reactivate", "បើកវិញ")}</Button>
            : <Button size="sm" variant="outline" className="text-destructive" onClick={() => onSuspend(r)} data-testid={`admin-suspend-${r.slug}`}>{tr("Suspend", "ផ្អាក")}</Button>}
        </div>
      </td>
    </tr>
  );
}

export default function AdminRestaurants() {
  const { tr } = useI18n();
  const { rows, load, ...filters } = useRestaurants();
  const [suspending, setSuspending] = useState(null);
  const reactivate = async (r) => {
    try {
      await api.post(`/admin/restaurants/${r.id}/reactivate`);
      toast.success(tr("Restaurant reactivated", "បានបើកវិញ"));
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div>
      <PageHeader title={tr("Restaurants", "ភោជនីយដ្ឋាន")} description={tr("Suspend or reactivate restaurant accounts. Every action is written to the audit log.", "រាល់សកម្មភាពត្រូវបានកត់ត្រា។")} />
      <RestaurantFilters {...filters} />
      {rows === null ? <PageLoader /> : !rows ? <p className="text-sm">{tr("Couldn't load restaurants.", "មិនអាចផ្ទុកបាន។")}</p> : rows.length === 0 ? (
        <EmptyState title={tr("No restaurants match", "គ្មានលទ្ធផល")} testId="admin-restaurants-empty" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[860px] text-sm" data-testid="admin-restaurants-table">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2">{tr("Restaurant", "ភោជនីយដ្ឋាន")}</th><th className="px-4 py-2">{tr("Owner", "ម្ចាស់")}</th><th className="px-4 py-2">{tr("Plan", "គម្រោង")}</th><th className="px-4 py-2 text-right">{tr("Orders 30d", "កុម្ម៉ង់")}</th><th className="px-4 py-2 text-right">{tr("Items", "មុខម្ហូប")}</th><th className="px-4 py-2">{tr("Status", "ស្ថានភាព")}</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>{rows.map((r) => <Row key={r.id} r={r} onSuspend={setSuspending} onReactivate={reactivate} />)}</tbody>
          </table>
        </div>
      )}
      {suspending && <SuspendDialog restaurant={suspending} onClose={() => setSuspending(null)} onDone={() => { setSuspending(null); load(); }} />}
    </div>
  );
}
