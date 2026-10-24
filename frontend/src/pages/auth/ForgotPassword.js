import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AuthLayout, Field, FormError } from "./AuthLayout";

export default function ForgotPassword() {
  const { tr } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(tr("Enter a valid email", "សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ"));
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={tr("Reset your password", "កំណត់ពាក្យសម្ងាត់ឡើងវិញ")}
      subtitle={tr("We'll email you a link that works for 1 hour.", "យើងនឹងផ្ញើតំណដែលប្រើបាន ១ ម៉ោង។")}
      footer={<Link to="/login" className="font-semibold text-foreground underline-offset-2 hover:underline" data-testid="forgot-back-to-login">{tr("Back to sign in", "ត្រឡប់ទៅចូល")}</Link>}
    >
      {sent ? (
        <p className="rounded-xl border bg-card p-4 text-sm" data-testid="forgot-success">
          {tr("If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.", "ប្រសិនបើមានគណនីសម្រាប់អ៊ីមែលនោះ តំណកំណត់ឡើងវិញកំពុងត្រូវបានផ្ញើ។")}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={tr("Email", "អ៊ីមែល")} htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" data-testid="forgot-email-input" />
          </Field>
          <FormError message={error} testId="forgot-error" />
          <Button type="submit" className="h-11 w-full rounded-full" disabled={busy} data-testid="forgot-submit-button">
            {busy ? tr("Sending…", "កំពុងផ្ញើ…") : tr("Send reset link", "ផ្ញើតំណ")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
