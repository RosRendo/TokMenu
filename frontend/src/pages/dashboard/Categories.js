import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmAction } from "@/components/ConfirmAction";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function CategoryDialog({ category, onClose, onSaved }) {
  const { tr } = useI18n();
  const [form, setForm] = useState({ name: category?.name || "", name_km: category?.name_km || "" });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(tr("Name is required", "ត្រូវការឈ្មោះ"));
    setBusy(true);
    try {
      await api.put(`/dashboard/categories/${category.id}`, form);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="category-edit-dialog">
        <DialogHeader><DialogTitle>{tr("Rename category", "ប្ដូរឈ្មោះប្រភេទ")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5"><Label>English</Label><Input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-edit-name" /></div>
          <div className="space-y-1.5"><Label>ខ្មែរ</Label><Input value={form.name_km} maxLength={60} onChange={(e) => setForm({ ...form, name_km: e.target.value })} data-testid="category-edit-name-km" /></div>
          <DialogFooter><Button type="submit" disabled={busy} data-testid="category-edit-save">{tr("Save", "រក្សាទុក")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Categories() {
  const { tr } = useI18n();
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ name: "", name_km: "" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get("/dashboard/categories");
    setList(data);
  }, []);
  useEffect(() => {
    load().catch(() => setList([]));
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(tr("Enter a category name", "បញ្ចូលឈ្មោះប្រភេទ"));
    setBusy(true);
    try {
      await api.post("/dashboard/categories", form);
      setForm({ name: "", name_km: "" });
      toast.success(tr("Category added", "បានបន្ថែមប្រភេទ"));
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const active = (list || []).filter((c) => !c.archived);
  const archived = (list || []).filter((c) => c.archived);
  const move = async (index, dir) => {
    const ids = active.map((c) => c.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    setList([...ids.map((id) => active.find((c) => c.id === id)), ...archived]);
    try {
      await api.post("/dashboard/category-order", { ids });
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    }
  };
  const setArchived = async (c, archive) => {
    try {
      await api.post(`/dashboard/categories/${c.id}/${archive ? "archive" : "restore"}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (list === null) return <PageLoader />;

  return (
    <div className="max-w-3xl">
      <PageHeader title={tr("Categories", "ប្រភេទ")} description={tr("The order here is the order customers see on the menu.", "លំដាប់នៅទីនេះគឺជាលំដាប់ដែលអតិថិជនឃើញ។")} />
      <form onSubmit={add} className="mb-6 grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]" data-testid="category-add-form">
        <Input placeholder={tr("Name, e.g. Drinks", "ឈ្មោះ ឧ. Drinks")} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-name-input" />
        <Input placeholder="ខ្មែរ ឧ. ភេសជ្ជៈ" value={form.name_km} maxLength={60} onChange={(e) => setForm({ ...form, name_km: e.target.value })} data-testid="category-name-km-input" />
        <Button type="submit" disabled={busy} data-testid="category-add-button"><Plus />{tr("Add", "បន្ថែម")}</Button>
      </form>
      {active.length === 0 ? (
        <EmptyState icon={Tags} title={tr("No categories yet", "មិនទាន់មានប្រភេទ")} testId="categories-empty">{tr("Try Food, Drinks, Desserts and Specials.", "សាកល្បង ម្ហូប ភេសជ្ជៈ បង្អែម និងពិសេស។")}</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card" data-testid="categories-list">
          {active.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-3" data-testid={`category-row-${c.id}`}>
              <div className="flex flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 hover:bg-secondary disabled:opacity-30" aria-label={tr("Move up", "ឡើងលើ")} data-testid={`category-up-${c.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={i === active.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 hover:bg-secondary disabled:opacity-30" aria-label={tr("Move down", "ចុះក្រោម")} data-testid={`category-down-${c.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.name_km || "—"} · {c.item_count} {tr("items", "មុខ")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(c)} data-testid={`category-edit-${c.id}`}><Pencil />{tr("Rename", "ប្ដូរឈ្មោះ")}</Button>
              <ConfirmAction
                testId={`category-archive-confirm-${c.id}`}
                trigger={<Button variant="ghost" size="sm" data-testid={`category-archive-${c.id}`}>{tr("Archive", "ដកចេញ")}</Button>}
                title={tr("Archive this category?", "ដកប្រភេទនេះចេញ?")}
                description={tr("Its items will be hidden from customers. Nothing is deleted and you can restore it later.", "មុខម្ហូបរបស់វានឹងត្រូវលាក់។ គ្មានអ្វីត្រូវលុបទេ។")}
                confirmLabel={tr("Archive", "ដកចេញ")}
                onConfirm={() => setArchived(c, true)}
              />
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{tr("Archived", "បានដកចេញ")}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                <span>{c.name} {c.name_km && `· ${c.name_km}`}</span>
                <Button variant="outline" size="sm" onClick={() => setArchived(c, false)} data-testid={`category-restore-${c.id}`}>{tr("Restore", "ស្ដារ")}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editing && <CategoryDialog category={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}
