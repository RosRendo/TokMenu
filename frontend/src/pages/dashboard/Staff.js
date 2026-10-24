import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Mail, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmAction } from "@/components/ConfirmAction";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { formatDate, useI18n } from "@/lib/i18n";

export default function Staff() {
  const { tr, lang } = useI18n();
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);

  const load = useCallback(async () => {
    const { data: d } = await api.get("/dashboard/staff");
    setData(d);
  }, []);
  useEffect(() => {
    load().catch(() => setData({ members: [], invites: [], max_staff: 0 }));
  }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error(tr("Enter a valid email", "បញ្ចូលអ៊ីមែលត្រឹមត្រូវ"));
    setBusy(true);
    try {
      const { data: res } = await api.post("/dashboard/staff/invites", { email, can_manage_availability: perm });
      setLastInvite(res);
      setEmail("");
      setPerm(false);
      toast.success(res.email_sent ? tr("Invitation sent", "បានផ្ញើការអញ្ជើញ") : tr("Invitation created — email could not be sent, share the link instead", "បានបង្កើត — សូមចែករំលែកតំណ"));
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const patch = async (m, value) => {
    try {
      await api.patch(`/dashboard/staff/${m.id}`, { can_manage_availability: value });
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (m) => {
    try {
      await api.delete(`/dashboard/staff/${m.id}`);
      toast.success(tr("Staff member removed", "បានដកបុគ្គលិកចេញ"));
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const revoke = async (inv) => {
    try {
      await api.delete(`/dashboard/staff/invites/${inv.id}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!data) return <PageLoader />;
  const staffCount = data.members.filter((m) => m.role === "staff").length;
  const atLimit = staffCount + data.invites.length >= data.max_staff;

  return (
    <div className="max-w-3xl">
      <PageHeader title={tr("Staff", "បុគ្គលិក")} description={`${staffCount} / ${data.max_staff} ${tr("staff accounts. Staff can see and update orders only — not reports, settings or billing.", "គណនីបុគ្គលិក។ បុគ្គលិកឃើញតែការកុម្ម៉ង់ប៉ុណ្ណោះ។")}`} />
      {data.max_staff === 0 ? (
        <EmptyState icon={Users} title={tr("Staff accounts start on the Starter plan", "គណនីបុគ្គលិកចាប់ផ្ដើមពីគម្រោង Starter")} testId="staff-plan-locked"
          action={<Button asChild data-testid="staff-upgrade-button"><Link to="/dashboard/billing">{tr("See plans", "មើលគម្រោង")}</Link></Button>}>
          {tr("During the trial only the owner can sign in.", "ក្នុងពេលសាកល្បង មានតែម្ចាស់ទេដែលអាចចូលបាន។")}
        </EmptyState>
      ) : (
        <form onSubmit={invite} className="mb-6 space-y-3 rounded-xl border bg-card p-4" data-testid="staff-invite-form">
          <p className="font-display text-sm font-semibold">{tr("Invite a staff member", "អញ្ជើញបុគ្គលិក")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" disabled={atLimit} data-testid="staff-invite-email" />
            <Button type="submit" disabled={busy || atLimit} data-testid="staff-invite-button"><UserPlus />{tr("Send invite", "ផ្ញើការអញ្ជើញ")}</Button>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={perm} onCheckedChange={(v) => setPerm(!!v)} data-testid="staff-invite-permission" />{tr("Can mark menu items sold out", "អាចកត់មុខម្ហូបថាអស់")}</label>
          {atLimit && <p className="text-xs text-muted-foreground">{tr("You've reached your plan's staff limit.", "អ្នកបានដល់ដែនកំណត់បុគ្គលិក។")}</p>}
        </form>
      )}
      {lastInvite && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm" data-testid="staff-invite-result">
          <p className="font-semibold">{lastInvite.email_sent ? tr("Email sent. You can also share this link (valid 7 days):", "បានផ្ញើអ៊ីមែល។ អ្នកក៏អាចចែករំលែកតំណនេះ (៧ ថ្ងៃ)៖") : tr("Email couldn't be sent. Share this link with your staff (valid 7 days):", "មិនអាចផ្ញើអ៊ីមែល។ សូមចែករំលែកតំណនេះ៖")}</p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={lastInvite.invite_url} className="bg-white font-mono text-xs" data-testid="staff-invite-link" />
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(lastInvite.invite_url).then(() => toast.success(tr("Copied", "បានចម្លង")))} data-testid="staff-invite-copy"><Copy /></Button>
          </div>
        </div>
      )}
      <ul className="divide-y rounded-xl border bg-card" data-testid="staff-list">
        {data.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`staff-row-${m.id}`}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">{(m.name || m.email).slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.name || m.email}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email} · {m.role === "owner" ? tr("Owner", "ម្ចាស់") : tr("Staff", "បុគ្គលិក")}</p>
            </div>
            {m.role === "staff" && (
              <>
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={m.can_manage_availability} onCheckedChange={(v) => patch(m, v)} data-testid={`staff-permission-${m.id}`} />{tr("Sold-out switch", "កត់ថាអស់")}</label>
                <ConfirmAction testId={`staff-remove-confirm-${m.id}`} trigger={<Button variant="ghost" size="sm" data-testid={`staff-remove-${m.id}`}>{tr("Remove", "ដកចេញ")}</Button>}
                  title={tr("Remove this staff member?", "ដកបុគ្គលិកនេះចេញ?")} description={tr("They will lose access immediately.", "ពួកគេនឹងបាត់បង់សិទ្ធិភ្លាមៗ។")} confirmLabel={tr("Remove", "ដកចេញ")} onConfirm={() => remove(m)} />
              </>
            )}
          </li>
        ))}
      </ul>
      {data.invites.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{tr("Pending invitations", "ការអញ្ជើញកំពុងរង់ចាំ")}</h2>
          <ul className="divide-y rounded-xl border bg-card" data-testid="staff-invites">
            {data.invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{inv.email}</span>
                <span className="text-xs text-muted-foreground">{tr("expires", "ផុតកំណត់")} {formatDate(inv.expires_at, lang)}</span>
                <Button variant="ghost" size="sm" onClick={() => revoke(inv)} data-testid={`staff-invite-revoke-${inv.id}`}>{tr("Revoke", "ដកវិញ")}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
