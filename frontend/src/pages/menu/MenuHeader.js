import { Search, X, MapPin } from "lucide-react";
import { LangSwitch } from "@/components/LangSwitch";
import { imgUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { todayHours } from "./useMenu";

export function MenuHeader({ data, table, searchOpen, onToggleSearch }) {
  const { tr, loc } = useI18n();
  const r = data.restaurant;
  const open = data.status.is_open;
  return (
    <header data-testid="menu-header">
      <div className="relative h-40 w-full overflow-hidden bg-secondary">
        {r.cover_url && <img src={imgUrl(r.cover_url)} alt="" className="h-full w-full object-cover" fetchpriority="high" />}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          {r.is_demo ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary shadow-sm" data-testid="menu-demo-badge">
              {tr("Demo menu", "ម៉ឺនុយសាកល្បង")}
            </span>
          ) : <span />}
          <div className="flex items-center gap-2">
            <LangSwitch className="shadow-sm" testId="menu-lang-switch" />
            <button
              type="button"
              onClick={onToggleSearch}
              aria-label={tr("Search menu", "ស្វែងរកម៉ឺនុយ")}
              data-testid="menu-search-toggle"
              className="grid h-9 w-9 place-items-center rounded-full border bg-card shadow-sm"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="relative -mt-9 px-4">
        <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-2xl border-4 border-background bg-card shadow-sm">
          {r.logo_url ? (
            <img src={imgUrl(r.logo_url)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-bold text-primary" style={r.accent_color ? { color: r.accent_color } : undefined}>
              {(loc(r) || "?").slice(0, 1)}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight" data-testid="menu-restaurant-name">{loc(r)}</h1>
        {loc(r, "description") && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{loc(r, "description")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            data-testid="menu-open-status"
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
              open ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-100 text-stone-600")}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", open ? "bg-emerald-500" : "bg-stone-400")} />
            {open ? tr("Open now", "កំពុងបើក") : tr("Closed", "បិទ")}
          </span>
          <span className="text-muted-foreground">{todayHours(data.settings, tr)}</span>
          {table && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-semibold text-background" data-testid="menu-table-chip">
              <MapPin className="h-3 w-3" /> {table.label}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
