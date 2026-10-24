import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { formatDate, useI18n } from "@/lib/i18n";
import { RestaurantFilters, useRestaurants } from "./AdminRestaurants";

const PLANS = [["trial", "Free Trial"], ["starter", "Starter"], ["pro", "Pro"]];
const STATUSES = ["trialing", "active", "past_due", "expired", "cancelled"];
const selectCls = "h-10 w-full rounded-md border bg-card px-3 text-sm";

function EditDialog({ restaurant, onClose, onDone }) {
  const { tr } = useI18n();
  const sub = restaurant.subscription || {};
  const [form, setForm] = useState({
    plan: sub.plan || "trial", status: sub.status || "trialing",
    current_period_end: sub.current_period_end ? sub.current_period_end.slice(0, 10) : "", notes: sub.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/subscriptions/${restaurant.id}`, { ...form, current_period_end: form.current_period_end || null });
      toast.success(tr("Subscription updated", "បានធ្វើបច្ចុប្បន្នភាព"));
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="admin-subscription-dialog">
        <DialogHeader>
          <DialogTitle>{restaurant.name}</DialogTitle>
          <DialogDescription>{tr("Record a manual plan change after payment is confirmed offline.", "កត់ត្រាការផ្លាស់ប្ដូរគម្រោងបន្ទាប់ពីបញ្ជាក់ការបង់ប្រាក់។")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>{tr("Plan", "គម្រោង")}</Label>
            <select value={form.plan} onChange={set("plan")} className={selectCls} data-testid="admin-sub-plan">{PLANS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
          <div className="space-y-1"><Label>{tr("Status", "ស្ថានភាព")}</Label>
            <select value={form.status} onChange={set("status")} className={selectCls} data-testid="admin-sub-status">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="space-y-1 sm:col-span-2"><Label>{tr("Period end", "កាលបរិច្ឆេទបញ្ចប់")}</Label>
            <Input type="date" value={form.current_period_end} onChange={set("current_period_end")} data-testid="admin-sub-end" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>{tr("Notes (internal)", "កំណត់ចំណាំ")}</Label>
            <Textarea rows={2} maxLength={500} value={form.notes} onChange={set("notes")} placeholder={tr("e.g. Paid by bank transfer, ref …", "ឧ. បង់តាមធនាគារ")} data-testid="admin-sub-notes" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="admin-sub-cancel">{tr("Cancel", "បោះបង់")}</Button>
          <Button onClick={save} disabled={busy} data-testid="admin-sub-save">{tr("Save", "រក្សាទុក")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSubscriptions() {
  const { tr, lang } = useI18n();
  const { rows, load, ...filters } = useRestaurants();
  const [editing, setEditing] = useState(null);
  return (
    <div>
      <PageHeader title={tr("Subscriptions", "គម្រោង")} description={tr("No card payments are processed. Change plans here once a restaurant has paid you offline.", "មិនដំណើរការការបង់ប្រាក់តាមកាតទេ។")} />
      <RestaurantFilters {...filters} />
      {rows === null ? <PageLoader /> : !rows ? <p className="text-sm">{tr("Couldn't load subscriptions.", "មិនអាចផ្ទុកបាន។")}</p> : rows.length === 0 ? (
        <EmptyState title={tr("No restaurants match", "គ្មានលទ្ធផល")} testId="admin-subs-empty" />
      ) : (
        <ul className="divide-y rounded-xl border bg-card" data-testid="admin-subscriptions-list">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-testid={`admin-sub-row-${r.slug}`}>
              <div className="min-w-[180px] flex-1"><p className="font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">{r.owner_email}</p></div>
              <span className="w-24 font-medium" data-testid={`admin-sub-plan-${r.slug}`}>{r.subscription?.plan || "trial"}</span>
              <span className="w-24 text-xs" data-testid={`admin-sub-status-${r.slug}`}>{r.subscription?.status || "—"}</span>
              <span className="w-32 text-xs text-muted-foreground">{r.subscription?.current_period_end ? formatDate(r.subscription.current_period_end, lang) : "—"}</span>
              <Button size="sm" variant="outline" onClick={() => setEditing(r)} data-testid={`admin-sub-edit-${r.slug}`}>{tr("Edit", "កែ")}</Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <EditDialog restaurant={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
}
