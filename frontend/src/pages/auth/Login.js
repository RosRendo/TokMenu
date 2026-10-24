import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/Loading";
import { api, errorMessage } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AuthLayout, Field, FormError } from "./AuthLayout";

export default function Login() {
  const { tr } = useI18n();
  const { session, setSession } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const schema = useMemo(() => z.object({
    email: z.string().email(tr("Enter a valid email", "សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ")),
    password: z.string().min(1, tr("Enter your password", "សូមបញ្ចូលពាក្យសម្ងាត់")),
  }), [tr]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  if (session === null) return <PageLoader />;
  if (session) return <Navigate to={homeFor(session)} replace />;

  const onSubmit = async (values) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/login", values);
      setSession(data);
      const next = params.get("next");
      navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(data), { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AuthLayout
      title={tr("Welcome back", "សូមស្វាគមន៍")}
      subtitle={tr("Sign in to manage your menu and orders.", "ចូលដើម្បីគ្រប់គ្រងម៉ឺនុយ និងការកុម្ម៉ង់។")}
      footer={<>{tr("New to Tok Menu?", "ថ្មីនៅ Tok Menu?")} <Link to="/register" className="font-semibold text-foreground underline-offset-2 hover:underline" data-testid="login-register-link">{tr("Create an account", "បង្កើតគណនី")}</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label={tr("Email", "អ៊ីមែល")} error={errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" className="h-11" data-testid="login-email-input" {...register("email")} />
        </Field>
        <Field label={tr("Password", "ពាក្យសម្ងាត់")} error={errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" className="h-11" data-testid="login-password-input" {...register("password")} />
        </Field>
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground" data-testid="login-forgot-password-link">{tr("Forgot password?", "ភ្លេចពាក្យសម្ងាត់?")}</Link>
        </div>
        <FormError message={error} testId="login-error" />
        <Button type="submit" className="h-11 w-full rounded-full" disabled={isSubmitting} data-testid="login-submit-button">
          {isSubmitting ? tr("Signing in…", "កំពុងចូល…") : tr("Sign in", "ចូល")}
        </Button>
      </form>
    </AuthLayout>
  );
}
