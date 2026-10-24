import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangSwitch({ className, testId = "lang-switch" }) {
  const { lang, setLang } = useI18n();
  const opt = (value, label) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      data-testid={`${testId}-${value}`}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        lang === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className={cn("inline-flex items-center rounded-full border bg-card p-0.5", className)} data-testid={testId} role="group" aria-label="Language">
      {opt("en", "EN")}
      {opt("km", "ខ្មែរ")}
    </div>
  );
}
