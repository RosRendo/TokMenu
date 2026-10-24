import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/Brand";
import { api } from "@/lib/api";
import { getMyOrders, getTable, saveTable, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MenuHeader } from "./MenuHeader";
import { FeaturedCard, ItemRow } from "./ItemCards";
import { ItemSheet } from "./ItemSheet";
import { closedMessage, useMenu } from "./useMenu";

export function MenuShell({ children }) {
  return (
    <div className="min-h-screen bg-[#EEEDE8]">
      <div className="mx-auto min-h-screen max-w-md bg-background pb-32 sm:shadow-sm">{children}</div>
    </div>
  );
}

export function MenuMessage({ title, children, testId }) {
  return (
    <MenuShell>
      <div className="flex min-h-[70vh] flex-col items-start justify-center gap-3 px-6" data-testid={testId}>
        <BrandMark />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </MenuShell>
  );
}

function MenuSkeleton() {
  return (
    <MenuShell>
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    </MenuShell>
  );
}

export function CartBar({ slug, count, subtotal, currency }) {
  const { tr } = useI18n();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-safe">
      <div className="mx-auto max-w-md">
        <Link to={`/menu/${slug}/cart`} data-testid="cart-bar"
          className="flex items-center justify-between rounded-2xl bg-charcoal px-5 py-4 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.99]">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-4 w-4" />
            <span data-testid="cart-bar-count">{count}</span> {tr(count === 1 ? "item" : "items", "មុខ")}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold">
            {tr("View cart", "មើលកន្ត្រក")} · <span className="tabular" data-testid="cart-bar-total">{formatMoney(subtotal, currency)}</span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

function useScrollSpy(ids) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (!ids.length || !("IntersectionObserver" in window)) return undefined;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id.replace("cat-", ""));
    }, { rootMargin: "-110px 0px -65% 0px" });
    ids.forEach((id) => {
      const el = document.getElementById(`cat-${id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function CategoryTabs({ categories, active }) {
  const { loc } = useI18n();
  const bar = useRef(null);
  useEffect(() => {
    const el = bar.current?.querySelector(`[data-cat="${active}"]`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);
  const jump = (id) => {
    const el = document.getElementById(`cat-${id}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
  };
  return (
    <nav ref={bar} className="no-scrollbar sticky top-0 z-30 flex gap-2 overflow-x-auto border-b bg-background px-4 py-3" data-testid="menu-category-tabs">
      {categories.map((c) => (
        <button key={c.id} type="button" data-cat={c.id} onClick={() => jump(c.id)} data-testid={`menu-category-tab-${c.id}`}
          className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            active === c.id ? "border-foreground bg-foreground text-background" : "bg-card text-foreground hover:border-foreground/40")}>
          {loc(c)}
        </button>
      ))}
    </nav>
  );
}

