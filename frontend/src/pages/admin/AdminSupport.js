import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader } from "@/components/Blocks";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { formatDate, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function Ticket({ t, onSaved }) {
  const { tr, lang } = useI18n();
  const [reply, setReply] = useState(t.admin_reply || "");
  const [busy, setBusy] = useState(false);
  const send = async (resolve) => {
    setBusy(true);
    try {
      await api.post(`/admin/support/${t.id}/reply`, { reply, resolve });
      toast.success(resolve ? tr("Marked resolved", "បានដោះស្រាយ") : tr("Reply saved", "បានរក្សាទុក"));
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const open = t.status === "open";
  return (
    <li className="rounded-xl border bg-card p-4" data-testid={`admin-ticket-${t.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", open ? "bg-blue-50 text-blue-700" : "bg-stone-100 text-stone-600")}>{open ? tr("Open", "បើក") : tr("Resolved", "ដោះស្រាយ")}</span>
        {t.type === "upgrade" && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{tr("Upgrade", "ដំឡើង")} → {t.requested_plan}</span>}
        {t.priority && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{tr("Priority", "អាទិភាព")}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{formatDate(t.created_at, lang)}</span>
      </div>
      <p className="mt-2 font-semibold">{t.subject}</p>
      <p className="text-xs text-muted-foreground">{t.restaurant_name} · {t.user_email}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{t.message}</p>
      <Textarea rows={2} className="mt-3" maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tr("Reply visible to the restaurant owner", "ឆ្លើយតបទៅម្ចាស់")} data-testid={`admin-ticket-reply-${t.id}`} />
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" disabled={busy || !reply.trim()} onClick={() => send(false)} data-testid={`admin-ticket-save-${t.id}`}>{tr("Save reply", "រក្សាទុក")}</Button>
        {open && <Button size="sm" disabled={busy} onClick={() => send(true)} data-testid={`admin-ticket-resolve-${t.id}`}>{tr("Reply & resolve", "ឆ្លើយ និងដោះស្រាយ")}</Button>}
      </div>
    </li>
  );
}

export default function AdminSupport() {
  const { tr } = useI18n();
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/support", { params: { status: status || undefined } });
      setRows(data);
    } catch (e) {
      setRows(false);
    }
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);
  const tabs = [["open", tr("Open", "បើក")], ["resolved", tr("Resolved", "ដោះស្រាយ")], ["", tr("All", "ទាំងអស់")]];
  return (
    <div className="max-w-4xl">
      <PageHeader title={tr("Support requests", "សំណើជំនួយ")} description={tr("Messages and plan-upgrade requests from restaurant owners.", "សារ និងសំណើដំឡើងគម្រោងពីម្ចាស់ភោជនីយដ្ឋាន។")} />
      <div className="mb-4 flex gap-1">
        {tabs.map(([k, l]) => (
          <Button key={k || "all"} size="sm" variant={status === k ? "default" : "outline"} onClick={() => setStatus(k)} data-testid={`admin-support-tab-${k || "all"}`}>{l}</Button>
        ))}
      </div>
      {rows === null ? <PageLoader /> : !rows ? <p className="text-sm">{tr("Couldn't load requests.", "មិនអាចផ្ទុកបាន។")}</p> : rows.length === 0 ? (
        <EmptyState title={tr("Nothing here", "គ្មានអ្វីទេ")} testId="admin-support-empty" />
      ) : (
        <ul className="space-y-3" data-testid="admin-support-list">{rows.map((t) => <Ticket key={t.id} t={t} onSaved={load} />)}</ul>
      )}
    </div>
  );
}
