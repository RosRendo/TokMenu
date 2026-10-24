import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function usePlans() {
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    api.get("/public/plans").then(({ data }) => setPlans(data.plans)).catch(() => setPlans([]));
  }, []);
  return plans;
}

export function planFeatures(plan, tr) {
  const n = (v, unlimited) => (v === null ? unlimited : v);
  return [
    [true, tr(`${n(plan.max_items, "Unlimited")} menu items`, `មុខម្ហូប ${n(plan.max_items, "មិនកំណត់")}`)],
    [true, tr(`${plan.max_tables} table QR codes`, `កូដ QR តុ ${plan.max_tables}`)],
    [plan.max_staff > 0, plan.max_staff > 0 ? tr(`${plan.max_staff} staff accounts`, `គណនីបុគ្គលិក ${plan.max_staff}`) : tr("Owner account only", "គណនីម្ចាស់តែប៉ុណ្ណោះ")],
    [true, tr("Live order board", "ផ្ទាំងកុម្ម៉ង់ផ្ទាល់")],
    [plan.history_days === null, plan.history_days === null ? tr("Full order history", "ប្រវត្តិកុម្ម៉ង់ពេញលេញ") : tr(`Last ${plan.history_days} days of history`, `ប្រវត្តិ ${plan.history_days} ថ្ងៃចុងក្រោយ`)],
    [plan.reports, plan.advanced_reports ? tr("Advanced reports + CSV export", "របាយការណ៍កម្រិតខ្ពស់ + CSV") : tr("Basic sales reports", "របាយការណ៍លក់មូលដ្ឋាន")],
    [plan.custom_branding, tr("Brand accent colour", "ពណ៌ម៉ាកយីហោ")],
    [plan.priority_support, tr("Priority support", "ជំនួយអាទិភាព")],
  ];
}

export function PricingCards({ ctaTo = "/register", compact = false }) {
  const { tr, loc } = useI18n();
  const plans = usePlans();
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3" data-testid="pricing-cards">
        {plans.map((p) => {
          const highlight = p.key === "starter";
          return (
            <div key={p.key} data-testid={`pricing-card-${p.key}`}
              className={cn("flex flex-col rounded-2xl border bg-card p-6", highlight && "border-primary shadow-[0_12px_40px_-20px_rgba(185,74,0,0.45)]")}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">{loc(p)}</h3>
                {highlight && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{tr("Most restaurants", "ភាគច្រើនជ្រើស")}</span>}
              </div>
              <p className="mt-4 font-display text-4xl font-bold tabular">
                {p.price_usd === 0 ? tr("Free", "ឥតគិតថ្លៃ") : `$${p.price_usd}`}
                <span className="ml-1 text-sm font-medium text-muted-foreground">{p.price_usd === 0 ? tr("for 14 days", "រយៈពេល ១៤ ថ្ងៃ") : tr("/ month", "/ ខែ")}</span>
              </p>
              {p.price_usd > 0 && <p className="mt-1 text-xs text-muted-foreground">{tr("Example price — not yet final", "តម្លៃឧទាហរណ៍ — មិនទាន់ចុងក្រោយ")}</p>}
              {!compact && (
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {planFeatures(p, tr).map(([on, label]) => (
                    <li key={label} className={cn("flex items-start gap-2", !on && "text-muted-foreground")}>
                      {on ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Minus className="mt-0.5 h-4 w-4 shrink-0" />}
                      {label}
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild className="mt-6 rounded-full" variant={highlight ? "default" : "outline"} data-testid={`pricing-cta-${p.key}`}>
                <Link to={ctaTo}>{tr("Start free trial", "សាកល្បងឥតគិតថ្លៃ")}</Link>
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{tr("No card needed. Plans are switched on manually by our team after you request an upgrade — nothing is charged automatically.", "មិនត្រូវការកាត។ គម្រោងត្រូវបានបើកដោយក្រុមការងារ បន្ទាប់ពីអ្នកស្នើសុំ — គ្មានការគិតប្រាក់ស្វ័យប្រវត្តិទេ។")}</p>
    </div>
  );
}
