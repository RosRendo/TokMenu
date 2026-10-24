import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { tr } = useI18n();
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6" data-testid="not-found-page">
      <Brand />
      <h1 className="text-4xl font-bold">{tr("Page not found", "រកមិនឃើញទំព័រ")}</h1>
      <p className="text-muted-foreground">{tr("The link may be old or mistyped.", "តំណអាចចាស់ ឬវាយខុស។")}</p>
      <Button asChild className="w-fit rounded-full" data-testid="not-found-home-button"><Link to="/">{tr("Go to homepage", "ទៅទំព័រដើម")}</Link></Button>
    </div>
  );
}
