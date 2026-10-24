import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/Brand";
import { LangSwitch } from "@/components/LangSwitch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", end: true, en: "Overview", km: "ទិដ្ឋភាពទូទៅ", id: "overview" },
  { to: "/admin/restaurants", en: "Restaurants", km: "ភោជនីយដ្ឋាន", id: "restaurants" },
  { to: "/admin/subscriptions", en: "Subscriptions", km: "គម្រោង", id: "subscriptions" },
  { to: "/admin/support", en: "Support", km: "ជំនួយ", id: "support" },
];

export default function AdminLayout() {
  const { tr } = useI18n();
  const { session, logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#F7F7F4]" data-testid="admin-layout">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Brand to="/admin" testId="admin-brand" />
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-bold uppercase text-background">Admin</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:block" data-testid="admin-user-email">{session?.user?.email}</span>
            <LangSwitch testId="admin-lang-switch" />
            <Button variant="outline" size="sm" onClick={logout} data-testid="admin-logout-button"><LogOut />{tr("Sign out", "ចាកចេញ")}</Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={`admin-nav-${n.id}`}
              className={({ isActive }) => cn("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {tr(n.en, n.km)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
