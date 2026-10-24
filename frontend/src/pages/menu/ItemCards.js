import { Plus, UtensilsCrossed } from "lucide-react";
import { imgUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

function Thumb({ item, className }) {
  const { loc } = useI18n();
  if (!item.image_url) {
    return (
      <div className={cn("grid place-items-center rounded-xl bg-secondary text-muted-foreground", className)}>
        <UtensilsCrossed className="h-5 w-5" />
      </div>
    );
  }
  return (
    <img loading="lazy" decoding="async" src={imgUrl(item.image_url)} alt={loc(item)}
      className={cn("rounded-xl object-cover", !item.available && "grayscale", className)} />
  );
}

export function ItemRow({ item, currency, canOrder, inCart, onOpen, onQuickAdd }) {
  const { tr, loc } = useI18n();
  const soldOut = !item.available;
  return (
    <div className={cn("flex gap-3 py-4", soldOut && "opacity-60")} data-testid={`menu-item-${item.id}`}>
      <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left" data-testid={`menu-item-open-${item.id}`}>
        <h3 className="font-display text-[15px] font-semibold leading-snug">{loc(item)}</h3>
        {loc(item, "description") && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{loc(item, "description")}</p>}
        <p className="mt-2 text-sm font-semibold tabular">
          {formatMoney(item.price, currency)}
          {item.option_groups?.length > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{tr("· options", "· មានជម្រើស")}</span>}
        </p>
        {soldOut && (
          <span className="mt-2 inline-block rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700" data-testid={`menu-item-soldout-${item.id}`}>
            {tr("Sold out", "អស់ហើយ")}
          </span>
        )}
      </button>
      <div className="relative h-24 w-24 shrink-0">
        <Thumb item={item} className="h-full w-full" />
        {canOrder && !soldOut && (
          <button
            type="button"
            onClick={() => onQuickAdd(item)}
            aria-label={`${tr("Add", "បន្ថែម")} ${loc(item)}`}
            data-testid={`menu-item-add-${item.id}`}
            className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-white shadow-md transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        {inCart > 0 && (
          <span className="absolute -left-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-bold text-background">
            {inCart}
          </span>
        )}
      </div>
    </div>
  );
}

export function FeaturedCard({ item, currency, onOpen }) {
  const { loc } = useI18n();
  return (
    <button type="button" onClick={() => onOpen(item)} className="w-40 shrink-0 text-left" data-testid={`menu-featured-${item.id}`}>
      <Thumb item={item} className="aspect-square w-full" />
      <p className="mt-2 line-clamp-2 font-display text-sm font-semibold leading-snug">{loc(item)}</p>
      <p className="text-sm text-muted-foreground tabular">{formatMoney(item.price, currency)}</p>
    </button>
  );
}
