import { useCallback, useEffect, useMemo, useState } from "react";

const cartKey = (slug) => `tok_cart_${slug}`;
const ordersKey = (slug) => `tok_orders_${slug}`;
const tableKey = (slug) => `tok_table_${slug}`;

function readJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function lineKey(itemId, selections, note) {
  const sel = (selections || [])
    .map((s) => `${s.group_id}:${[...s.option_ids].sort().join(",")}`)
    .sort()
    .join(";");
  return `${itemId}|${sel}|${(note || "").trim()}`;
}

export function useCart(slug) {
  const [lines, setLines] = useState(() => readJSON(localStorage, cartKey(slug), []));

  useEffect(() => {
    localStorage.setItem(cartKey(slug), JSON.stringify(lines));
  }, [slug, lines]);

  const add = useCallback((line) => {
    const key = lineKey(line.item_id, line.selections, line.note);
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l));
      return [...prev, { ...line, key }];
    });
  }, []);

  const setQty = useCallback((key, qty) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, qty) } : l))));
  }, []);

  const remove = useCallback((key) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const totals = useMemo(() => ({
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((n, l) => n + l.unit_price * l.quantity, 0),
  }), [lines]);

  return { lines, setLines, add, setQty, remove, clear, ...totals };
}

export function getTable(slug) {
  return readJSON(sessionStorage, tableKey(slug), null);
}

export function saveTable(slug, table) {
  if (table) sessionStorage.setItem(tableKey(slug), JSON.stringify(table));
  else sessionStorage.removeItem(tableKey(slug));
}

export function getMyOrders(slug) {
  return readJSON(localStorage, ordersKey(slug), []);
}

export function rememberOrder(slug, code) {
  const list = getMyOrders(slug).filter((o) => o.code !== code);
  localStorage.setItem(ordersKey(slug), JSON.stringify([{ code, at: Date.now() }, ...list].slice(0, 10)));
}

export function priceLine(item, selections) {
  let unit = item.price;
  const labels = [];
  for (const g of item.option_groups || []) {
    const chosen = selections.find((s) => s.group_id === g.id)?.option_ids || [];
    for (const o of g.options) {
      if (chosen.includes(o.id)) {
        unit += o.price_delta;
        labels.push({ group_name: g.name, group_name_km: g.name_km, name: o.name, name_km: o.name_km, price_delta: o.price_delta });
      }
    }
  }
  return { unit, labels };
}

export function validateLine(line, itemsById) {
  const item = itemsById[line.item_id];
  if (!item) return { ok: false, reason: "missing" };
  if (!item.available) return { ok: false, reason: "unavailable" };
  for (const g of item.option_groups || []) {
    const chosen = line.selections.find((s) => s.group_id === g.id)?.option_ids || [];
    if (chosen.length < g.min_select || chosen.length > g.max_select) return { ok: false, reason: "options" };
    for (const id of chosen) {
      const opt = g.options.find((o) => o.id === id);
      if (!opt || !opt.available) return { ok: false, reason: "options" };
    }
  }
  const known = new Set((item.option_groups || []).map((g) => g.id));
  if (line.selections.some((s) => !known.has(s.group_id))) return { ok: false, reason: "options" };
  return { ok: true, unit: priceLine(item, line.selections).unit };
}
