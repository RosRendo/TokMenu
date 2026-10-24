import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Loading";
import { api, errorMessage, imgUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ImageUpload({ value, onChange, kind = "item", className, aspect = "aspect-[4/3]", testId = "image-upload" }) {
  const { tr } = useI18n();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast.error(tr("Please choose a JPG, PNG or WebP image.", "សូមជ្រើសរូបភាព JPG, PNG ឬ WebP។"));
    if (file.size > MAX_BYTES) return toast.error(tr("Images must be 5 MB or smaller.", "រូបភាពត្រូវតែតូចជាង ៥MB។"));
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    setBusy(true);
    try {
      const { data } = await api.post("/dashboard/uploads", form, { timeout: 60000 });
      onChange(data.url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        data-testid={`${testId}-button`}
        className={cn("relative grid w-full place-items-center overflow-hidden rounded-xl border border-dashed bg-secondary text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground", aspect)}
      >
        {value ? (
          <img src={imgUrl(value)} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid={`${testId}-preview`} />
        ) : (
          <span className="flex flex-col items-center gap-1 p-4">
            <ImagePlus className="h-5 w-5" />
            {tr("Upload photo", "បង្ហោះរូបភាព")}
            <span className="text-xs">JPG, PNG, WebP · ≤ 5 MB</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-white/80">
            <Spinner />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} data-testid={`${testId}-input`} />
      {value && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} data-testid={`${testId}-replace`}>
            {tr("Replace", "ប្ដូរ")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} data-testid={`${testId}-remove`}>
            <Trash2 /> {tr("Remove", "លុប")}
          </Button>
        </div>
      )}
    </div>
  );
}
