import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Download, Grid3x3, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmAction } from "@/components/ConfirmAction";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage, publicOrigin } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { downloadQr, qrDataUrl, tableMenuUrl } from "@/lib/qr";
import { useDash } from "./context";

export function QrImage({ text, size = 256, className, testId }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    qrDataUrl(text, size).then((u) => alive && setSrc(u));
    return () => { alive = false; };
  }, [text, size]);
  return src ? <img src={src} alt="QR code" className={className} data-testid={testId} /> : <div className={className} />;
}

const copy = async (text, tr) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(tr("Link copied", "បានចម្លងតំណ"));
  } catch (e) {
    toast.error(text);
  }
};

function RenameDialog({ table, onClose, onSaved }) {
  const { tr } = useI18n();
  const [label, setLabel] = useState(table.label);
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/dashboard/tables/${table.id}`, { label });
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tr("Rename table", "ប្ដូរឈ្មោះតុ")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Input value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} data-testid="table-rename-input" />
          <p className="text-xs text-muted-foreground">{tr("The QR code stays the same.", "កូដ QR នៅដដែល។")}</p>
          <DialogFooter><Button type="submit" data-testid="table-rename-save">{tr("Save", "រក្សាទុក")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkDialog({ onClose, onSaved }) {
  const { tr } = useI18n();
  const [form, setForm] = useState({ prefix: "Table", start: 1, count: 10 });
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/dashboard/tables/bulk", { prefix: form.prefix, start: Number(form.start), count: Number(form.count) });
      toast.success(`${data.created} ${tr("tables created", "តុត្រូវបានបង្កើត")}`);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="tables-bulk-dialog">
        <DialogHeader><DialogTitle>{tr("Add several tables", "បន្ថែមតុច្រើន")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>{tr("Name", "ឈ្មោះ")}</Label><Input value={form.prefix} maxLength={20} onChange={(e) => setForm({ ...form, prefix: e.target.value })} data-testid="tables-bulk-prefix" /></div>
            <div className="space-y-1.5"><Label>{tr("Start at", "ចាប់ពី")}</Label><Input type="number" min={0} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} data-testid="tables-bulk-start" /></div>
            <div className="space-y-1.5"><Label>{tr("How many", "ចំនួន")}</Label><Input type="number" min={1} max={50} value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} data-testid="tables-bulk-count" /></div>
          </div>
          <p className="text-xs text-muted-foreground">{tr("Creates", "បង្កើត")} “{form.prefix} {form.start}” … “{form.prefix} {Number(form.start) + Number(form.count) - 1}”</p>
          <DialogFooter><Button type="submit" data-testid="tables-bulk-save">{tr("Create tables", "បង្កើតតុ")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Tables() {
  const { tr } = useI18n();
  const { restaurant, plan } = useDash();
  const [tables, setTables] = useState(null);
  const [label, setLabel] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [bulk, setBulk] = useState(false);
  const origin = publicOrigin();
  const slug = restaurant.slug;

  const load = useCallback(async () => {
    const { data } = await api.get("/dashboard/tables");
    setTables(data);
  }, []);
  useEffect(() => {
    load().catch(() => setTables([]));
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!label.trim()) return toast.error(tr("Enter a table name, e.g. Table 1", "បញ្ចូលឈ្មោះតុ"));
    try {
      await api.post("/dashboard/tables", { label });
      setLabel("");
      toast.success(tr("Table added", "បានបន្ថែមតុ"));
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const regenerate = async (t) => {
    try {
      await api.post(`/dashboard/tables/${t.id}/regenerate`);
      toast.success(tr("New QR code created. Print it again.", "បានបង្កើតកូដ QR ថ្មី។ សូមបោះពុម្ពម្ដងទៀត។"));
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (t) => {
    try {
      await api.delete(`/dashboard/tables/${t.id}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (tables === null) return <PageLoader />;
  const menuUrl = tableMenuUrl(origin, slug);

  return (
    <div>
      <PageHeader
        title={tr("Tables & QR codes", "តុ និងកូដ QR")}
        description={`${tables.length}${plan.max_tables ? ` / ${plan.max_tables}` : ""} ${tr("tables. Each table has its own QR code so orders arrive with the table name.", "តុ។ តុនីមួយៗមានកូដ QR ផ្ទាល់ខ្លួន។")}`}
        actions={<>
          <Button variant="outline" onClick={() => setBulk(true)} data-testid="tables-bulk-button"><Plus />{tr("Add several", "បន្ថែមច្រើន")}</Button>
          <Button asChild data-testid="tables-print-button"><Link to="/dashboard/qr-codes"><Printer />{tr("Print QR cards", "បោះពុម្ពកាត QR")}</Link></Button>
        </>}
      />
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center" data-testid="restaurant-qr">
        <QrImage text={menuUrl} size={192} className="h-24 w-24 rounded-lg border" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">{tr("Restaurant menu QR (no table)", "កូដ QR ម៉ឺនុយ (គ្មានតុ)")}</p>
          <p className="text-sm text-muted-foreground">{tr("For the counter, flyers or social media. Customers enter their name or table when ordering.", "សម្រាប់បញ្ជរ ឬបណ្ដាញសង្គម។ អតិថិជនបញ្ចូលឈ្មោះ ឬលេខតុ។")}</p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{menuUrl}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(menuUrl, tr)} data-testid="restaurant-qr-copy"><Copy />{tr("Copy link", "ចម្លងតំណ")}</Button>
          <Button variant="outline" size="sm" onClick={() => downloadQr(menuUrl, `${slug}-menu-qr.png`)} data-testid="restaurant-qr-download"><Download />PNG</Button>
        </div>
      </section>
      <form onSubmit={add} className="mb-4 flex gap-2" data-testid="table-add-form">
        <Input value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder={tr("Table name, e.g. Table 1 or Terrace 2", "ឈ្មោះតុ ឧ. តុ ១")} className="max-w-sm" data-testid="table-label-input" />
        <Button type="submit" data-testid="table-add-button"><Plus />{tr("Add table", "បន្ថែមតុ")}</Button>
      </form>
      {tables.length === 0 ? (
        <EmptyState icon={Grid3x3} title={tr("No tables yet", "មិនទាន់មានតុ")} testId="tables-empty">{tr("Add your tables, then print a QR card for each one.", "បន្ថែមតុ រួចបោះពុម្ពកាត QR សម្រាប់តុនីមួយៗ។")}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="tables-list">
          {tables.map((t) => {
            const url = tableMenuUrl(origin, slug, t.token);
            return (
              <li key={t.id} className="flex gap-3 rounded-xl border bg-card p-3" data-testid={`table-row-${t.id}`}>
                <QrImage text={url} size={192} className="h-20 w-20 shrink-0 rounded-lg border" testId={`table-qr-${t.id}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold" data-testid={`table-label-${t.id}`}>{t.label}</p>
                  <a href={url} target="_blank" rel="noreferrer" className="block truncate font-mono text-[11px] text-muted-foreground hover:underline" data-testid={`table-link-${t.id}`}>{url}</a>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={() => downloadQr(url, `${slug}-${t.label.replace(/\s+/g, "-").toLowerCase()}-qr.png`)} data-testid={`table-download-${t.id}`}><Download />PNG</Button>
                    <Button variant="ghost" size="sm" onClick={() => copy(url, tr)} aria-label={tr("Copy link", "ចម្លងតំណ")} data-testid={`table-copy-${t.id}`}><Copy /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setRenaming(t)} aria-label={tr("Rename", "ប្ដូរឈ្មោះ")} data-testid={`table-rename-${t.id}`}><Pencil /></Button>
                    <ConfirmAction testId={`table-regenerate-confirm-${t.id}`}
                      trigger={<Button variant="ghost" size="sm" aria-label={tr("New QR code", "កូដ QR ថ្មី")} data-testid={`table-regenerate-${t.id}`}><RefreshCw /></Button>}
                      title={tr("Create a new QR code?", "បង្កើតកូដ QR ថ្មី?")} description={tr("The printed QR code for this table will stop working. Use this if a card was lost or copied.", "កូដ QR ដែលបានបោះពុម្ពនឹងលែងដំណើរការ។")}
                      confirmLabel={tr("Create new QR", "បង្កើតថ្មី")} onConfirm={() => regenerate(t)} />
                    <ConfirmAction testId={`table-delete-confirm-${t.id}`}
                      trigger={<Button variant="ghost" size="sm" aria-label={tr("Delete", "លុប")} data-testid={`table-delete-${t.id}`}><Trash2 /></Button>}
                      title={tr("Delete this table?", "លុបតុនេះ?")} description={tr("Its QR code stops working. Past orders keep the table name.", "កូដ QR លែងដំណើរការ។ ការកុម្ម៉ង់ចាស់រក្សាឈ្មោះតុ។")}
                      confirmLabel={tr("Delete", "លុប")} onConfirm={() => remove(t)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {renaming && <RenameDialog table={renaming} onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); load(); }} />}
      {bulk && <BulkDialog onClose={() => setBulk(false)} onSaved={() => { setBulk(false); load(); }} />}
    </div>
  );
}
