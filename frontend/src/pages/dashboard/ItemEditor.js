import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fromMinor, moneyPattern, toMinor } from "@/lib/money";

function makeSchema(currency, tr) {
  const pattern = moneyPattern(currency);
  const priceMsg = currency === "KHR" ? tr("Whole riel, e.g. 12000", "ជារៀលគត់ ឧ. 12000") : tr("e.g. 3.50", "ឧ. 3.50");
  const option = z.object({
    id: z.string().nullable().optional(),
    name: z.string().trim().min(1, tr("Required", "ត្រូវការ")).max(60),
    name_km: z.string().max(60).optional().default(""),
    price: z.string().trim().refine((v) => v === "" || pattern.test(v), priceMsg),
    available: z.boolean(),
  });
  const group = z.object({
    id: z.string().nullable().optional(),
    name: z.string().trim().min(1, tr("Group name required", "ត្រូវការឈ្មោះក្រុម")).max(60),
    name_km: z.string().max(60).optional().default(""),
    required: z.boolean(),
    multiple: z.boolean(),
    max: z.coerce.number().int().min(1).max(20),
    options: z.array(option).min(1, tr("Add at least one option", "បន្ថែមជម្រើសយ៉ាងតិចមួយ")).max(20),
  }).refine((g) => !g.multiple || g.max <= g.options.length, { path: ["max"], message: tr("Cannot exceed the number of options", "មិនអាចលើសចំនួនជម្រើស") });
  return z.object({
    category_id: z.string().min(1, tr("Choose a category", "ជ្រើសប្រភេទ")),
    name: z.string().trim().min(1, tr("Name is required", "ត្រូវការឈ្មោះ")).max(80),
    name_km: z.string().max(80).optional().default(""),
    description: z.string().max(500).optional().default(""),
    description_km: z.string().max(500).optional().default(""),
    price: z.string().trim().regex(pattern, priceMsg),
    image_url: z.string().nullable().optional(),
    available: z.boolean(),
    featured: z.boolean(),
    option_groups: z.array(group).max(10),
  });
}

function toForm(item, currency, defaultCategory) {
  return {
    category_id: item?.category_id || defaultCategory || "",
    name: item?.name || "", name_km: item?.name_km || "",
    description: item?.description || "", description_km: item?.description_km || "",
    price: item ? fromMinor(item.price, currency) : "",
    image_url: item?.image_url || null,
    available: item ? item.available : true,
    featured: item ? item.featured : false,
    option_groups: (item?.option_groups || []).map((g) => ({
      id: g.id, name: g.name, name_km: g.name_km || "", required: g.min_select >= 1, multiple: g.max_select > 1, max: Math.max(1, g.max_select),
      options: g.options.map((o) => ({ id: o.id, name: o.name, name_km: o.name_km || "", price: o.price_delta ? fromMinor(o.price_delta, currency) : "", available: o.available })),
    })),
  };
}

function toPayload(v, currency) {
  return {
    ...v,
    price: toMinor(v.price, currency),
    option_groups: v.option_groups.map((g) => ({
      id: g.id || null, name: g.name, name_km: g.name_km || "",
      min_select: g.required ? 1 : 0,
      max_select: g.multiple ? Math.max(g.max, g.required ? 1 : 1) : 1,
      options: g.options.map((o) => ({ id: o.id || null, name: o.name, name_km: o.name_km || "", price_delta: o.price ? toMinor(o.price, currency) : 0, available: o.available })),
    })),
  };
}

