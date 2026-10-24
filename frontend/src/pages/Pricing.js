import { Check, Minus } from "lucide-react";
import { PricingCards, planFeatures, usePlans } from "@/components/PricingCards";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { useI18n } from "@/lib/i18n";

export default function Pricing() {
  const { tr, loc } = useI18n();
  const plans = usePlans();
  const rows = plans.length ? planFeatures(plans[0], tr).map((_, i) => i) : [];
  return (
    <div className="bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-bold sm:text-5xl" data-testid="pricing-title">{tr("Pricing", "តម្លៃ")}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">{tr("Start with a free 14-day trial. Upgrade when you're ready — our team switches plans on manually, so you are never charged by surprise.", "ចាប់ផ្ដើមដោយសាកល្បងឥតគិតថ្លៃ ១៤ ថ្ងៃ។ ក្រុមការងារបើកគម្រោងដោយដៃ ដូច្នេះអ្នកមិនដែលត្រូវគិតប្រាក់ដោយមិនដឹងខ្លួនទេ។")}</p>
        <div className="mt-10"><PricingCards /></div>
        {plans.length > 0 && (
          <div className="mt-16 overflow-x-auto rounded-2xl border bg-card" data-testid="pricing-compare-table">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-4 font-display">{tr("Compare plans", "ប្រៀបធៀបគម្រោង")}</th>
                  {plans.map((p) => <th key={p.key} className="p-4 font-display">{loc(p)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-4 text-muted-foreground">{planFeatures(plans[2] || plans[0], tr)[i][1].replace(/^\d+\s/, "")}</td>
                    {plans.map((p) => {
                      const [on, label] = planFeatures(p, tr)[i];
                      return <td key={p.key} className="p-4">{on ? <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" />{label}</span> : <Minus className="h-4 w-4 text-muted-foreground" />}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-6 text-xs text-muted-foreground">{tr("Prices shown are examples for validation and may change before launch. Online payments are not processed by Tok Menu.", "តម្លៃជាឧទាហរណ៍ ហើយអាចផ្លាស់ប្ដូរ។ Tok Menu មិនដំណើរការការបង់ប្រាក់តាមអនឡាញទេ។")}</p>
      </main>
      <SiteFooter />
    </div>
  );
}
