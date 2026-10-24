import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AuthLayout, Field, FormError } from "./AuthLayout";

export default function ResetPassword() {
  const { tr } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError(tr("Password must be at least 8 characters.", "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួ។"));
    if (password !== confirm) return setError(tr("Passwords don't match.", "ពាក្យសម្ងាត់មិនដូចគ្នា។"));
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={tr("Choose a new password", "ជ្រើសពាក្យសម្ងាត់ថ្មី")}>
      {!token ? (
        <FormError message={tr("This reset link is incomplete. Please request a new one.", "តំណនេះមិនពេញលេញ។ សូមស្នើថ្មី។")} testId="reset-missing-token" />
      ) : done ? (
        <div className="space-y-4" data-testid="reset-success">
          <p className="rounded-xl border bg-card p-4 text-sm">{tr("Your password was changed. Other devices have been signed out.", "ពាក្យសម្ងាត់ត្រូវបានប្ដូរ។ ឧបករណ៍ផ្សេងទៀតត្រូវបានចាកចេញ។")}</p>
          <Button asChild className="h-11 w-full rounded-full" data-testid="reset-go-login"><Link to="/login">{tr("Sign in", "ចូល")}</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={tr("New password", "ពាក្យសម្ងាត់ថ្មី")} htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" data-testid="reset-password-input" />
          </Field>
          <Field label={tr("Confirm password", "បញ្ជាក់ពាក្យសម្ងាត់")} htmlFor="confirm">
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" data-testid="reset-password-confirm-input" />
          </Field>
          <FormError message={error} testId="reset-error" />
          <Button type="submit" className="h-11 w-full rounded-full" disabled={busy} data-testid="reset-submit-button">
            {busy ? tr("Saving…", "កំពុងរក្សាទុក…") : tr("Save password", "រក្សាទុក")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
