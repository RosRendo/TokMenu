import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/Blocks";
import { ImageUpload } from "@/components/ImageUpload";
import { api, errorMessage, publicOrigin } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useDash } from "./context";
import { OrderingSettings } from "./SettingsOrdering";

function Row({ label, children, hint }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[200px_1fr] sm:gap-6">
      <div><Label>{label}</Label>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>
      <div>{children}</div>
    </div>
  );
}

function ProfileSettings() {
  const { tr } = useI18n();
  const { restaurant, reload } = useDash();
  const [form, setForm] = useState(() => ({
    name: restaurant.name, name_km: restaurant.name_km || "", slug: restaurant.slug,
    description: restaurant.description || "", description_km: restaurant.description_km || "",
    phone: restaurant.phone || "", address: restaurant.address || "",
    social: { facebook: "", instagram: "", telegram: "", tiktok: "", website: "", ...(restaurant.social || {}) },
    logo_url: restaurant.logo_url || null, cover_url: restaurant.cover_url || null,
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setSocial = (k) => (e) => setForm((f) => ({ ...f, social: { ...f.social, [k]: e.target.value } }));
  const slugChanged = form.slug !== restaurant.slug;

  const save = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error(tr("Restaurant name is required", "ត្រូវការឈ្មោះភោជនីយដ្ឋាន"));
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(form.slug)) return toast.error(tr("Menu link: 3–40 lowercase letters, numbers or dashes", "តំណម៉ឺនុយ៖ អក្សរតូច លេខ ឬសញ្ញា -"));
    setBusy(true);
    try {
      await api.put("/dashboard/restaurant", form);
      toast.success(tr("Profile saved", "បានរក្សាទុក"));
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-xl border bg-card p-5" data-testid="settings-profile-form">
      <Row label={tr("Cover photo", "រូបក្រប")} hint={tr("Wide photo shown at the top of your menu.", "រូបធំនៅខាងលើម៉ឺនុយ។")}>
        <div className="max-w-md"><ImageUpload value={form.cover_url} onChange={set("cover_url")} kind="cover" aspect="aspect-[16/7]" testId="settings-cover" /></div>
      </Row>
      <Row label={tr("Logo", "ឡូហ្គោ")}>
        <div className="w-32"><ImageUpload value={form.logo_url} onChange={set("logo_url")} kind="logo" aspect="aspect-square" testId="settings-logo" /></div>
      </Row>
      <Row label={tr("Name", "ឈ្មោះ")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={form.name} maxLength={80} onChange={set("name")} placeholder="English" data-testid="settings-name" />
          <Input value={form.name_km} maxLength={80} onChange={set("name_km")} placeholder="ខ្មែរ" data-testid="settings-name-km" />
        </div>
      </Row>
      <Row label={tr("Menu link", "តំណម៉ឺនុយ")} hint={tr("Old links keep working after a change.", "តំណចាស់នៅតែដំណើរការ។")}>
        <div className="flex items-center rounded-md border bg-secondary/50 pl-3 text-sm">
          <span className="truncate text-muted-foreground">{publicOrigin()}/menu/</span>
          <Input value={form.slug} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} className="rounded-l-none border-0 border-l bg-card" data-testid="settings-slug" />
        </div>
        {slugChanged && <p className="mt-1 text-xs text-amber-700" data-testid="settings-slug-warning">{tr("Your printed QR codes will redirect to the new link automatically.", "កូដ QR ដែលបានបោះពុម្ពនឹងបញ្ជូនទៅតំណថ្មីដោយស្វ័យប្រវត្តិ។")}</p>}
      </Row>
      <Row label={tr("Description", "ការពិពណ៌នា")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Textarea rows={3} maxLength={600} value={form.description} onChange={set("description")} placeholder="English" data-testid="settings-description" />
          <Textarea rows={3} maxLength={600} value={form.description_km} onChange={set("description_km")} placeholder="ខ្មែរ" data-testid="settings-description-km" />
        </div>
      </Row>
      <Row label={tr("Contact", "ទំនាក់ទំនង")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={form.phone} maxLength={30} onChange={set("phone")} placeholder={tr("Phone", "ទូរស័ព្ទ")} data-testid="settings-phone" />
          <Input value={form.address} maxLength={200} onChange={set("address")} placeholder={tr("Address", "អាសយដ្ឋាន")} data-testid="settings-address" />
        </div>
      </Row>
      <Row label={tr("Social links", "បណ្ដាញសង្គម")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {["facebook", "telegram", "instagram", "tiktok", "website"].map((k) => (
            <Input key={k} value={form.social[k] || ""} maxLength={200} onChange={setSocial(k)} placeholder={k[0].toUpperCase() + k.slice(1)} data-testid={`settings-social-${k}`} />
          ))}
        </div>
      </Row>
      <div className="flex justify-end"><Button type="submit" disabled={busy} data-testid="settings-profile-save">{busy ? tr("Saving…", "កំពុងរក្សាទុក…") : tr("Save profile", "រក្សាទុក")}</Button></div>
    </form>
  );
}

export default function Settings() {
  const { tr } = useI18n();
  return (
    <div className="max-w-4xl">
      <PageHeader title={tr("Settings", "ការកំណត់")} />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile" data-testid="settings-tab-profile">{tr("Profile", "ប្រវត្តិរូប")}</TabsTrigger>
          <TabsTrigger value="ordering" data-testid="settings-tab-ordering">{tr("Ordering & hours", "ការកុម្ម៉ង់ និងម៉ោង")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileSettings /></TabsContent>
        <TabsContent value="ordering"><OrderingSettings Row={Row} /></TabsContent>
      </Tabs>
    </div>
  );
}
