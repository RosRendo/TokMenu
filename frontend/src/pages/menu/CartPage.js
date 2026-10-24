import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Trash2, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorCode, uuid } from "@/lib/api";
import { getTable, rememberOrder, useCart, validateLine } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { QtyStepper } from "./ItemSheet";
import { MenuMessage, MenuShell } from "./MenuPage";
import { closedMessage, useMenu } from "./useMenu";

const idemKey = (slug) => `tok_idem_${slug}`;
const percentOf = (amount, bps) => Math.floor((amount * bps + 5000) / 10000);

function useIdempotencyKey(slug, signature) {
  return useMemo(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(idemKey(slug)) || "null");
      if (saved && saved.signature === signature) return saved.key;
    } catch (e) {
      /* fall through */
    }
    const key = uuid();
    sessionStorage.setItem(idemKey(slug), JSON.stringify({ key, signature }));
    return key;
  }, [slug, signature]);
}

function errorText(code, err, tr, reason) {
  const item = err?.response?.data?.detail?.message;
  switch (code) {
    case "ITEM_UNAVAILABLE":
    case "ITEM_NOT_FOUND":
      return tr(`${item || "An item"} Please remove it to continue.`, "មុខម្ហូបមួយលែងមានហើយ។ សូមដកវាចេញ។");
    case "OPTION_REQUIRED":
    case "INVALID_OPTIONS":
    case "OPTION_UNAVAILABLE":
      return tr(`${item || "Options changed."} Remove the item and add it again.`, "ជម្រើសបានផ្លាស់ប្ដូរ។ សូមដកមុខម្ហូបចេញ ហើយបន្ថែមម្ដងទៀត។");
    case "ORDERING_UNAVAILABLE":
      return closedMessage(reason, tr);
    case "TABLE_NOT_FOUND":
      return tr("This table's QR code is no longer valid. Please ask our staff.", "កូដ QR តុនេះលែងប្រើបាន។ សូមសួរបុគ្គលិក។");
    case "RATE_LIMITED":
      return tr("Too many orders in a short time. Please wait a minute and try again.", "កុម្ម៉ង់ច្រើនពេកក្នុងពេលខ្លី។ សូមរង់ចាំមួយនាទី។");
    case "NETWORK":
      return tr("Connection problem. Tap “Place order” again — it won't be sent twice.", "មានបញ្ហាអ៊ីនធឺណិត។ សូមចុច “ដាក់ការកុម្ម៉ង់” ម្ដងទៀត — វានឹងមិនផ្ញើពីរដងទេ។");
    default:
      return tr("Something went wrong. Please try again or ask our staff.", "មានបញ្ហា។ សូមព្យាយាមម្ដងទៀត ឬសួរបុគ្គលិក។");
  }
}

