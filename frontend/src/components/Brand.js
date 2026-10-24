import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function BrandMark({ className }) {
  return (
    <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-[15px] font-bold leading-none text-white", className)} aria-hidden="true">
      តុ
    </span>
  );
}

export function Brand({ to = "/", className, testId = "brand-home-link" }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight", className)} data-testid={testId}>
      <BrandMark />
      <span>Tok Menu</span>
    </Link>
  );
}
