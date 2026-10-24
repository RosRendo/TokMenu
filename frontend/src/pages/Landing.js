import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Bell, Languages, Printer, QrCode, Smartphone, ToggleRight, Wallet } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PricingCards } from "@/components/PricingCards";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { DashboardPreview, SampleMenu } from "@/components/landing/Showcase";
import { useI18n } from "@/lib/i18n";

const STEPS = [
  [QrCode, "Print a QR code for each table", "បោះពុម្ពកូដ QR សម្រាប់តុនីមួយៗ", "Add your dishes with photos and prices, then print cards for every table in a few minutes.", "បញ្ចូលមុខម្ហូប រូបភាព និងតម្លៃ រួចបោះពុម្ពកាតសម្រាប់គ្រប់តុក្នុងរយៈពេលប៉ុន្មាននាទី។"],
  [Smartphone, "Guests scan and order", "ភ្ញៀវស្កេន ហើយកុម្ម៉ង់", "The menu opens in the phone's browser in Khmer or English. No app, no account.", "ម៉ឺនុយបើកក្នុងកម្មវិធីរុករកជាភាសាខ្មែរ ឬអង់គ្លេស។ មិនត្រូវការកម្មវិធី ឬគណនីទេ។"],
  [Bell, "Your team gets it instantly", "ក្រុមរបស់អ្នកទទួលភ្លាមៗ", "Orders appear on the live board with the table number. Accept, cook, serve, get paid at the counter.", "ការកុម្ម៉ង់បង្ហាញលើផ្ទាំងផ្ទាល់ជាមួយលេខតុ។ ទទួល ចម្អិន បម្រើ ហើយទទួលប្រាក់នៅបញ្ជរ។"],
];

const BENEFITS = [
  [Languages, "Khmer & English menus", "ម៉ឺនុយខ្មែរ និងអង់គ្លេស", "Write each dish in both languages. Guests switch with one tap."],
  [ToggleRight, "Sold out? One switch.", "អស់ហើយ? ចុចតែម្ដង", "Mark items unavailable during service without deleting them."],
  [Wallet, "No payment setup needed", "មិនចាំបាច់រៀបចំការបង់ប្រាក់", "Guests pay at the counter or table, like today. You mark orders paid."],
  [Printer, "Printable QR cards", "កាត QR សម្រាប់បោះពុម្ព", "A4 sheets with your name and table label, ready to laminate."],
  [BarChart3, "See what sells", "ដឹងថាអ្វីលក់ដាច់", "Daily orders, completed sales and best-selling dishes."],
  [Smartphone, "Fast on budget phones", "លឿនលើទូរស័ព្ទតម្លៃថោក", "A light menu page that loads quickly on 4G and older Android phones."],
];

const FAQ = [
  ["Do my customers need to download an app?", "តើអតិថិជនត្រូវទាញយកកម្មវិធីទេ?", "No. They scan the QR code with their phone camera and the menu opens in the browser. No account is needed to order.", "ទេ។ ពួកគេស្កេនកូដ QR ដោយកាមេរ៉ាទូរស័ព្ទ ហើយម៉ឺនុយបើកក្នុងកម្មវិធីរុករក។ មិនត្រូវការគណនីទេ។"],
  ["How do customers pay?", "តើអតិថិជនបង់ប្រាក់ដោយរបៀបណា?", "At the counter or at the table, the way they pay today. Tok Menu does not process payments yet; staff record payments by hand. Online payment (such as KHQR) is planned once an approved provider is connected.", "នៅបញ្ជរ ឬនៅតុ ដូចសព្វថ្ងៃ។ Tok Menu មិនទាន់ដំណើរការការបង់ប្រាក់ទេ។ បុគ្គលិកកត់ត្រាការបង់ប្រាក់ដោយដៃ។"],
  ["Can I use riel instead of dollars?", "តើខ្ញុំអាចប្រើប្រាក់រៀលបានទេ?", "Yes. Each restaurant chooses USD or KHR. Prices are shown in the currency you choose.", "បាន។ ភោជនីយដ្ឋាននីមួយៗជ្រើស USD ឬ KHR។"],
  ["What happens when a dish runs out?", "បើមុខម្ហូបអស់ តើធ្វើដូចម្ដេច?", "Switch it to unavailable from the dashboard. It stays on the menu, greyed out, and can't be ordered until you switch it back.", "បិទវាពីផ្ទាំងគ្រប់គ្រង។ វានៅលើម៉ឺនុយជាពណ៌ប្រផេះ ហើយមិនអាចកុម្ម៉ង់បានទេ។"],
  ["Can my staff use it on their own phones?", "តើបុគ្គលិកអាចប្រើលើទូរស័ព្ទខ្លួនឯងបានទេ?", "Yes. Invite staff by email on the Starter or Pro plan. They only see orders (and item availability if you allow it) — not your reports or settings.", "បាន។ អញ្ជើញបុគ្គលិកតាមអ៊ីមែល។ ពួកគេឃើញតែការកុម្ម៉ង់ប៉ុណ្ណោះ។"],
  ["What if the internet drops?", "បើអ៊ីនធឺណិតដាច់?", "The order board reconnects automatically and refreshes every few seconds until the live connection returns. Customers can retry an order without it being sent twice.", "ផ្ទាំងកុម្ម៉ង់ភ្ជាប់ឡើងវិញដោយស្វ័យប្រវត្តិ។ អតិថិជនអាចព្យាយាមម្ដងទៀតដោយមិនផ្ញើពីរដង។"],
];

