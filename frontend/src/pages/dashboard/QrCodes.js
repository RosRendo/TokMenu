import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, publicOrigin } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { tableMenuUrl } from "@/lib/qr";
import { useDash } from "./context";
import { QrImage } from "./Tables";

function QrCard({ restaurant, label, url, testId }) {
  return (
    <div className="qr-card flex flex-col items-center rounded-2xl border bg-white p-6 text-center text-charcoal" data-testid={testId}>
      <p className="font-display text-lg font-bold leading-tight">{restaurant.name}</p>
      {restaurant.name_km && <p className="font-display text-sm text-stone-600">{restaurant.name_km}</p>}
      <p className="mt-3 rounded-full bg-charcoal px-4 py-1 font-display text-base font-bold text-white">{label}</p>
      <QrImage text={url} size={420} className="mt-4 h-44 w-44" />
      <p className="mt-3 text-sm font-semibold">Scan to see the menu & order</p>
      <p className="font-display text-sm">ស្កេនដើម្បីមើលម៉ឺនុយ និងកុម្ម៉ង់</p>
      <p className="mt-2 text-[11px] text-stone-500">Pay at the counter · បង់ប្រាក់នៅបញ្ជរ</p>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-stone-400">Tok Menu</p>
    </div>
  );
}

export default function QrCodes() {
  const { tr } = useI18n();
  const { restaurant } = useDash();
  const [tables, setTables] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [includeMenu, setIncludeMenu] = useState(true);
  const origin = publicOrigin();

  useEffect(() => {
    api.get("/dashboard/tables").then(({ data }) => {
      setTables(data);
      setSelected(new Set(data.map((t) => t.id)));
    }).catch(() => setTables([]));
  }, []);

  if (tables === null) return <PageLoader />;
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const chosen = tables.filter((t) => selected.has(t.id));

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={tr("Print QR cards", "បោះពុម្ពកាត QR")}
          description={tr("Cards print 4 per A4 page. Cut along the dashed lines and place one on each table.", "បោះពុម្ព ៤ កាតក្នុងមួយទំព័រ A4។ កាត់តាមបន្ទាត់ ហើយដាក់លើតុនីមួយៗ។")}
          actions={<Button onClick={() => window.print()} disabled={!chosen.length && !includeMenu} data-testid="qr-print-button"><Printer />{tr("Print", "បោះពុម្ព")}</Button>}
        />
        {tables.length === 0 ? (
          <EmptyState title={tr("Create tables first", "បង្កើតតុជាមុនសិន")} testId="qr-no-tables" action={<Button asChild><Link to="/dashboard/tables">{tr("Go to tables", "ទៅកាន់តុ")}</Link></Button>}>
            {tr("You can still print the restaurant-wide menu QR below.", "អ្នកនៅតែអាចបោះពុម្ពកូដ QR ម៉ឺនុយខាងក្រោម។")}
          </EmptyState>
        ) : (
          <div className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-card p-3" data-testid="qr-selection">
            <label className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><Checkbox checked={includeMenu} onCheckedChange={(v) => setIncludeMenu(!!v)} data-testid="qr-include-menu" />{tr("Menu QR (no table)", "QR ម៉ឺនុយ")}</label>
            {tables.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} data-testid={`qr-select-${t.id}`} />{t.label}</label>
            ))}
          </div>
        )}
      </div>
      <div className="print-sheet grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="qr-sheet">
        {includeMenu && <QrCard restaurant={restaurant} label={tr("Menu", "ម៉ឺនុយ")} url={tableMenuUrl(origin, restaurant.slug)} testId="qr-card-menu" />}
        {chosen.map((t) => <QrCard key={t.id} restaurant={restaurant} label={t.label} url={tableMenuUrl(origin, restaurant.slug, t.token)} testId={`qr-card-${t.id}`} />)}
      </div>
    </div>
  );
}