function OptionRows({ control, register, gIndex, errors, tr }) {
  const { fields, append, remove } = useFieldArray({ control, name: `option_groups.${gIndex}.options` });
  return (
    <div className="space-y-2">
      {fields.map((f, oIndex) => (
        <div key={f.id} className="grid grid-cols-12 items-center gap-2" data-testid={`option-row-${gIndex}-${oIndex}`}>
          <Input className="col-span-4" placeholder={tr("Option (EN)", "ជម្រើស (EN)")} {...register(`option_groups.${gIndex}.options.${oIndex}.name`)} data-testid={`option-name-${gIndex}-${oIndex}`} />
          <Input className="col-span-3" placeholder="ខ្មែរ" {...register(`option_groups.${gIndex}.options.${oIndex}.name_km`)} data-testid={`option-name-km-${gIndex}-${oIndex}`} />
          <Input className="col-span-2" placeholder="+0" inputMode="decimal" {...register(`option_groups.${gIndex}.options.${oIndex}.price`)} data-testid={`option-price-${gIndex}-${oIndex}`} />
          <Controller control={control} name={`option_groups.${gIndex}.options.${oIndex}.available`} render={({ field }) => (
            <div className="col-span-2 flex items-center justify-center"><Switch checked={field.value} onCheckedChange={field.onChange} aria-label={tr("Available", "មាន")} data-testid={`option-available-${gIndex}-${oIndex}`} /></div>
          )} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => remove(oIndex)} disabled={fields.length <= 1} aria-label={tr("Remove option", "លុបជម្រើស")} data-testid={`option-remove-${gIndex}-${oIndex}`}><Trash2 /></Button>
          {errors?.options?.[oIndex] && <p className="col-span-12 text-xs text-destructive">{errors.options[oIndex].name?.message || errors.options[oIndex].price?.message}</p>}
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => append({ id: null, name: "", name_km: "", price: "", available: true })} data-testid={`option-add-${gIndex}`}><Plus />{tr("Add option", "បន្ថែមជម្រើស")}</Button>
    </div>
  );
}

function OptionGroups({ control, register, watch, errors, tr }) {
  const { fields, append, remove } = useFieldArray({ control, name: "option_groups" });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{tr("Options", "ជម្រើស")}</p>
          <p className="text-xs text-muted-foreground">{tr("e.g. Size (required), Add-ons (optional, extra price)", "ឧ. ទំហំ (ត្រូវជ្រើស) បន្ថែម (ស្រេចចិត្ត)")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ id: null, name: "", name_km: "", required: true, multiple: false, max: 1, options: [{ id: null, name: "", name_km: "", price: "", available: true }] })} disabled={fields.length >= 10} data-testid="option-group-add"><Plus />{tr("Add option group", "បន្ថែមក្រុមជម្រើស")}</Button>
      </div>
      {fields.map((f, gIndex) => {
        const multiple = watch(`option_groups.${gIndex}.multiple`);
        const gErr = errors?.option_groups?.[gIndex];
        return (
          <div key={f.id} className="space-y-3 rounded-xl border bg-secondary/40 p-3" data-testid={`option-group-editor-${gIndex}`}>
            <div className="grid grid-cols-12 gap-2">
              <Input className="col-span-6" placeholder={tr("Group name, e.g. Size", "ឈ្មោះក្រុម ឧ. ទំហំ")} {...register(`option_groups.${gIndex}.name`)} data-testid={`option-group-name-${gIndex}`} />
              <Input className="col-span-5" placeholder="ខ្មែរ" {...register(`option_groups.${gIndex}.name_km`)} data-testid={`option-group-name-km-${gIndex}`} />
              <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => remove(gIndex)} aria-label={tr("Remove group", "លុបក្រុម")} data-testid={`option-group-remove-${gIndex}`}><Trash2 /></Button>
            </div>
            {gErr?.name && <p className="text-xs text-destructive">{gErr.name.message}</p>}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Controller control={control} name={`option_groups.${gIndex}.required`} render={({ field }) => (
                <label className="flex items-center gap-2"><Switch checked={field.value} onCheckedChange={field.onChange} data-testid={`option-group-required-${gIndex}`} />{tr("Customer must choose", "អតិថិជនត្រូវជ្រើស")}</label>
              )} />
              <Controller control={control} name={`option_groups.${gIndex}.multiple`} render={({ field }) => (
                <label className="flex items-center gap-2"><Switch checked={field.value} onCheckedChange={field.onChange} data-testid={`option-group-multiple-${gIndex}`} />{tr("Allow several", "អនុញ្ញាតច្រើន")}</label>
              )} />
              {multiple && <label className="flex items-center gap-2">{tr("up to", "ដល់")}<Input type="number" min={1} max={20} className="h-8 w-16" {...register(`option_groups.${gIndex}.max`)} data-testid={`option-group-max-${gIndex}`} /></label>}
            </div>
            {gErr?.max && <p className="text-xs text-destructive">{gErr.max.message}</p>}
            <div className="grid grid-cols-12 gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span className="col-span-4">{tr("Option", "ជម្រើស")}</span><span className="col-span-3">ខ្មែរ</span><span className="col-span-2">{tr("Extra price", "តម្លៃបន្ថែម")}</span><span className="col-span-2 text-center">{tr("Available", "មាន")}</span>
            </div>
            <OptionRows control={control} register={register} gIndex={gIndex} errors={gErr} tr={tr} />
            {gErr?.options?.message && <p className="text-xs text-destructive">{gErr.options.message}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function ItemEditor({ open, item, categories, currency, defaultCategory, onClose, onSaved }) {
  const { tr } = useI18n();
  const schema = useMemo(() => makeSchema(currency, tr), [currency, tr]);
  const { register, control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(item, currency, defaultCategory) });

  useEffect(() => {
    if (open) reset(toForm(item, currency, defaultCategory));
  }, [open, item, currency, defaultCategory, reset]);

  const onSubmit = async (values) => {
    try {
      const payload = toPayload(values, currency);
      const { data } = item ? await api.put(`/dashboard/items/${item.id}`, payload) : await api.post("/dashboard/items", payload);
      toast.success(item ? tr("Item saved", "បានរក្សាទុក") : tr("Item added", "បានបន្ថែម"));
      onSaved(data);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-testid="item-editor">
        <DialogHeader>
          <DialogTitle>{item ? tr("Edit menu item", "កែមុខម្ហូប") : tr("New menu item", "មុខម្ហូបថ្មី")}</DialogTitle>
          <DialogDescription>{tr("Prices are in", "តម្លៃជា")} {currency}. {tr("Khmer fields are optional — English is shown when empty.", "វាលខ្មែរជាជម្រើស។")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
            <Controller control={control} name="image_url" render={({ field }) => <ImageUpload value={field.value} onChange={field.onChange} testId="item-image" aspect="aspect-square" />} />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{tr("Category", "ប្រភេទ")}</Label>
                <Controller control={control} name="category_id" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="item-category-select"><SelectValue placeholder={tr("Choose…", "ជ្រើស…")} /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.archived ? ` (${tr("archived", "បានរក្សាទុក")})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                {errors.category_id && <p className="text-xs text-destructive">{errors.category_id.message}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>{tr("Name (English)", "ឈ្មោះ (អង់គ្លេស)")}</Label><Input {...register("name")} data-testid="item-name-input" />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
                <div className="space-y-1.5"><Label>{tr("Name (Khmer)", "ឈ្មោះ (ខ្មែរ)")}</Label><Input {...register("name_km")} data-testid="item-name-km-input" /></div>
              </div>
              <div className="space-y-1.5">
                <Label>{tr("Price", "តម្លៃ")} ({currency})</Label>
                <Input inputMode="decimal" {...register("price")} className="max-w-[160px]" data-testid="item-price-input" />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{tr("Description (English)", "ការពិពណ៌នា (អង់គ្លេស)")}</Label><Textarea rows={3} {...register("description")} data-testid="item-description-input" /></div>
            <div className="space-y-1.5"><Label>{tr("Description (Khmer)", "ការពិពណ៌នា (ខ្មែរ)")}</Label><Textarea rows={3} {...register("description_km")} data-testid="item-description-km-input" /></div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <Controller control={control} name="available" render={({ field }) => <label className="flex items-center gap-2"><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="item-available-switch" />{tr("Available to order", "អាចកុម្ម៉ង់បាន")}</label>} />
            <Controller control={control} name="featured" render={({ field }) => <label className="flex items-center gap-2"><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="item-featured-switch" />{tr("Show in “Popular”", "បង្ហាញក្នុង “ពេញនិយម”")}</label>} />
          </div>
          <OptionGroups control={control} register={register} watch={watch} errors={errors} tr={tr} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="item-cancel-button">{tr("Cancel", "បោះបង់")}</Button>
            <Button type="submit" disabled={isSubmitting} data-testid="item-save-button">{isSubmitting ? tr("Saving…", "កំពុងរក្សាទុក…") : tr("Save item", "រក្សាទុក")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