export default function MenuPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { tr, loc, applyDefault } = useI18n();
  const { loading, data, error } = useMenu(slug);
  const cart = useCart(slug);
  const [table, setTable] = useState(() => getTable(slug));
  const [tableError, setTableError] = useState(false);
  const [sheetItem, setSheetItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const token = params.get("t");

  useEffect(() => {
    if (data?.canonical_slug && data.canonical_slug !== slug) {
      navigate(`/menu/${data.canonical_slug}${token ? `?t=${encodeURIComponent(token)}` : ""}`, { replace: true });
    }
  }, [data, slug, token, navigate]);

  useEffect(() => {
    if (data?.settings) applyDefault(data.settings.default_language);
  }, [data, applyDefault]);

  useEffect(() => {
    if (!token) return;
    api.get(`/public/menu/${encodeURIComponent(slug)}/table/${encodeURIComponent(token)}`)
      .then(({ data: t }) => {
        const next = { token, label: t.label };
        saveTable(slug, next);
        setTable(next);
        setTableError(false);
      })
      .catch(() => {
        saveTable(slug, null);
        setTable(null);
        setTableError(true);
      });
  }, [slug, token]);

  const categoryIds = useMemo(() => (data?.categories || []).filter((c) => data.items.some((i) => i.category_id === c.id)).map((c) => c.id), [data]);
  const active = useScrollSpy(categoryIds) || categoryIds[0];
  const qtyByItem = useMemo(() => cart.lines.reduce((m, l) => ({ ...m, [l.item_id]: (m[l.item_id] || 0) + l.quantity }), {}), [cart.lines]);
  const myOrders = useMemo(() => getMyOrders(slug).filter((o) => Date.now() - o.at < 12 * 3600 * 1000), [slug]);

  if (loading) return <MenuSkeleton />;
  if (error === "NOT_FOUND") return <MenuMessage testId="menu-not-found" title={tr("Menu not found", "រកមិនឃើញម៉ឺនុយ")}>{tr("Please check the QR code or ask the staff for help.", "សូមពិនិត្យកូដ QR ឬសួរបុគ្គលិក។")}</MenuMessage>;
  if (error || !data) return <MenuMessage testId="menu-error" title={tr("Couldn't load the menu", "មិនអាចផ្ទុកម៉ឺនុយបាន")}>{tr("Please check your connection and refresh the page.", "សូមពិនិត្យអ៊ីនធឺណិត ហើយផ្ទុកទំព័រឡើងវិញ។")}</MenuMessage>;
  if (data.suspended) return <MenuMessage testId="menu-suspended" title={loc(data.restaurant)}>{tr("This menu is temporarily unavailable.", "ម៉ឺនុយនេះមិនអាចប្រើបានបណ្ដោះអាសន្ន។")}</MenuMessage>;

  const currency = data.settings.currency;
  const canOrder = data.status.can_order;
  const featured = data.items.filter((i) => i.featured && i.available);
  const q = query.trim().toLowerCase();
  const results = q ? data.items.filter((i) => [i.name, i.name_km, i.description, i.description_km].some((v) => (v || "").toLowerCase().includes(q))) : [];

  const quickAdd = (item) => {
    if (item.option_groups?.length) return setSheetItem(item);
    cart.add({ item_id: item.id, name: item.name, name_km: item.name_km, image_url: item.image_url, unit_price: item.price, quantity: 1, selections: [], option_labels: [], note: "" });
    toast.success(`${loc(item)} · ${tr("added", "បានបន្ថែម")}`, { duration: 1500 });
  };
  const addFromSheet = (line) => {
    cart.add(line);
    toast.success(`${loc(line)} · ${tr("added", "បានបន្ថែម")}`, { duration: 1500 });
    setSheetItem(null);
  };
  const rowProps = { currency, canOrder, onOpen: setSheetItem, onQuickAdd: quickAdd };

  return (
    <MenuShell>
      <MenuHeader data={data} table={table} searchOpen={searchOpen} onToggleSearch={() => { setSearchOpen((s) => !s); setQuery(""); }} />
      <div className="space-y-2 px-4 pt-4">
        {!canOrder && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="menu-closed-banner">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {closedMessage(data.status.reason, tr)}
          </div>
        )}
        {tableError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="menu-table-error">
            {tr("This table's QR code is no longer valid. You can still browse — please tell the staff your table.", "កូដ QR តុនេះលែងប្រើបានហើយ។ សូមប្រាប់បុគ្គលិកពីលេខតុរបស់អ្នក។")}
          </div>
        )}
        {myOrders[0] && (
          <Link to={`/menu/${slug}/order/${myOrders[0].code}`} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm" data-testid="menu-my-order-link">
            <span>{tr("Your recent order", "ការកុម្ម៉ង់ថ្មីៗរបស់អ្នក")} · <span className="font-mono font-semibold">{myOrders[0].code.slice(0, 4)}-{myOrders[0].code.slice(4)}</span></span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
        {searchOpen && (
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Search dishes and drinks", "ស្វែងរកម្ហូប និងភេសជ្ជៈ")} className="h-11 rounded-full" data-testid="menu-search-input" />
        )}
      </div>

      {q ? (
        <section className="px-4 pt-2" data-testid="menu-search-results">
          <p className="py-2 text-xs text-muted-foreground">{results.length} {tr("results", "លទ្ធផល")}</p>
          <div className="divide-y">{results.map((item) => <ItemRow key={item.id} item={item} inCart={qtyByItem[item.id]} {...rowProps} />)}</div>
        </section>
      ) : (
        <>
          <div className="mt-3"><CategoryTabs categories={data.categories.filter((c) => categoryIds.includes(c.id))} active={active} /></div>
          {featured.length > 0 && (
            <section className="pt-5" data-testid="menu-featured">
              <h2 className="px-4 font-display text-base font-semibold">{tr("Popular here", "ពេញនិយម")}</h2>
              <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                {featured.map((item) => <FeaturedCard key={item.id} item={item} currency={currency} onOpen={setSheetItem} />)}
              </div>
            </section>
          )}
          {data.categories.filter((c) => categoryIds.includes(c.id)).map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16 px-4 pt-6" data-testid={`menu-section-${c.id}`}>
              <h2 className="font-display text-lg font-bold">{loc(c)}</h2>
              <div className="divide-y">
                {data.items.filter((i) => i.category_id === c.id).map((item) => <ItemRow key={item.id} item={item} inCart={qtyByItem[item.id]} {...rowProps} />)}
              </div>
            </section>
          ))}
          {!categoryIds.length && <p className="px-4 py-10 text-sm text-muted-foreground" data-testid="menu-empty">{tr("The menu is being prepared. Please check back soon.", "ម៉ឺនុយកំពុងរៀបចំ។ សូមត្រឡប់មកវិញឆាប់ៗ។")}</p>}
        </>
      )}

      <footer className="mt-10 px-4 text-center text-xs text-muted-foreground">
        <p>{tr("Pay at the counter or at your table.", "បង់ប្រាក់នៅបញ្ជរ ឬនៅតុរបស់អ្នក។")}</p>
        <p className="mt-1">{tr("Menu by", "ម៉ឺនុយដោយ")} <Link to="/" className="font-semibold underline-offset-2 hover:underline" data-testid="menu-footer-brand-link">Tok Menu</Link></p>
      </footer>

      {cart.count > 0 && canOrder && <CartBar slug={slug} count={cart.count} subtotal={cart.subtotal} currency={currency} />}
      <ItemSheet item={sheetItem} onClose={() => setSheetItem(null)} currency={currency} canOrder={canOrder} onAdd={addFromSheet} />
    </MenuShell>
  );
}
