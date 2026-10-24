import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmAction } from "@/components/ConfirmAction";
import { api, errorMessage } from "@/lib/api";
import { DAY_NAMES, useI18n } from "@/lib/i18n";
import { bpsToPercent, percentToBps } from "@/lib/money";
import { useDash } from "./context";

const fullWeek = (hours) => Array.from({ length: 7 }, (_, d) => hours.find((h) => h.day === d) || { day: d, closed: true, open: "07:00", close: "21:00" });

export function OrderingSettings({ Row }) {
  const { tr } = useI18n();
  const { restaurant, plan, reload } = useDash();
  const s = restaurant.settings;
  const [form, setForm] = useState(() => ({
    currency: s.currency, default_language: s.default_language || "en", temporarily_closed: !!s.temporarily_closed,
    service: bpsToPercent(s.service_charge_bps), tax: bpsToPercent(s.tax_bps), accent_color: s.accent_color || "#B94A00",
    alwaysOpen: !(s.opening_hours || []).length, hours: fullWeek(s.opening_hours || []),
  }));
  const [busy, setBusy] = useState(false);
  const setHour = (day, patch) => setForm((f) => ({ ...f, hours: f.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)) }));

  const save = async () => {
    const service = Number(form.service);
    const tax = Number(form.tax);
    if (!(service >= 0 && service <= 30) || !(tax >= 0 && tax <= 30)) return toast.error(tr("Percentages must be between 0 and 30", "ភាគរយត្រូវនៅចន្លោះ 0 និង 30"));
    setBusy(true);
    try {
      await api.put("/dashboard/restaurant/settings", {
        currency: form.currency, default_language: form.default_language, temporarily_closed: form.temporarily_closed,
        service_charge_bps: percentToBps(service), tax_bps: percentToBps(tax),
        opening_hours: form.alwaysOpen ? [] : form.hours, accent_color: plan.custom_branding ? form.accent_color : null,
      });
      toast.success(tr("Settings saved", "បានរក្សាទុក"));
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const currencyChanged = form.currency !== s.currency;
  const saveButton = <Button type="button" disabled={busy} data-testid="settings-ordering-save">{busy ? tr("Saving…", "កំពុងរក្សាទុក…") : tr("Save settings", "រក្សាទុក")}</Button>;

  return (
    <div className="space-y-6 rounded-xl border bg-card p-5" data-testid="settings-ordering-form">
      <Row label={tr("Accepting orders", "ទទួលការកុម្ម៉ង់")} hint={tr("Pause ordering during a rush or when closed early.", "ផ្អាកការកុម្ម៉ង់នៅពេលមមាញឹក ឬបិទមុនម៉ោង។")}>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={!form.temporarily_closed} onCheckedChange={(v) => setForm((f) => ({ ...f, temporarily_closed: !v }))} data-testid="settings-accepting-orders" />
          {form.temporarily_closed ? tr("Paused — customers can browse only", "បានផ្អាក — អតិថិជនមើលបានតែប៉ុណ្ណោះ") : tr("On", "បើក")}
        </label>
      </Row>
      <Row label={tr("Opening hours", "ម៉ោងបើក")} hint={tr("Restaurant time (Asia/Phnom_Penh). Same open and close time = 24 hours.", "ម៉ោងភ្នំពេញ។")}>
        <label className="mb-3 flex items-center gap-2 text-sm"><Checkbox checked={form.alwaysOpen} onCheckedChange={(v) => setForm((f) => ({ ...f, alwaysOpen: !!v }))} data-testid="settings-always-open" />{tr("Always open (no schedule)", "បើកជានិច្ច")}</label>
        {!form.alwaysOpen && (
          <div className="space-y-2" data-testid="settings-hours">
            {form.hours.map((h) => (
              <div key={h.day} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24">{tr(...DAY_NAMES[h.day])}</span>
                <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={!h.closed} onCheckedChange={(v) => setHour(h.day, { closed: !v })} data-testid={`settings-day-open-${h.day}`} />{tr("Open", "បើក")}</label>
                <Input type="time" value={h.open} disabled={h.closed} onChange={(e) => setHour(h.day, { open: e.target.value })} className="h-8 w-28" data-testid={`settings-day-from-${h.day}`} />
                <span>–</span>
                <Input type="time" value={h.close} disabled={h.closed} onChange={(e) => setHour(h.day, { close: e.target.value })} className="h-8 w-28" data-testid={`settings-day-to-${h.day}`} />
              </div>
            ))}
          </div>
        )}
      </Row>
      <Row label={tr("Currency", "រូបិយប័ណ្ណ")} hint={tr("Changing currency does not convert your prices.", "ការប្ដូររូបិយប័ណ្ណមិនបម្លែងតម្លៃទេ។")}>
        <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
          <SelectTrigger className="w-48" data-testid="settings-currency"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="USD">USD ($3.50)</SelectItem><SelectItem value="KHR">KHR (12,000៛)</SelectItem></SelectContent>
        </Select>
      </Row>
      <Row label={tr("Service charge & VAT", "ថ្លៃសេវា និងអាករ")} hint={tr("Shown as separate lines in the cart. VAT is applied after the service charge. 0 = off.", "បង្ហាញជាបន្ទាត់ដាច់ដោយឡែក។ 0 = បិទ។")}>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">{tr("Service", "សេវា")}<Input type="number" min={0} max={30} step="0.5" value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} className="h-9 w-20" data-testid="settings-service-charge" />%</label>
          <label className="flex items-center gap-2">VAT<Input type="number" min={0} max={30} step="0.5" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} className="h-9 w-20" data-testid="settings-tax" />%</label>
        </div>
      </Row>
      <Row label={tr("Default menu language", "ភាសាម៉ឺនុយលំនាំដើម")} hint={tr("Customers can always switch.", "អតិថិជនអាចប្ដូរបានជានិច្ច។")}>
        <Select value={form.default_language} onValueChange={(v) => setForm((f) => ({ ...f, default_language: v }))}>
          <SelectTrigger className="w-48" data-testid="settings-default-language"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="km">ខ្មែរ</SelectItem></SelectContent>
        </Select>
      </Row>
      <Row label={tr("Brand colour", "ពណ៌ម៉ាក")} hint={plan.custom_branding ? null : tr("Available on Pro.", "មាននៅ Pro។")}>
        <input type="color" value={form.accent_color} disabled={!plan.custom_branding} onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} className="h-9 w-16 cursor-pointer rounded border disabled:cursor-not-allowed disabled:opacity-40" data-testid="settings-accent-color" />
      </Row>
      <div className="flex justify-end">
        {currencyChanged ? (
          <ConfirmAction testId="settings-currency-confirm" destructive={false} trigger={saveButton}
            title={tr(`Switch currency to ${form.currency}?`, `ប្ដូររូបិយប័ណ្ណទៅ ${form.currency}?`)}
            description={tr("Existing prices are not converted. For example $3.50 stored as 350 cents becomes 350៛. Review your menu prices after switching.", "តម្លៃចាស់មិនត្រូវបម្លែងទេ។ សូមពិនិត្យតម្លៃម៉ឺនុយបន្ទាប់ពីប្ដូរ។")}
            confirmLabel={tr("Switch and save", "ប្ដូរ និងរក្សាទុក")} onConfirm={save} />
        ) : <span onClick={save}>{saveButton}</span>}
      </div>
    </div>
  );
}
