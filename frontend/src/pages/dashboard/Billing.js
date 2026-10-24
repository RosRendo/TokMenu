import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { planFeatures } from "@/components/PricingCards";
import { api, errorMessage } from "@/lib/api";
import { formatDate, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function SupportForm({ onSent }) {
  const { tr } = useI18n();
  const [form, setForm] = useState({ subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (form.subject.trim().length < 3 || !form.message.trim()) return toast.error(tr("Add a subject and a message", "បញ្ចូលប្រធានបទ និងសារ"));
    setBusy(true);
    try {
      await api.post("/dashboard/support", { type: "support", ...form });
      setForm({ subject: "", message: "" });
      toast.success(tr("Message sent to Tok Menu support", "បានផ្ញើសារទៅជំនួយ"));
      onSent?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="space-y-2 rounded-xl border bg-card p-4" data-testid="support-form">
      <p className="font-display text-sm font-semibold">{tr("Contact support", "ទាក់ទងជំនួយ")}</p>
      <Input value={form.subject} maxLength={120} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={tr("Subject", "ប្រធានបទ")} data-testid="support-subject" />
      <Textarea value={form.message} maxLength={2000} rows={3} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={tr("How can we help?", "តើយើងអាចជួយអ្វីបាន?")} data-testid="support-message" />
      <Button type="submit" disabled={busy} data-testid="support-send">{tr("Send", "ផ្ញើ")}</Button>
    </form>
  );
}

function Usage({ label, used, max, testId }) {
  const { tr } = useI18n();
  return (
    <div data-testid={testId}>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular text-muted-foreground">{used} / {max ?? tr("unlimited", "មិនកំណត់")}</span></div>
      <Progress value={max ? Math.min(100, (used / max) * 100) : 4} className="mt-1.5 h-1.5" />
    </div>
  );
}

function UpgradeDialog({ plan, onClose, onSent }) {
  const { tr, loc } = useI18n();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.post("/dashboard/support", { type: "upgrade", requested_plan: plan.key, subject: `Upgrade request: ${plan.name}`, message: message.trim() || `Please switch us to the ${plan.name} plan.` });
      toast.success(tr("Request sent. Our team will contact you to activate the plan.", "បានផ្ញើសំណើ។ ក្រុមការងារនឹងទាក់ទងអ្នក។"));
      onSent();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="upgrade-dialog">
        <DialogHeader>
          <DialogTitle>{tr("Request", "ស្នើ")} {loc(plan)}</DialogTitle>
          <DialogDescription>{tr("No card is collected and nothing is charged now. Our team will confirm payment details with you and switch the plan on.", "មិនប្រមូលកាត និងមិនគិតប្រាក់ឥឡូវទេ។")}</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} placeholder={tr("Anything we should know? (optional)", "មានអ្វីចង់ប្រាប់? (ស្រេចចិត្ត)")} data-testid="upgrade-message" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="upgrade-cancel">{tr("Cancel", "បោះបង់")}</Button>
          <Button onClick={send} disabled={busy} data-testid="upgrade-send">{tr("Send request", "ផ្ញើសំណើ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Billing() {
  const { tr, loc, lang } = useI18n();
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [upgrade, setUpgrade] = useState(null);

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([api.get("/dashboard/billing"), api.get("/dashboard/support")]);
    setData(b.data);
    setRequests(s.data);
  }, []);
  useEffect(() => {
    load().catch(() => setData(false));
  }, [load]);

  if (data === null) return <PageLoader />;
  if (!data) return <p className="text-sm">{tr("Couldn't load billing.", "មិនអាចផ្ទុកបាន។")}</p>;
  const sub = data.subscription || {};
  const current = data.plan;

  return (
    <div className="max-w-5xl">
      <PageHeader title={tr("Plan & billing", "គម្រោង")} description={tr("No card is stored and nothing is charged automatically. Paid plans are activated manually by the Tok Menu team.", "គ្មានកាតត្រូវបានរក្សាទុក។ គម្រោងបង់ប្រាក់ត្រូវបានបើកដោយក្រុមការងារ។")} />
      <section className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-2" data-testid="billing-current">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr("Current plan", "គម្រោងបច្ចុប្បន្ន")}</p>
          <p className="mt-1 font-display text-2xl font-bold" data-testid="billing-plan-name">{loc(current)}</p>
          <p className="mt-1 text-sm">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", data.ordering_allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")} data-testid="billing-status">{sub.status}</span>
            {sub.current_period_end && <span className="ml-2 text-muted-foreground">{sub.status === "trialing" ? tr("Trial ends", "សាកល្បងបញ្ចប់") : tr("Renews / ends", "បន្ត / បញ្ចប់")} {formatDate(sub.current_period_end, lang)}</span>}
          </p>
          {!data.ordering_allowed && <p className="mt-3 text-sm text-red-700">{tr("Ordering is paused. Your menu is still visible. Request a renewal below.", "ការកុម្ម៉ង់ត្រូវបានផ្អាក។ សូមស្នើបន្ត។")}</p>}
        </div>
        <div className="space-y-3">
          <Usage testId="billing-usage-items" label={tr("Menu items", "មុខម្ហូប")} used={data.usage.items} max={current.max_items} />
          <Usage testId="billing-usage-tables" label={tr("Tables", "តុ")} used={data.usage.tables} max={current.max_tables} />
          <Usage testId="billing-usage-staff" label={tr("Staff", "បុគ្គលិក")} used={data.usage.staff} max={current.max_staff} />
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3" data-testid="billing-plans">
        {data.plans.map((p) => (
          <div key={p.key} className={cn("flex flex-col rounded-xl border bg-card p-5", p.key === current.key && "border-primary")} data-testid={`billing-plan-${p.key}`}>
            <p className="font-display text-lg font-bold">{loc(p)}</p>
            <p className="font-display text-2xl font-bold tabular">{p.price_usd ? `$${p.price_usd}` : tr("Free", "ឥតគិតថ្លៃ")}<span className="text-sm font-normal text-muted-foreground">{p.price_usd ? tr(" / month (example)", " / ខែ (ឧទាហរណ៍)") : ""}</span></p>
            <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">{planFeatures(p, tr).filter(([on]) => on).map(([, l]) => <li key={l}>• {l}</li>)}</ul>
            {p.key === current.key ? (
              <Button variant="outline" className="mt-4" disabled data-testid={`billing-current-${p.key}`}>{tr("Current plan", "គម្រោងបច្ចុប្បន្ន")}</Button>
            ) : p.key !== "trial" && (
              <Button className="mt-4" onClick={() => setUpgrade(p)} data-testid={`billing-request-${p.key}`}>{tr("Request", "ស្នើ")} {loc(p)}</Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SupportForm onSent={load} />
        <section className="rounded-xl border bg-card p-4" data-testid="support-requests">
          <p className="font-display text-sm font-semibold">{tr("Your requests", "សំណើរបស់អ្នក")}</p>
          {requests.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{tr("No requests yet.", "មិនទាន់មានសំណើ។")}</p> : (
            <ul className="mt-2 divide-y">
              {requests.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.subject}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.status === "open" ? "bg-blue-50 text-blue-700" : "bg-stone-100 text-stone-600")}>{r.status === "open" ? tr("Open", "បើក") : tr("Resolved", "ដោះស្រាយ")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(r.created_at, lang)}</p>
                  {r.admin_reply && <p className="mt-1 rounded-lg bg-secondary p-2 text-xs">{tr("Reply", "ឆ្លើយតប")}: {r.admin_reply}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {upgrade && <UpgradeDialog plan={upgrade} onClose={() => setUpgrade(null)} onSent={() => { setUpgrade(null); load(); }} />}
    </div>
  );
}
