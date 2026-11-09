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

function PaymentsSettings() {
  const { tr } = useI18n();
  const { restaurant, reload } = useDash();
  const p = restaurant.settings?.payment || {};
  const [form, setForm] = useState({
    aba_enabled: !!p.aba_enabled,
    aba_merchant_id: p.aba_merchant_id || "",
    aba_api_key: p.aba_api_key || "",
    aba_base_url: p.aba_base_url || "https://checkout-sandbox.payway.com.kh",
    khqr_enabled: !!p.khqr_enabled,
    khqr_bakong_account: p.khqr_bakong_account || "",
    khqr_merchant_name: p.khqr_merchant_name || restaurant.name || "",
    khqr_merchant_city: p.khqr_merchant_city || "Phnom Penh",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("/dashboard/restaurant/settings", {
        ...restaurant.settings,
        payment: form,
      });
      toast.success(tr("Payment settings saved", "បានរក្សាទុកការកំណត់ការទូទាត់"));
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-xl border bg-card p-5" data-testid="settings-payments-form">
      <div className="border-b pb-4">
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <span>💳</span> ABA PayWay Integration
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr("Accept payments via ABA Mobile and ABA PayWay KHQR.", "ទទួលការទូទាត់តាម ABA Mobile និង KHQR PayWay។")}
        </p>
      </div>

      <Row label={tr("Enable ABA PayWay", "បើក ABA PayWay")}>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={form.aba_enabled}
            onChange={(e) => setForm((f) => ({ ...f, aba_enabled: e.target.checked }))}
            className="h-4 w-4 rounded text-primary"
          />
          <span>{tr("Active for customer orders", "ដំណើរការលើការកុម្ម៉ង់របស់ភ្ញៀវ")}</span>
        </label>
      </Row>

      <Row label={tr("Merchant ID", "លេខសម្គាល់អាជីវកម្ម")}>
        <Input
          value={form.aba_merchant_id}
          onChange={(e) => setForm((f) => ({ ...f, aba_merchant_id: e.target.value.trim() }))}
          placeholder="e.g. ec462928"
          className="max-w-md"
        />
      </Row>

      <Row label={tr("API Key", "សោ API")}>
        <Input
          type="password"
          value={form.aba_api_key}
          onChange={(e) => setForm((f) => ({ ...f, aba_api_key: e.target.value.trim() }))}
          placeholder="ABA PayWay API Key"
          className="max-w-md"
        />
      </Row>

      <Row label={tr("Environment", "បរិស្ថាន")}>
        <select
          value={form.aba_base_url}
          onChange={(e) => setForm((f) => ({ ...f, aba_base_url: e.target.value }))}
          className="h-10 rounded-md border bg-card px-3 text-sm max-w-md"
        >
          <option value="https://checkout-sandbox.payway.com.kh">Sandbox (Testing)</option>
          <option value="https://checkout.payway.com.kh">Production (Live)</option>
        </select>
      </Row>

      <div className="border-t border-b py-4">
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <span>🏦</span> Bakong KHQR (All Banks)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr("Standard EMV KHQR accepted by all Cambodian banking and wallet apps.", "កូដ KHQR ស្តង់ដារ EMV គាំទ្រគ្រប់ធនាគារនៅកម្ពុជា។")}
        </p>
      </div>

      <Row label={tr("Enable Bakong KHQR", "បើក Bakong KHQR")}>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={form.khqr_enabled}
            onChange={(e) => setForm((f) => ({ ...f, khqr_enabled: e.target.checked }))}
            className="h-4 w-4 rounded text-primary"
          />
          <span>{tr("Active for customer orders", "ដំណើរការលើការកុម្ម៉ង់របស់ភ្ញៀវ")}</span>
        </label>
      </Row>

      <Row label={tr("Bakong Account ID", "គណនី Bakong")}>
        <Input
          value={form.khqr_bakong_account}
          onChange={(e) => setForm((f) => ({ ...f, khqr_bakong_account: e.target.value.trim() }))}
          placeholder="e.g. your_name@bkrt"
          className="max-w-md"
        />
      </Row>

      <Row label={tr("Merchant Name", "ឈ្មោះអាជីវកម្ម")}>
        <Input
          value={form.khqr_merchant_name}
          maxLength={25}
          onChange={(e) => setForm((f) => ({ ...f, khqr_merchant_name: e.target.value }))}
          placeholder="Tok Menu"
          className="max-w-md"
        />
      </Row>

      <Row label={tr("City", "ទីក្រុង")}>
        <Input
          value={form.khqr_merchant_city}
          maxLength={15}
          onChange={(e) => setForm((f) => ({ ...f, khqr_merchant_city: e.target.value }))}
          placeholder="Phnom Penh"
          className="max-w-md"
        />
      </Row>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? tr("Saving…", "កំពុងរក្សាទុក…") : tr("Save payment settings", "រក្សាទុកការកំណត់ការទូទាត់")}
        </Button>
      </div>
    </form>
  );
}

