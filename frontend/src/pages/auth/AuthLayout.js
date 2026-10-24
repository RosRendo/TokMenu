import { Brand } from "@/components/Brand";
import { LangSwitch } from "@/components/LangSwitch";
import { Label } from "@/components/ui/label";

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Brand />
          <LangSwitch testId="auth-lang-switch" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold" data-testid="auth-title">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden lg:block">
        <img src="/demo/loklak.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-8 bottom-8 rounded-2xl bg-white/95 p-5 text-sm shadow-lg">
          <p className="font-display text-lg font-semibold">“តុ” — tok</p>
          <p className="mt-1 text-muted-foreground">Khmer for “table”. Every table becomes a place to order.</p>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, error, children, htmlFor, hint }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export function FormError({ message, testId = "form-error" }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" data-testid={testId}>{message}</p>;
}
