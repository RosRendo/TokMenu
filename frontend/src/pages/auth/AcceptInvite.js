import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AuthLayout, Field, FormError } from "./AuthLayout";

export default function AcceptInvite() {
  const { tr } = useI18n();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ name: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoadError(tr("This invitation link is incomplete.", "តំណអញ្ជើញនេះមិនពេញលេញ។"));
      return;
    }
    api.get(`/auth/invites/${encodeURIComponent(token)}`).then(({ data }) => setInvite(data)).catch((e) => setLoadError(errorMessage(e)));
  }, [token, tr]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!invite.existing_user) {
      if (!form.name.trim()) return setError(tr("Please enter your name.", "សូមបញ្ចូលឈ្មោះ។"));
      if (form.password !== form.confirm) return setError(tr("Passwords don't match.", "ពាក្យសម្ងាត់មិនដូចគ្នា។"));
    }
    if (form.password.length < 8) return setError(tr("Password must be at least 8 characters.", "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួ។"));
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/invites/accept", { token, name: form.name, password: form.password });
      setSession(data);
      navigate("/dashboard/orders", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!invite && !loadError) return <PageLoader />;

  return (
    <AuthLayout
      title={tr("Join your team", "ចូលរួមជាមួយក្រុម")}
      subtitle={invite ? tr(`You've been invited to ${invite.restaurant_name} as staff.`, `អ្នកត្រូវបានអញ្ជើញទៅ ${invite.restaurant_name} ជាបុគ្គលិក។`) : null}
    >
      {loadError ? <FormError message={loadError} testId="invite-load-error" /> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={tr("Email", "អ៊ីមែល")} htmlFor="email">
            <Input id="email" value={invite.email} disabled className="h-11" data-testid="invite-email" />
          </Field>
          {!invite.existing_user && (
            <Field label={tr("Your name", "ឈ្មោះរបស់អ្នក")} htmlFor="name">
              <Input id="name" value={form.name} onChange={set("name")} className="h-11" data-testid="invite-name-input" />
            </Field>
          )}
          <Field label={invite.existing_user ? tr("Your existing password", "ពាក្យសម្ងាត់បច្ចុប្បន្ន") : tr("Create a password", "បង្កើតពាក្យសម្ងាត់")} htmlFor="password">
            <Input id="password" type="password" value={form.password} onChange={set("password")} className="h-11" data-testid="invite-password-input" />
          </Field>
          {!invite.existing_user && (
            <Field label={tr("Confirm password", "បញ្ជាក់ពាក្យសម្ងាត់")} htmlFor="confirm">
              <Input id="confirm" type="password" value={form.confirm} onChange={set("confirm")} className="h-11" data-testid="invite-password-confirm-input" />
            </Field>
          )}
          <FormError message={error} testId="invite-error" />
          <Button type="submit" className="h-11 w-full rounded-full" disabled={busy} data-testid="invite-submit-button">
            {busy ? tr("Joining…", "កំពុងចូលរួម…") : tr("Accept invitation", "ទទួលការអញ្ជើញ")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
