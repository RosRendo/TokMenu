import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, ClipboardList, ExternalLink, Grid3x3, LayoutDashboard, LogOut, Menu as MenuIcon, QrCode, Receipt, Settings as SettingsIcon, Tags, Users, UtensilsCrossed } from "lucide-react";
import { Brand } from "@/components/Brand";
import { LangSwitch } from "@/components/LangSwitch";
import { PageLoader } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { api, errorCode } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DashContext } from "./context";
import { SupportForm } from "./Billing";

const NAV = [
  { to: "/dashboard", end: true, icon: LayoutDashboard, en: "Overview", km: "ទិដ្ឋភាពទូទៅ", owner: true },
  { to: "/dashboard/orders", icon: ClipboardList, en: "Orders", km: "ការកុម្ម៉ង់" },
  { to: "/dashboard/menu", end: true, icon: UtensilsCrossed, en: "Menu", km: "ម៉ឺនុយ", staffPerm: true },
  { to: "/dashboard/menu/categories", icon: Tags, en: "Categories", km: "ប្រភេទ", owner: true },
  { to: "/dashboard/tables", icon: Grid3x3, en: "Tables", km: "តុ", owner: true },
  { to: "/dashboard/qr-codes", icon: QrCode, en: "QR codes", km: "កូដ QR", owner: true },
  { to: "/dashboard/analytics", icon: BarChart3, en: "Analytics", km: "ការវិភាគ", owner: true },
  { to: "/dashboard/staff", icon: Users, en: "Staff", km: "បុគ្គលិក", owner: true },
  { to: "/dashboard/settings", icon: SettingsIcon, en: "Settings", km: "ការកំណត់", owner: true },
  { to: "/dashboard/billing", icon: Receipt, en: "Billing", km: "គម្រោង", owner: true },
];

function NavList({ items, onNavigate }) {
  const { tr } = useI18n();
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} data-testid={`dash-nav-${n.en.toLowerCase().replace(/\s/g, "-")}`}
          className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
          <n.icon className="h-4 w-4" />{tr(n.en, n.km)}
        </NavLink>
      ))}
    </nav>
  );
}

function SuspendedScreen({ isOwner, onLogout }) {
  const { tr } = useI18n();
  return (
    <div className="mx-auto max-w-lg px-6 py-16" data-testid="dashboard-suspended">
      <Brand />
      <h1 className="mt-8 text-2xl font-bold">{tr("This restaurant is suspended", "ភោជនីយដ្ឋាននេះត្រូវបានផ្អាក")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tr("Your public menu shows “temporarily unavailable”. Contact Tok Menu support to reactivate.", "ម៉ឺនុយសាធារណៈបង្ហាញថា “មិនអាចប្រើបានបណ្ដោះអាសន្ន”។ សូមទាក់ទងជំនួយ។")}</p>
      {isOwner && <div className="mt-6"><SupportForm /></div>}
      <Button variant="outline" className="mt-6" onClick={onLogout} data-testid="suspended-logout-button">{tr("Sign out", "ចាកចេញ")}</Button>
    </div>
  );
}

export default function DashboardLayout() {
  const { tr, loc } = useI18n();
  const { session, logout } = useAuth();
  const location = useLocation();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard/restaurant");
      setInfo(data);
      setError(null);
    } catch (e) {
      setError(errorCode(e) || "ERROR");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isOwner = session?.membership?.role === "owner";
  if (error === "RESTAURANT_SUSPENDED") return <SuspendedScreen isOwner={isOwner} onLogout={logout} />;
  if (error) return <div className="p-10 text-sm" data-testid="dashboard-load-error">{tr("Couldn't load your restaurant. Please refresh.", "មិនអាចផ្ទុកបាន។ សូមផ្ទុកឡើងវិញ។")}</div>;
  if (!info) return <PageLoader />;

  const items = NAV.filter((n) => isOwner || (!n.owner && (!n.staffPerm || info.can_manage_availability)));
  const r = info.restaurant;

  return (
    <DashContext.Provider value={{ ...info, currency: r.settings.currency, isOwner, reload: load }}>
      <div className="min-h-screen bg-[#F7F7F4] lg:flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
          <div className="border-b px-5 py-4"><Brand to={isOwner ? "/dashboard" : "/dashboard/orders"} testId="dash-brand" /></div>
          <NavList items={items} />
          <div className="mt-auto border-t p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{info.plan.name}</p>
            <p>{info.subscription?.status}</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 sm:px-6">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu" data-testid="dash-mobile-nav-button">
              <MenuIcon className="h-4 w-4" />
            </button>
            <p className="truncate font-display font-semibold" data-testid="dash-restaurant-name">{loc(r)}</p>
            {r.is_demo && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase text-accent-foreground">Demo</span>}
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex" data-testid="dash-view-menu-button">
                <a href={`/menu/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink />{tr("View menu", "មើលម៉ឺនុយ")}</a>
              </Button>
              <LangSwitch testId="dash-lang-switch" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-sm font-semibold text-background" data-testid="dash-user-menu">
                    {(session?.user?.name || session?.user?.email || "?").slice(0, 1).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-semibold">{session?.user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{isOwner ? tr("Owner", "ម្ចាស់") : tr("Staff", "បុគ្គលិក")}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><a href={`/menu/${r.slug}`} target="_blank" rel="noreferrer" data-testid="dash-open-public-menu">{tr("Open public menu", "បើកម៉ឺនុយសាធារណៈ")}</a></DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} data-testid="dash-logout-button"><LogOut className="mr-2 h-4 w-4" />{tr("Sign out", "ចាកចេញ")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="border-b px-5 py-4"><Link to="/dashboard" className="font-display" data-testid="dash-mobile-brand">Tok Menu</Link></SheetTitle>
          <NavList items={items} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </DashContext.Provider>
  );
}