export default function Landing() {
  const { tr } = useI18n();
  return (
    <div className="bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-12 lg:pt-16">
          <div className="lg:col-span-7 fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />{tr("For restaurants & cafés in Cambodia", "សម្រាប់ភោជនីយដ្ឋាន និងហាងកាហ្វេនៅកម្ពុជា")}
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl" data-testid="hero-title">
              {tr("Scan. Browse. Order.", "ស្កេន។ មើល។ កុម្ម៉ង់។")}
              <span className="mt-2 block text-primary">{tr("Right from the table.", "ពីតុរបស់ភ្ញៀវ។")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {tr("Tok Menu turns your menu into a QR code on every table. Guests order from their phone in Khmer or English, and your team sees every order instantly — no app, no payment terminal.",
                "Tok Menu ប្ដូរម៉ឺនុយរបស់អ្នកទៅជាកូដ QR នៅលើតុនីមួយៗ។ ភ្ញៀវកុម្ម៉ង់ពីទូរស័ព្ទជាភាសាខ្មែរ ឬអង់គ្លេស ហើយក្រុមរបស់អ្នកឃើញការកុម្ម៉ង់ភ្លាមៗ។")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6" data-testid="hero-register-button"><Link to="/register">{tr("Start free 14-day trial", "សាកល្បងឥតគិតថ្លៃ ១៤ ថ្ងៃ")}<ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full bg-card px-6" data-testid="hero-demo-button"><Link to="/menu/demo">{tr("Try the demo menu", "សាកល្បងម៉ឺនុយគំរូ")}</Link></Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li>✓ {tr("No app for guests", "ភ្ញៀវមិនត្រូវការកម្មវិធី")}</li>
              <li>✓ {tr("USD or riel", "ដុល្លារ ឬរៀល")}</li>
              <li>✓ {tr("Pay at the counter", "បង់នៅបញ្ជរ")}</li>
            </ul>
          </div>
          <div className="relative lg:col-span-5">
            <img src="/demo/amok.jpg" alt={tr("Fish amok served in a banana leaf", "អាម៉ុកត្រី")} className="aspect-[4/5] w-full rounded-3xl object-cover" />
            <div className="absolute -bottom-6 left-4 right-4 flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.4)] sm:left-auto sm:right-[-12px] sm:w-72">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground"><QrCode className="h-6 w-6" /></span>
              <div className="text-sm">
                <p className="font-semibold">{tr("Table 4 · new order", "តុ ៤ · កុម្ម៉ង់ថ្មី")}</p>
                <p className="text-muted-foreground">{tr("2 × Fish Amok, 2 × Iced Coffee", "អាម៉ុកត្រី ២, កាហ្វេទឹកកក ២")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-secondary/60">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{tr("Live sample menu", "ម៉ឺនុយគំរូផ្ទាល់")}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{tr("This is what your guests see.", "នេះជាអ្វីដែលភ្ញៀវរបស់អ្នកឃើញ។")}</h2>
              <p className="mt-4 max-w-md text-muted-foreground">{tr("The phone on the right runs the real demo restaurant menu. Tap a category, add a dish, switch to Khmer from the top of this page.", "ទូរស័ព្ទនៅខាងស្ដាំកំពុងបង្ហាញម៉ឺនុយភោជនីយដ្ឋានគំរូពិតប្រាកដ។ ចុចប្រភេទ ឬបន្ថែមមុខម្ហូប។")}</p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex gap-3"><span className="font-display font-bold text-primary">01</span>{tr("Photo-led dishes with clear prices and options", "មុខម្ហូបមានរូបភាព តម្លៃច្បាស់ និងជម្រើស")}</li>
                <li className="flex gap-3"><span className="font-display font-bold text-primary">02</span>{tr("Sold-out items stay visible but can't be ordered", "មុខម្ហូបដែលអស់នៅតែឃើញ ប៉ុន្តែមិនអាចកុម្ម៉ង់")}</li>
                <li className="flex gap-3"><span className="font-display font-bold text-primary">03</span>{tr("A cart bar that stays within thumb reach", "របារកន្ត្រកនៅក្បែរមេដៃ")}</li>
              </ul>
              <Button asChild variant="outline" className="mt-8 rounded-full bg-card" data-testid="sample-open-full-demo"><Link to="/menu/demo">{tr("Open the full demo menu", "បើកម៉ឺនុយគំរូពេញលេញ")}<ArrowRight /></Link></Button>
            </div>
            <SampleMenu />
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="max-w-xl text-3xl font-bold sm:text-4xl">{tr("Up and running before tonight's dinner service.", "អាចប្រើបានមុនពេលបម្រើអាហារពេលល្ងាចនេះ។")}</h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-12">
            <ol className="space-y-8 lg:col-span-7">
              {STEPS.map(([Icon, en, km, den, dkm], i) => (
                <li key={en} className="flex gap-5" data-testid={`how-step-${i + 1}`}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-card"><Icon className="h-5 w-5 text-primary" /></span>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{tr("Step", "ជំហាន")} {i + 1}</p>
                    <h3 className="mt-1 text-lg font-semibold">{tr(en, km)}</h3>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">{tr(den, dkm)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <img src="/demo/qrtable.jpg" alt={tr("Guest scanning a QR code at a table", "ភ្ញៀវកំពុងស្កេនកូដ QR")} loading="lazy" className="h-full max-h-[420px] w-full rounded-3xl object-cover lg:col-span-5" />
          </div>
        </section>

        <section className="border-t bg-card">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-3xl font-bold sm:text-4xl lg:sticky lg:top-24">{tr("Built for small teams on busy nights.", "បង្កើតសម្រាប់ក្រុមតូចៗ ក្នុងយប់មមាញឹក។")}</h2>
            </div>
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-8">
              {BENEFITS.map(([Icon, en, km, desc]) => (
                <div key={en}>
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-semibold">{tr(en, km)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{tr("Restaurant dashboard", "ផ្ទាំងគ្រប់គ្រង")}</p>
              <h2 className="mt-3 text-3xl font-bold">{tr("One board for every order.", "ផ្ទាំងតែមួយសម្រាប់គ្រប់ការកុម្ម៉ង់។")}</h2>
              <p className="mt-4 text-sm text-muted-foreground">{tr("New orders arrive with a sound you control. Move them from accepted to ready with one tap — guests see the update on their phone.", "ការកុម្ម៉ង់ថ្មីមកដល់ជាមួយសំឡេង។ ចុចតែម្ដងដើម្បីប្ដូរស្ថានភាព — ភ្ញៀវឃើញលើទូរស័ព្ទ។")}</p>
            </div>
            <div className="lg:col-span-8"><DashboardPreview /></div>
          </div>
        </section>

        <section id="pricing" className="border-t bg-secondary/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold sm:text-4xl">{tr("Simple plans. Start free.", "គម្រោងសាមញ្ញ។ ចាប់ផ្ដើមឥតគិតថ្លៃ។")}</h2>
            <div className="mt-10"><PricingCards /></div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold">{tr("Questions owners ask", "សំណួរដែលម្ចាស់ហាងសួរ")}</h2>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ.map(([q, qkm, a, akm], i) => (
              <AccordionItem key={q} value={`q${i}`}>
                <AccordionTrigger className="text-left font-display text-base" data-testid={`faq-trigger-${i}`}>{tr(q, qkm)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{tr(a, akm)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="bg-charcoal text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold">{tr("Put your menu on every table this week.", "ដាក់ម៉ឺនុយរបស់អ្នកនៅលើតុនីមួយៗក្នុងសប្ដាហ៍នេះ។")}</h2>
              <p className="mt-2 text-white/70">{tr("Free for 14 days. No card. Cancel by simply not upgrading.", "ឥតគិតថ្លៃ ១៤ ថ្ងៃ។ មិនត្រូវការកាត។")}</p>
            </div>
            <Button asChild size="lg" className="h-12 rounded-full px-6" data-testid="cta-register-button"><Link to="/register">{tr("Create your restaurant", "បង្កើតភោជនីយដ្ឋានរបស់អ្នក")}<ArrowRight /></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
