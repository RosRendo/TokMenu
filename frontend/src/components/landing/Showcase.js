import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ShoppingBag } from "lucide-react";
import { api, imgUrl } from "@/lib/api";
import { MOCK_DEMO_MENU } from "@/lib/mockDemoMenu";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function SampleMenu() {
  const { tr, loc } = useI18n();
  const [menu, setMenu] = useState(null);
  const [cat, setCat] = useState(null);
  const [picked, setPicked] = useState({});

  useEffect(() => {
    api.get("/public/menu/demo").then(({ data }) => {
      if (data && Array.isArray(data.categories) && Array.isArray(data.items)) {
        setMenu(data);
        setCat(data.categories[0]?.id || null);
      } else {
        setMenu(MOCK_DEMO_MENU);
        setCat(MOCK_DEMO_MENU.categories?.[0]?.id || null);
      }
    }).catch(() => {
      setMenu(MOCK_DEMO_MENU);
      setCat(MOCK_DEMO_MENU.categories?.[0]?.id || null);
    });
  }, []);

  const items = useMemo(() => (menu?.items ? menu.items.filter((i) => i.category_id === cat) : []), [menu, cat]);
  const count = Object.values(picked).reduce((a, b) => a + b, 0);
  const total = menu?.items ? menu.items.reduce((sum, i) => sum + (picked[i.id] || 0) * i.price, 0) : 0;

  return (
    <div className="relative mx-auto w-[300px] sm:w-[330px]" data-testid="sample-menu">
      <div className="overflow-hidden rounded-[2.4rem] border-[10px] border-charcoal bg-background shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]">
        <div className="h-[560px] overflow-y-auto no-scrollbar">
          {menu === null && <div className="p-6 text-sm text-muted-foreground">{tr("Loading the demo menu…", "កំពុងផ្ទុក…")}</div>}
          {menu === false && <div className="p-6 text-sm text-muted-foreground">{tr("Demo menu unavailable right now.", "ម៉ឺនុយសាកល្បងមិនអាចប្រើបានទេពេលនេះ។")}</div>}
          {menu && (
            <>
              <div className="relative h-28 bg-secondary">
                {menu.restaurant?.cover_url && <img src={imgUrl(menu.restaurant.cover_url)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Demo</span>
              </div>
              <div className="px-4 pt-3">
                <p className="font-display text-lg font-bold">{loc(menu.restaurant || {})}</p>
                <p className="text-[11px] text-muted-foreground">{tr("Sample content · prices are examples", "ទិន្នន័យគំរូ · តម្លៃជាឧទាហរណ៍")}</p>
              </div>
              <div className="no-scrollbar sticky top-0 z-10 mt-2 flex gap-1.5 overflow-x-auto border-b bg-background px-4 py-2">
                {(menu.categories || []).map((c) => (
                  <button key={c.id} type="button" onClick={() => setCat(c.id)} data-testid={`sample-menu-cat-${c.id}`}
                    className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", cat === c.id ? "border-foreground bg-foreground text-background" : "bg-card")}>
                    {loc(c)}
                  </button>
                ))}
              </div>
              <ul className="divide-y px-4 pb-20">
                {(items || []).map((i) => (
                  <li key={i.id} className={cn("flex gap-3 py-3", !i.available && "opacity-50")}>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold leading-snug">{loc(i)}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{loc(i, "description")}</p>
                      <p className="mt-1 text-xs font-semibold tabular">{formatMoney(i.price, menu.settings?.currency || "USD")}</p>
                    </div>
                    <div className="relative h-16 w-16 shrink-0">
                      {i.image_url ? <img src={imgUrl(i.image_url)} alt="" loading="lazy" className="h-full w-full rounded-lg object-cover" /> : <div className="h-full w-full rounded-lg bg-secondary" />}
                      {i.available && (
                        <button type="button" aria-label={`${tr("Add", "បន្ថែម")} ${loc(i)}`} data-testid={`sample-menu-add-${i.id}`}
                          onClick={() => setPicked((p) => ({ ...p, [i.id]: (p[i.id] || 0) + 1 }))}
                          className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-primary text-white">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {count > 0 && menu && (
          <div className="absolute inset-x-[18px] bottom-[18px]">
            <Link to="/menu/demo" className="flex items-center justify-between rounded-xl bg-charcoal px-4 py-3 text-xs font-semibold text-white" data-testid="sample-menu-cart">
              <span className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" />{count} {tr("items", "មុខ")}</span>
              <span className="tabular">{formatMoney(total, menu.settings.currency)}</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

const PREVIEW = [
  { col: "New", km: "ថ្មី", dot: "bg-blue-500", orders: [["#014", "Table 3", ["2 × Iced Coffee · Less sweet", "1 × Fish Amok"], "$9.50"]] },
  { col: "Preparing", km: "កំពុងរៀបចំ", dot: "bg-amber-500", orders: [["#012", "Terrace 1", ["1 × Beef Lok Lak · Fried egg", "1 × Fresh Coconut"], "$8.00"], ["#011", "Table 6", ["2 × Kuy Teav · Large"], "$9.00"]] },
  { col: "Ready", km: "រួចរាល់", dot: "bg-emerald-500", orders: [["#010", "Table 1", ["1 × Mango Sticky Rice"], "$2.50"]] },
];

export function DashboardPreview() {
  const { tr } = useI18n();
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" data-testid="dashboard-preview">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500" />{tr("Orders · live", "ការកុម្ម៉ង់ · ផ្ទាល់")}</div>
        <span className="text-[11px] text-muted-foreground">{tr("Illustration with demo data", "រូបភាពឧទាហរណ៍ជាមួយទិន្នន័យគំរូ")}</span>
      </div>
      <div className="grid gap-3 bg-secondary/60 p-3 sm:grid-cols-3">
        {PREVIEW.map((c) => (
          <div key={c.col}>
            <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", c.dot)} />{tr(c.col, c.km)}</p>
            <div className="space-y-2">
              {c.orders.map(([n, t, lines, total]) => (
                <div key={n} className="rounded-xl border bg-card p-3 text-xs">
                  <div className="flex justify-between font-semibold"><span>{n} · {t}</span><span className="tabular">{total}</span></div>
                  <ul className="mt-1.5 space-y-0.5 text-muted-foreground">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
