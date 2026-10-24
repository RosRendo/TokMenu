import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, children, action, className, testId = "empty-state" }) {
  return (
    <div data-testid={testId} className={cn("flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card/60 p-8", className)}>
      {Icon && (
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <p className="font-display text-base font-semibold">{title}</p>
        {children && <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl" data-testid="page-title">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, testId, tone }) {
  return (
    <div data-testid={testId} className={cn("rounded-xl border bg-card p-4", tone === "attention" && "border-blue-200 bg-blue-50/60")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
