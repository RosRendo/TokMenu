import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Star, Tags, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage, imgUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDash } from "./context";
import { ItemEditor } from "./ItemEditor";

function ItemRow({ item, currency, isOwner, canToggle, archived, first, last, onToggle, onEdit, onAction, onMove }) {
  const { tr } = useI18n();
  return (
    <li className="flex items-center gap-3 px-3 py-3" data-testid={`dash-item-${item.id}`}>
      {isOwner && !archived && (
        <div className="flex flex-col">
          <button type="button" disabled={first} onClick={() => onMove(-1)} className="rounded p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30" aria-label={tr("Move up", "ឡើងលើ")} data-testid={`item-move-up-${item.id}`}><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={last} onClick={() => onMove(1)} className="rounded p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30" aria-label={tr("Move down", "ចុះក្រោម")} data-testid={`item-move-down-${item.id}`}><ArrowDown className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {item.image_url ? <img src={imgUrl(item.image_url)} alt="" className="h-12 w-12 rounded-lg object-cover" loading="lazy" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-secondary text-muted-foreground"><UtensilsCrossed className="h-4 w-4" /></span>}
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => isOwner && onEdit(item)} disabled={!isOwner} data-testid={`item-open-${item.id}`}>
        <p className="truncate font-medium">{item.name}{item.featured && <Star className="ml-1.5 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</p>
        <p className="truncate text-xs text-muted-foreground">{item.name_km || "—"}{item.option_groups?.length ? ` · ${item.option_groups.length} ${tr("option groups", "ក្រុមជម្រើស")}` : ""}</p>
      </button>
      <span className="w-20 text-right text-sm font-semibold tabular">{formatMoney(item.price, currency)}</span>
      {!archived && (
        <label className={cn("flex w-28 items-center justify-end gap-2 text-xs", !item.available && "text-muted-foreground")}>
          <span className="hidden sm:inline">{item.available ? tr("Available", "មាន") : tr("Sold out", "អស់")}</span>
          <Switch checked={item.available} disabled={!canToggle} onCheckedChange={(v) => onToggle(item, v)} data-testid={`item-availability-${item.id}`} />
        </label>
      )}
      {isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="grid h-8 w-8 place-items-center rounded-md hover:bg-secondary" data-testid={`item-actions-${item.id}`} aria-label={tr("Actions", "សកម្មភាព")}><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!archived && <DropdownMenuItem onClick={() => onEdit(item)} data-testid={`item-edit-${item.id}`}>{tr("Edit", "កែ")}</DropdownMenuItem>}
            {!archived && <DropdownMenuItem onClick={() => onAction(item, "duplicate")} data-testid={`item-duplicate-${item.id}`}>{tr("Duplicate", "ចម្លង")}</DropdownMenuItem>}
            {archived
              ? <DropdownMenuItem onClick={() => onAction(item, "restore")} data-testid={`item-restore-${item.id}`}>{tr("Restore", "ស្ដារ")}</DropdownMenuItem>
              : <DropdownMenuItem className="text-destructive" onClick={() => onAction(item, "archive")} data-testid={`item-archive-${item.id}`}>{tr("Archive", "ដកចេញពីម៉ឺនុយ")}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

export default function MenuItems() {
  const { tr, loc } = useI18n();
  const { currency, isOwner, can_manage_availability: canToggle, plan } = useDash();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("active");
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [i, c] = await Promise.all([api.get("/dashboard/items", { params: { archived: view } }), api.get("/dashboard/categories")]);
    setItems(i.data);
    setCategories(c.data);
  }, [view]);
  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);
  useEffect(() => {
    if (params.get("new") && isOwner) setEditing({ item: null });
  }, [params, isOwner]);

  const grouped = useMemo(() => categories.map((c) => ({ ...c, items: (items || []).filter((i) => i.category_id === c.id) })).filter((c) => c.items.length || (view === "active" && !c.archived)), [categories, items, view]);
  const activeCount = categories.reduce((n, c) => n + c.item_count, 0);

  const closeEditor = () => {
    setEditing(null);
    if (params.get("new")) setParams({}, { replace: true });
  };
  const toggle = async (item, available) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available } : i)));
    try {
      await api.patch(`/dashboard/items/${item.id}/availability`, { available });
      toast.success(available ? tr("Back on the menu", "មានវិញហើយ") : tr("Marked sold out", "បានកត់ថាអស់"));
    } catch (e) {
      toast.error(errorMessage(e));
      load();
    }
  };
  const action = async (item, kind) => {
    try {
      await api.post(`/dashboard/items/${item.id}/${kind}`);
      toast.success({ duplicate: tr("Duplicated", "បានចម្លង"), archive: tr("Archived — hidden from the menu", "បានដកចេញពីម៉ឺនុយ"), restore: tr("Restored", "បានស្ដារ") }[kind]);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const move = async (cat, index, dir) => {
    const ids = cat.items.map((i) => i.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    setItems((prev) => [...prev].sort((a, b) => (a.category_id === cat.id && b.category_id === cat.id ? ids.indexOf(a.id) - ids.indexOf(b.id) : 0)));
    try {
      await api.post("/dashboard/item-order", { ids });
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (items === null) return <PageLoader />;
  const activeCategories = categories.filter((c) => !c.archived);

  return (
    <div>
      <PageHeader
        title={tr("Menu", "ម៉ឺនុយ")}
        description={isOwner
          ? `${activeCount}${plan.max_items ? ` / ${plan.max_items}` : ""} ${tr("items on your menu. Switch an item off when it sells out — it stays visible but can't be ordered.", "មុខនៅលើម៉ឺនុយ។ បិទមុខម្ហូបនៅពេលវាអស់។")}`
          : tr("Switch items off when they sell out.", "បិទមុខម្ហូបនៅពេលវាអស់។")}
        actions={isOwner && <>
          <Button asChild variant="outline" data-testid="menu-categories-link"><Link to="/dashboard/menu/categories"><Tags />{tr("Categories", "ប្រភេទ")}</Link></Button>
          <Button onClick={() => setEditing({ item: null })} disabled={!activeCategories.length} data-testid="menu-add-item-button"><Plus />{tr("Add item", "បន្ថែមមុខម្ហូប")}</Button>
        </>}
      />
      {isOwner && (
        <Tabs value={view} onValueChange={setView} className="mb-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="menu-view-active">{tr("On menu", "នៅលើម៉ឺនុយ")}</TabsTrigger>
            <TabsTrigger value="archived" data-testid="menu-view-archived">{tr("Archived", "បានដកចេញ")}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {!activeCategories.length && view === "active" ? (
        <EmptyState icon={Tags} title={tr("Start with categories", "ចាប់ផ្ដើមជាមួយប្រភេទ")} testId="menu-no-categories"
          action={isOwner && <Button asChild data-testid="menu-create-categories-button"><Link to="/dashboard/menu/categories">{tr("Create categories", "បង្កើតប្រភេទ")}</Link></Button>}>
          {tr("Group your dishes, e.g. Food, Drinks, Desserts. Then add items to each.", "ដាក់មុខម្ហូបជាក្រុម ឧ. ម្ហូប ភេសជ្ជៈ បង្អែម។")}
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title={view === "archived" ? tr("Nothing archived", "គ្មានអ្វីត្រូវបានដកចេញ") : tr("Add your first dish", "បន្ថែមមុខម្ហូបដំបូង")} testId="menu-no-items"
          action={isOwner && view === "active" && <Button onClick={() => setEditing({ item: null })} data-testid="menu-empty-add-button"><Plus />{tr("Add item", "បន្ថែមមុខម្ហូប")}</Button>}>
          {view === "archived" ? tr("Archived items are hidden from customers and can be restored any time.", "មុខម្ហូបដែលបានដកចេញអាចស្ដារវិញបាន។") : tr("A photo, a price and a short description is all you need.", "រូបភាព តម្លៃ និងការពិពណ៌នាខ្លី។")}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {grouped.map((cat) => (
            <section key={cat.id} className="rounded-xl border bg-card" data-testid={`dash-category-${cat.id}`}>
              <h2 className="flex items-center justify-between border-b px-4 py-2.5 font-display text-sm font-semibold">
                <span>{loc(cat)} {cat.archived && <span className="ml-1 text-xs font-normal text-muted-foreground">({tr("category archived", "ប្រភេទត្រូវបានដកចេញ")})</span>}</span>
                <span className="text-xs font-normal text-muted-foreground">{cat.items.length}</span>
              </h2>
              {cat.items.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">{tr("No items yet.", "មិនទាន់មានមុខម្ហូប។")}</p> : (
                <ul className="divide-y">
                  {cat.items.map((item, index) => (
                    <ItemRow key={item.id} item={item} currency={currency} isOwner={isOwner} canToggle={canToggle} archived={view === "archived"}
                      first={index === 0} last={index === cat.items.length - 1} onToggle={toggle} onEdit={(it) => setEditing({ item: it })}
                      onAction={action} onMove={(dir) => move(cat, index, dir)} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      {isOwner && (
        <ItemEditor open={!!editing} item={editing?.item} categories={activeCategories} currency={currency}
          defaultCategory={activeCategories[0]?.id} onClose={closeEditor} onSaved={() => { closeEditor(); load(); }} />
      )}
    </div>
  );
}
