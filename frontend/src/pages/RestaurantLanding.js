import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Clock,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Send,
  ShoppingBag,
  Sparkles,
  Utensils,
  Wallet,
} from "lucide-react";
import { LangSwitch } from "@/components/LangSwitch";
import { PageLoader } from "@/components/Loading";
import { imgUrl } from "@/lib/api";
import { getTable, saveTable, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { closedMessage, todayHours, useMenu } from "./menu/useMenu";

export default function RestaurantLanding() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { tr, loc, lang } = useI18n();
  const { data, loading, error } = useMenu(slug);
  const cart = useCart(slug);

  // Preserve table token from URL query ?t= or ?table=
  const token = params.get("t") || params.get("table");
  useEffect(() => {
    if (!token || !data?.restaurant) return;
    saveTable(slug, { token, label: params.get("label") || `Table (${token.slice(0, 4)})` });
  }, [slug, token, data]);

  const table = getTable(slug);

  if (loading) return <PageLoader />;
  if (error || !data || data.suspended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-stone-50">
        <div className="max-w-md rounded-3xl border bg-white p-8 shadow-xl">
          <Utensils className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-bold">{tr("Restaurant Not Found", "រកមិនឃើញភោជនីយដ្ឋាន")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tr("Please check the QR link or ask restaurant staff.", "សូមពិនិត្យតំណ QR ឬសួរបុគ្គលិក។")}</p>
        </div>
      </div>
    );
  }

  const r = data.restaurant;
  const s = data.settings || {};
  const status = data.status || {};
  const open = status.is_open;
  const social = r.social || {};
  const currency = s.currency || "USD";
  const pConf = s.payment || {};

  // Featured / popular dishes preview
  const featuredItems = (data.items || []).filter((i) => i.featured || i.image_url).slice(0, 4);

  const menuUrl = token ? `/menu/${slug}?t=${encodeURIComponent(token)}` : `/menu/${slug}`;
  const cartUrl = `/menu/${slug}/cart`;

  const formatSocialUrl = (type, handle) => {
    if (!handle) return null;
    const cleanHandle = handle.trim().replace(/^@/, "");
    if (handle.startsWith("http://") || handle.startsWith("https://")) return handle;
    switch (type) {
      case "facebook":
        return `https://facebook.com/${cleanHandle}`;
      case "instagram":
        return `https://instagram.com/${cleanHandle}`;
      case "telegram":
        return `https://t.me/${cleanHandle}`;
      case "tiktok":
        return `https://tiktok.com/@${cleanHandle}`;
      case "website":
        return `https://${cleanHandle}`;
      default:
        return handle;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-charcoal antialiased">
      <div className="mx-auto min-h-screen max-w-md bg-white pb-20 shadow-md">
        {/* Cover Photo */}
        <div className="relative h-56 w-full overflow-hidden bg-secondary">
          {r.cover_url ? (
            <img src={imgUrl(r.cover_url)} alt="" className="h-full w-full object-cover" fetchpriority="high" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />

          {/* Top Bar with Lang Switch */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            {r.is_demo ? (
              <span className="rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary shadow">
                {tr("Demo", "គំរូ")}
              </span>
            ) : <span />}
            <LangSwitch className="bg-white/90 backdrop-blur shadow" testId="landing-lang-switch" />
          </div>

          {/* Table Badge Overlay */}
          {table && (
            <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-charcoal shadow backdrop-blur">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>{table.label}</span>
            </div>
          )}
        </div>

        {/* Restaurant Identity */}
        <div className="relative px-5 pt-3">
          <div className="flex items-end justify-between">
            <div className="-mt-14 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg">
              {r.logo_url ? (
                <img src={imgUrl(r.logo_url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-3xl font-bold text-primary">
                  {(loc(r) || "?").slice(0, 1)}
                </span>
              )}
            </div>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm border",
                open ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-100 text-stone-600"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", open ? "bg-emerald-500 animate-pulse" : "bg-stone-400")} />
              {open ? tr("Open now", "កំពុងបើក") : tr("Closed", "បិទ")}
            </span>
          </div>

          <h1 className="mt-3 font-display text-2xl font-bold leading-tight" data-testid="landing-name">
            {loc(r)}
          </h1>
          {r.name_km && lang === "en" && (
            <p className="font-display text-sm text-muted-foreground">{r.name_km}</p>
          )}

          {loc(r, "description") && (
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              {loc(r, "description")}
            </p>
          )}

          {/* Hours & Address quick facts */}
          <div className="mt-4 flex flex-col gap-1.5 rounded-2xl bg-stone-50 p-3 text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{todayHours(s, tr)}</span>
            </div>
            {r.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{r.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Action Hub */}
        <div className="mt-6 px-5 space-y-3">
          {/* View Menu Primary Button */}
          <Link
            to={menuUrl}
            data-testid="landing-view-menu-btn"
            className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-primary px-6 py-4 font-display font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base leading-tight">{tr("View Menu & Order", "មើលម៉ឺនុយ និងកុម្ម៉ង់")}</p>
                <p className="text-xs text-white/80">{tr("Browse dishes with photos and prices", "មើលមុខម្ហូប រូបភាព និងតម្លៃ")}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>

          {/* Floating Cart Access if customer has pending items */}
          {cart.lines.length > 0 && (
            <Link
              to={cartUrl}
              data-testid="landing-cart-btn"
              className="flex items-center justify-between rounded-2xl border-2 border-primary bg-primary/5 px-5 py-3.5 font-display text-sm font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-5 w-5" />
                <span>{tr("Continue Order in Cart", "បន្តការកុម្ម៉ង់ក្នុងកន្ត្រក")}</span>
              </div>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs text-white">
                {cart.lines.length}
              </span>
            </Link>
          )}

          {/* Call Restaurant */}
          {r.phone && (
            <a
              href={`tel:${r.phone}`}
              data-testid="landing-call-btn"
              className="flex items-center justify-between rounded-2xl border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Phone className="h-4 w-4" />
                </span>
                <span>{tr("Call Restaurant", "ទូរស័ព្ទទៅភោជនីយដ្ឋាន")}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{r.phone}</span>
            </a>
          )}

          {/* Social Links Hub (Island Bites inspired) */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {social.facebook && (
              <a
                href={formatSocialUrl("facebook", social.facebook)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl border bg-white p-3 text-xs font-semibold text-[#1877F2] shadow-sm transition-transform active:scale-[0.98]"
              >
                <Facebook className="h-4 w-4 fill-current shrink-0" />
                <span className="truncate">Facebook</span>
              </a>
            )}

            {social.instagram && (
              <a
                href={formatSocialUrl("instagram", social.instagram)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl border bg-white p-3 text-xs font-semibold text-[#E4405F] shadow-sm transition-transform active:scale-[0.98]"
              >
                <Instagram className="h-4 w-4 shrink-0" />
                <span className="truncate">Instagram</span>
              </a>
            )}

            {social.telegram && (
              <a
                href={formatSocialUrl("telegram", social.telegram)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl border bg-white p-3 text-xs font-semibold text-[#24A1DE] shadow-sm transition-transform active:scale-[0.98]"
              >
                <Send className="h-4 w-4 shrink-0" />
                <span className="truncate">Telegram</span>
              </a>
            )}

            {social.website && (
              <a
                href={formatSocialUrl("website", social.website)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl border bg-white p-3 text-xs font-semibold text-purple-600 shadow-sm transition-transform active:scale-[0.98]"
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span className="truncate">Website</span>
              </a>
            )}
          </div>
        </div>

        {/* Featured Dishes Preview */}
        {featuredItems.length > 0 && (
          <div className="mt-8 px-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-bold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {tr("Popular Picks", "មុខម្ហូបពេញនិយម")}
              </h2>
              <Link to={menuUrl} className="text-xs font-semibold text-primary flex items-center gap-0.5">
                {tr("See all", "មើលទាំងអស់")} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {featuredItems.map((item) => (
                <Link
                  key={item.id}
                  to={menuUrl}
                  className="group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                    {item.image_url ? (
                      <img
                        src={imgUrl(item.image_url)}
                        alt={loc(item)}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <Utensils className="h-6 w-6 opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-semibold leading-tight">{loc(item)}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-primary">
                      {formatMoney(item.price, currency)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Accepted Payment Badges */}
        <div className="mt-8 mx-5 rounded-2xl border bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tr("Accepted Payments", "ការទូទាត់ដែលទទួលយក")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-sm">
              💵 {tr("Cash at counter/table", "សាច់ប្រាក់")}
            </span>
            {pConf.aba_enabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-sm">
                💳 ABA PayWay
              </span>
            )}
            {pConf.khqr_enabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 shadow-sm">
                🏦 Bakong KHQR
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 px-5 text-center text-xs text-muted-foreground space-y-2">
          <p>© {new Date().getFullYear()} {r.name}. {tr("Powered by Tok Menu", "ដំណើរការដោយ Tok Menu")}</p>
          <p className="text-[11px] text-stone-400">
            {tr("Fast contactless ordering for Cambodia", "ការកុម្ម៉ង់រហ័សតាមកូដ QR សម្រាប់កម្ពុជា")}
          </p>
        </footer>
      </div>
    </div>
  );
}

