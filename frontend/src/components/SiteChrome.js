import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { LangSwitch } from "@/components/LangSwitch";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function SiteHeader() {
  const { tr } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="ml-6 hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="/#how" className="hover:text-foreground" data-testid="nav-how-link">{tr("How it works", "របៀបដំណើរការ")}</a>
          <Link to="/pricing" className="hover:text-foreground" data-testid="nav-pricing-link">{tr("Pricing", "តម្លៃ")}</Link>
          <a href="/#faq" className="hover:text-foreground" data-testid="nav-faq-link">{tr("FAQ", "សំណួរ")}</a>
          <Link to="/menu/demo" className="hover:text-foreground" data-testid="nav-demo-link">{tr("Demo menu", "ម៉ឺនុយសាកល្បង")}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch className="hidden sm:inline-flex" testId="site-lang-switch" />
          <Button asChild variant="ghost" size="sm" data-testid="nav-login-button"><Link to="/login">{tr("Sign in", "ចូល")}</Link></Button>
          <Button asChild size="sm" className="rounded-full" data-testid="nav-register-button"><Link to="/register">{tr("Start free trial", "សាកល្បងឥតគិតថ្លៃ")}</Link></Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { tr } = useI18n();
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <Brand testId="footer-brand-link" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{tr("QR menus and table ordering for restaurants and cafés in Cambodia.", "ម៉ឺនុយ QR និងការកុម្ម៉ង់តាមតុ សម្រាប់ភោជនីយដ្ឋាន និងហាងកាហ្វេនៅកម្ពុជា។")}</p>
        </div>
        <div className="flex gap-10 text-sm">
          <div className="space-y-2">
            <Link to="/pricing" className="block hover:underline" data-testid="footer-pricing-link">{tr("Pricing", "តម្លៃ")}</Link>
            <Link to="/menu/demo" className="block hover:underline" data-testid="footer-demo-link">{tr("Demo menu", "ម៉ឺនុយសាកល្បង")}</Link>
          </div>
          <div className="space-y-2">
            <Link to="/login" className="block hover:underline" data-testid="footer-login-link">{tr("Sign in", "ចូល")}</Link>
            <Link to="/register" className="block hover:underline" data-testid="footer-register-link">{tr("Create account", "បង្កើតគណនី")}</Link>
          </div>
        </div>
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Tok Menu</p>
    </footer>
  );
}
