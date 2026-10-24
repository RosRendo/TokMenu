import { Loader2 } from "lucide-react";

export const Spinner = ({ className = "h-5 w-5" }) => <Loader2 className={`animate-spin text-muted-foreground ${className}`} aria-hidden="true" />;

export function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center" data-testid="page-loader" role="status" aria-label="Loading">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
