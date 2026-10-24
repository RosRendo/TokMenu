import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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

export default function Register() {
  const { tr } = useI18n();
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const schema = useMemo(() => z.object({
    name: z.string().trim().min(1, tr("Enter your name", "សូមបញ្ចូលឈ្មោះ")).max(80),
    restaurant_name: z.string().trim().min(2, tr("Enter your restaurant's name", "សូមបញ្ចូលឈ្មោះភោជនីយដ្ឋាន")).max(80),
    email: z.string().email(tr("Enter a valid email", "សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ")),
    password: z.string().min(8, tr("At least 8 characters", "យ៉ាងតិច ៨ តួអក្សរ")).max(128),
    confirm: z.string(),
  }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: tr("Passwords don't match", "ពាក្យសម្ងាត់មិនដូចគ្នា") }), [tr]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  if (session === null) return <PageLoader />;
  if (session) return <Navigate to={homeFor(session)} replace />;

  const onSubmit = async ({ confirm, ...values }) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/register", values);
      setSession(data);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AuthLayout
      title={tr("Create your restaurant", "បង្កើតភោជនីយដ្ឋានរបស់អ្នក")}
      subtitle={tr("Free for 14 days. No card needed.", "ឥតគិតថ្លៃ ១៤ ថ្ងៃ។ មិនត្រូវការកាត។")}
      footer={<>{tr("Already have an account?", "មានគណនីរួចហើយ?")} <Link to="/login" className="font-semibold text-foreground underline-offset-2 hover:underline" data-testid="register-login-link">{tr("Sign in", "ចូល")}</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label={tr("Your name", "ឈ្មោះរបស់អ្នក")} error={errors.name?.message} htmlFor="name">
          <Input id="name" autoComplete="name" className="h-11" data-testid="register-name-input" {...register("name")} />
        </Field>
        <Field label={tr("Restaurant name", "ឈ្មោះភោជនីយដ្ឋាន")} error={errors.restaurant_name?.message} htmlFor="restaurant_name" hint={tr("You can add the Khmer name later.", "អ្នកអាចបន្ថែមឈ្មោះខ្មែរពេលក្រោយ។")}>
          <Input id="restaurant_name" className="h-11" data-testid="register-restaurant-input" {...register("restaurant_name")} />
        </Field>
        <Field label={tr("Email", "អ៊ីមែល")} error={errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" className="h-11" data-testid="register-email-input" {...register("email")} />
        </Field>
        <Field label={tr("Password", "ពាក្យសម្ងាត់")} error={errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" className="h-11" data-testid="register-password-input" {...register("password")} />
        </Field>
        <Field label={tr("Confirm password", "បញ្ជាក់ពាក្យសម្ងាត់")} error={errors.confirm?.message} htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" className="h-11" data-testid="register-password-confirm-input" {...register("confirm")} />
        </Field>
        <FormError message={error} testId="register-error" />
        <Button type="submit" className="h-11 w-full rounded-full" disabled={isSubmitting} data-testid="register-submit-button">
          {isSubmitting ? tr("Creating…", "កំពុងបង្កើត…") : tr("Create restaurant", "បង្កើតភោជនីយដ្ឋាន")}
        </Button>
      </form>
    </AuthLayout>
  );
}