function TelegramSettings() {
  const { tr } = useI18n();
  const { restaurant, reload } = useDash();
  const tg = restaurant.settings?.telegram || {};
  const [form, setForm] = useState({
    enabled: tg.enabled !== false,
    bot_token: tg.bot_token || "",
    chat_id: tg.chat_id || "",
  });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("/dashboard/restaurant/settings", {
        ...restaurant.settings,
        telegram: form,
      });
      toast.success(tr("Telegram settings saved", "បានរក្សាទុកការកំណត់ Telegram"));
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const testAlert = async () => {
    if (!form.bot_token || !form.chat_id) {
      return toast.error(tr("Enter Bot Token and Chat ID first", "សូមបញ្ចូល Bot Token និង Chat ID ជាមុនសិន"));
    }
    setTesting(true);
    try {
      await api.post("/dashboard/restaurant/telegram/test", {
        bot_token: form.bot_token,
        chat_id: form.chat_id,
      });
      toast.success(tr("Test message sent! Check your Telegram.", "បានផ្ញើសារសាកល្បង! សូមពិនិត្យ Telegram របស់អ្នក។"));
    } catch (err) {
      toast.error(errorMessage(err) || tr("Failed to send test message", "មិនអាចផ្ញើសារសាកល្បងបានទេ"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-xl border bg-card p-5" data-testid="settings-telegram-form">
      <div>
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <span>📱</span> {tr("Telegram Instant Order Alerts", "ការជូនដំណឹងការកុម្ម៉ង់តាម Telegram")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr("Receive sound alerts and order details in your Telegram group or channel immediately when a guest orders.", "ទទួលបានការជូនដំណឹងភ្លាមៗនៅពេលមានភ្ញៀវកុម្ម៉ង់។")}
        </p>
      </div>

      <Row label={tr("Telegram alerts", "ការជូនដំណឹង Telegram")}>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            className="h-4 w-4 rounded text-primary"
          />
          <span>{tr("Send notifications for new orders", "ផ្ញើការជូនដំណឹងពេលមានការកុម្ម៉ង់ថ្មី")}</span>
        </label>
      </Row>

      <Row label={tr("Bot Token", "សោ Bot")} hint={tr("Create a bot on Telegram via @BotFather to get your token.", "បង្កើត bot តាម @BotFather")}>
        <Input
          type="password"
          value={form.bot_token}
          onChange={(e) => setForm((f) => ({ ...f, bot_token: e.target.value.trim() }))}
          placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
          className="max-w-md font-mono text-xs"
        />
      </Row>

      <Row label={tr("Chat ID", "លេខសម្គាល់ Chat ID")} hint={tr("Your personal chat ID, group chat ID, or channel ID.", "លេខសម្គាល់ Group ឬ Chat ID")}>
        <div className="flex gap-2 max-w-md">
          <Input
            value={form.chat_id}
            onChange={(e) => setForm((f) => ({ ...f, chat_id: e.target.value.trim() }))}
            placeholder="e.g. 1305665251 or -1001234567890"
            className="font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={testAlert} disabled={testing || !form.bot_token || !form.chat_id}>
            {testing ? tr("Sending…", "កំពុងផ្ញើ…") : tr("Test Alert", "សាកល្បង")}
          </Button>
        </div>
      </Row>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? tr("Saving…", "កំពុងរក្សាទុក…") : tr("Save Telegram settings", "រក្សាទុកការកំណត់")}
        </Button>
      </div>
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
          <TabsTrigger value="payments" data-testid="settings-tab-payments">{tr("Payments (ABA / KHQR)", "ការទូទាត់ប្រាក់")}</TabsTrigger>
          <TabsTrigger value="telegram" data-testid="settings-tab-telegram">{tr("Telegram Alerts", "ការជូនដំណឹង Telegram")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileSettings /></TabsContent>
        <TabsContent value="ordering"><OrderingSettings Row={Row} /></TabsContent>
        <TabsContent value="payments"><PaymentsSettings /></TabsContent>
        <TabsContent value="telegram"><TelegramSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