function CartLine({ line, item, currency, onQty, onRemove }) {
  const { tr, loc } = useI18n();
  const check = validateLine(line, item);
  return (
    <li className="py-4" data-testid={`cart-line-${line.item_id}`}>
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold leading-snug">{loc(line)}</p>
          {line.option_labels?.length > 0 && <p className="mt-0.5 text-[13px] text-muted-foreground">{line.option_labels.map((o) => loc(o)).join(" · ")}</p>}
          {line.note && <p className="mt-0.5 text-[13px] italic text-muted-foreground">“{line.note}”</p>}
          {!check.ok && (
            <p className="mt-1 text-[13px] font-medium text-red-700" data-testid={`cart-line-invalid-${line.item_id}`}>
              {check.reason === "options" ? tr("Options changed — please remove and re-add.", "ជម្រើសបានផ្លាស់ប្ដូរ — សូមដក ហើយបន្ថែមម្ដងទៀត។") : tr("No longer available — please remove.", "លែងមានហើយ — សូមដកចេញ។")}
            </p>
          )}
        </div>
        <p className="shrink-0 font-semibold tabular">{formatMoney((check.ok ? check.unit : line.unit_price) * line.quantity, currency)}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <QtyStepper value={line.quantity} onChange={(q) => onQty(line.key, q)} testId={`cart-qty-${line.item_id}`} />
        <button type="button" onClick={() => onRemove(line.key)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive" data-testid={`cart-remove-${line.item_id}`}>
          <Trash2 className="h-4 w-4" /> {tr("Remove", "ដកចេញ")}
        </button>
      </div>
    </li>
  );
}

export default function CartPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { tr } = useI18n();
  const { data, loading, error, reload } = useMenu(slug);
  const cart = useCart(slug);
  const table = getTable(slug);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(null);
  const inFlight = useRef(false);
  const signature = useMemo(() => JSON.stringify([cart.lines.map((l) => [l.key, l.quantity]), label.trim(), note.trim(), table?.token || null]), [cart.lines, label, note, table]);
  const key = useIdempotencyKey(slug, signature);

  useEffect(() => {
    setFailure(null);
  }, [signature]);

  const itemsById = useMemo(() => Object.fromEntries((data?.items || []).map((i) => [i.id, i])), [data]);
  if (loading) return <MenuShell><div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div></MenuShell>;
  if (error || !data || data.suspended) return <MenuMessage testId="cart-error" title={tr("Couldn't load the menu", "មិនអាចផ្ទុកម៉ឺនុយបាន")}>{tr("Please go back and try again.", "សូមត្រឡប់ក្រោយ ហើយព្យាយាមម្ដងទៀត។")}</MenuMessage>;

  const currency = data.settings.currency;
  const checks = cart.lines.map((l) => validateLine(l, itemsById));
  const allValid = checks.every((c) => c.ok);
  const subtotal = cart.lines.reduce((sum, l, i) => sum + (checks[i].ok ? checks[i].unit : l.unit_price) * l.quantity, 0);
  const service = percentOf(subtotal, data.settings.service_charge_bps || 0);
  const tax = percentOf(subtotal + service, data.settings.tax_bps || 0);
  const needsLabel = !table;
  const canSubmit = cart.lines.length > 0 && allValid && data.status.can_order && (!needsLabel || label.trim().length > 0) && !submitting;

  const submit = async () => {
    if (inFlight.current || !canSubmit) return;
    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);
    try {
      const { data: res } = await api.post(`/public/menu/${slug}/orders`, {
        idempotency_key: key,
        table_token: table?.token || null,
        customer_label: label.trim(),
        note: note.trim(),
        items: cart.lines.map((l) => ({ item_id: l.item_id, quantity: l.quantity, selections: l.selections, note: l.note || "" })),
      });
      rememberOrder(slug, res.order.code);
      cart.clear();
      sessionStorage.removeItem(idemKey(slug));
      navigate(`/menu/${slug}/order/${res.order.code}`, { replace: true });
    } catch (err) {
      const code = errorCode(err);
      setFailure(errorText(code, err, tr, err?.response?.data?.detail?.reason));
      if (["ITEM_UNAVAILABLE", "ITEM_NOT_FOUND", "OPTION_UNAVAILABLE", "INVALID_OPTIONS", "ORDERING_UNAVAILABLE"].includes(code)) reload();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <MenuShell>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-4 py-3">
        <Link to={`/menu/${slug}`} className="grid h-9 w-9 place-items-center rounded-full border" aria-label={tr("Back to menu", "ត្រឡប់ទៅម៉ឺនុយ")} data-testid="cart-back-button">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold">{tr("Your order", "ការកុម្ម៉ង់របស់អ្នក")}</h1>
        {table && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background" data-testid="cart-table-label"><MapPin className="h-3 w-3" />{table.label}</span>}
      </header>

      {cart.lines.length === 0 ? (
        <div className="px-4 py-16" data-testid="cart-empty">
          <p className="font-display text-lg font-semibold">{tr("Your cart is empty", "កន្ត្រករបស់អ្នកទទេ")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Add dishes from the menu to start an order.", "បន្ថែមមុខម្ហូបពីម៉ឺនុយ ដើម្បីចាប់ផ្ដើមកុម្ម៉ង់។")}</p>
          <Link to={`/menu/${slug}`} className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-white" data-testid="cart-browse-button">{tr("Browse menu", "មើលម៉ឺនុយ")}</Link>
        </div>
      ) : (
        <div className="px-4">
          <ul className="divide-y">
            {cart.lines.map((l) => <CartLine key={l.key} line={l} item={itemsById} currency={currency} onQty={cart.setQty} onRemove={cart.remove} />)}
          </ul>

          <div className="mt-2 space-y-4 border-t pt-5">
            {needsLabel && (
              <label className="block">
                <span className="text-sm font-semibold">{tr("Your name or table number", "ឈ្មោះ ឬលេខតុរបស់អ្នក")} *</span>
                <Input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} className="mt-2 h-11" placeholder={tr("e.g. Dara, or Table 5", "ឧ. ដារ៉ា ឬ តុ ៥")} data-testid="cart-customer-label-input" />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-semibold">{tr("Note for the kitchen (optional)", "កំណត់ចំណាំសម្រាប់ផ្ទះបាយ (ស្រេចចិត្ត)")}</span>
              <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} className="mt-2" data-testid="cart-order-note" />
            </label>
          </div>

          <dl className="mt-6 space-y-2 rounded-xl bg-secondary p-4 text-sm" data-testid="cart-totals">
            <div className="flex justify-between"><dt>{tr("Subtotal", "សរុបរង")}</dt><dd className="tabular" data-testid="cart-subtotal">{formatMoney(subtotal, currency)}</dd></div>
            {service > 0 && <div className="flex justify-between"><dt>{tr("Service charge", "ថ្លៃសេវា")} ({data.settings.service_charge_bps / 100}%)</dt><dd className="tabular">{formatMoney(service, currency)}</dd></div>}
            {tax > 0 && <div className="flex justify-between"><dt>{tr("VAT", "អាករ")} ({data.settings.tax_bps / 100}%)</dt><dd className="tabular">{formatMoney(tax, currency)}</dd></div>}
            <div className="flex justify-between border-t border-stone-300 pt-2 text-base font-bold"><dt>{tr("Total", "សរុប")}</dt><dd className="tabular" data-testid="cart-total">{formatMoney(subtotal + service + tax, currency)}</dd></div>
          </dl>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" />{tr("Pay at the counter or at your table. No online payment needed.", "បង់ប្រាក់នៅបញ្ជរ ឬនៅតុ។ មិនចាំបាច់បង់តាមអនឡាញទេ។")}</p>

          {!data.status.can_order && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="cart-closed">{closedMessage(data.status.reason, tr)}</p>}
          {failure && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" data-testid="cart-error-message">{failure}</p>}
        </div>
      )}

      {cart.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 pt-3 pb-safe">
          <div className="mx-auto max-w-md">
            <button type="button" onClick={submit} disabled={!canSubmit} data-testid="cart-place-order-button"
              className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-5 font-semibold text-white transition-opacity disabled:opacity-50">
              <span className="flex items-center gap-2">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? tr("Sending…", "កំពុងផ្ញើ…") : tr("Place order", "ដាក់ការកុម្ម៉ង់")}</span>
              <span className="tabular">{formatMoney(subtotal + service + tax, currency)}</span>
            </button>
          </div>
        </div>
      )}
    </MenuShell>
  );
}
