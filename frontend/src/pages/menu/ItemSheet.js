import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { imgUrl } from "@/lib/api";
import { priceLine } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

function initialSelection(item) {
  const sel = {};
  for (const g of item?.option_groups || []) {
    if (g.min_select >= 1 && g.max_select === 1) {
      const first = g.options.find((o) => o.available);
      if (first) sel[g.id] = [first.id];
    }
  }
  return sel;
}

export function QtyStepper({ value, onChange, min = 1, testId }) {
  const { tr } = useI18n();
  return (
    <div className="inline-flex items-center rounded-full border bg-card" data-testid={testId}>
      <button type="button" className="grid h-10 w-10 place-items-center disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={tr("Decrease", "បន្ថយ")} data-testid={`${testId}-minus`}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center font-semibold tabular" data-testid={`${testId}-value`}>{value}</span>
      <button type="button" className="grid h-10 w-10 place-items-center disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={value >= 50} aria-label={tr("Increase", "បង្កើន")} data-testid={`${testId}-plus`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function GroupPicker({ group, chosen, onToggle, currency }) {
  const { tr, loc } = useI18n();
  const required = group.min_select >= 1;
  const hint = group.max_select === 1
    ? (required ? tr("Choose 1", "ជ្រើសរើស ១") : tr("Optional", "ស្រេចចិត្ត"))
    : tr(`Choose up to ${group.max_select}`, `ជ្រើសបានដល់ ${group.max_select}`);
  return (
    <fieldset className="mt-5" data-testid={`option-group-${group.id}`}>
      <legend className="flex w-full items-center justify-between">
        <span className="font-display text-sm font-semibold">{loc(group)}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", required ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground")}>
          {required ? `${tr("Required", "ត្រូវតែជ្រើស")} · ${hint}` : hint}
        </span>
      </legend>
      <div className="mt-2 divide-y rounded-xl border bg-card">
        {group.options.map((o) => {
          const on = chosen.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={!o.available}
              onClick={() => onToggle(group, o)}
              data-testid={`option-${o.id}`}
              aria-pressed={on}
              className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm disabled:opacity-50"
            >
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center border", group.max_select === 1 ? "rounded-full" : "rounded-md", on ? "border-primary bg-primary text-white" : "border-input")}>
                {on && <Check className="h-3 w-3" />}
              </span>
              <span className="flex-1">{loc(o)}{!o.available && ` · ${tr("unavailable", "មិនមាន")}`}</span>
              {o.price_delta > 0 && <span className="text-muted-foreground tabular">+{formatMoney(o.price_delta, currency)}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ItemSheet({ item, onClose, currency, canOrder, onAdd }) {
  const { tr, loc } = useI18n();
  const [sel, setSel] = useState({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    setSel(initialSelection(item));
    setQty(1);
    setNote("");
  }, [item]);

  const selections = useMemo(() => Object.entries(sel).filter(([, ids]) => ids.length).map(([group_id, option_ids]) => ({ group_id, option_ids })), [sel]);
  const priced = item ? priceLine(item, selections) : { unit: 0, labels: [] };
  const missing = (item?.option_groups || []).filter((g) => (sel[g.id]?.length || 0) < g.min_select);

  const toggle = (g, o) => setSel((prev) => {
    const cur = prev[g.id] || [];
    if (g.max_select === 1) return { ...prev, [g.id]: cur.includes(o.id) && g.min_select === 0 ? [] : [o.id] };
    if (cur.includes(o.id)) return { ...prev, [g.id]: cur.filter((id) => id !== o.id) };
    if (cur.length >= g.max_select) return prev;
    return { ...prev, [g.id]: [...cur, o.id] };
  });

  const add = () => {
    onAdd({
      item_id: item.id, name: item.name, name_km: item.name_km, image_url: item.image_url,
      unit_price: priced.unit, quantity: qty, selections, option_labels: priced.labels, note: note.trim(),
    });
  };

  return (
    <Drawer open={!!item} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-md" data-testid="item-sheet">
        {item && (
          <>
            <div className="overflow-y-auto">
              {item.image_url && <img src={imgUrl(item.image_url)} alt="" className="mt-3 aspect-[16/10] w-full object-cover" />}
              <div className="px-5 pb-4 pt-4">
                <DrawerTitle className="font-display text-xl font-bold leading-snug" data-testid="item-sheet-title">{loc(item)}</DrawerTitle>
                <DrawerDescription className="mt-1 text-sm leading-relaxed">{loc(item, "description") || " "}</DrawerDescription>
                <p className="mt-2 font-semibold tabular">{formatMoney(item.price, currency)}</p>
                {(item.option_groups || []).map((g) => (
                  <GroupPicker key={g.id} group={g} chosen={sel[g.id] || []} onToggle={toggle} currency={currency} />
                ))}
                <label className="mt-5 block">
                  <span className="font-display text-sm font-semibold">{tr("Special instructions", "សំណូមពរពិសេស")}</span>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} rows={2} className="mt-2"
                    placeholder={tr("e.g. no chili, less ice", "ឧ. មិនដាក់ម្ទេស ទឹកកកតិច")} data-testid="item-sheet-note" />
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t bg-background px-5 py-4 pb-safe">
              {canOrder && item.available ? (
                <>
                  <QtyStepper value={qty} onChange={setQty} testId="item-sheet-qty" />
                  <button
                    type="button"
                    onClick={add}
                    disabled={missing.length > 0}
                    data-testid="item-sheet-add-button"
                    className="flex h-12 flex-1 items-center justify-between rounded-full bg-primary px-5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  >
                    <span>{missing.length ? `${tr("Choose", "ជ្រើស")} ${loc(missing[0])}` : tr("Add to cart", "ដាក់ចូលកន្ត្រក")}</span>
                    <span className="tabular">{formatMoney(priced.unit * qty, currency)}</span>
                  </button>
                </>
              ) : (
                <p className="w-full rounded-xl bg-secondary p-3 text-center text-sm text-muted-foreground" data-testid="item-sheet-unavailable">
                  {item.available ? tr("Ordering is not available right now.", "ពេលនេះមិនអាចកុម្ម៉ង់បានទេ។") : tr("This item is sold out.", "មុខម្ហូបនេះអស់ហើយ។")}
                </p>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
