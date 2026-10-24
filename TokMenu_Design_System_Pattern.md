# Tok Menu — Design System & UI/UX Patterns

> **Project Reference**: Tok Menu (QR Menu & Table Ordering Platform for Cambodian Restaurants)  
> **Aesthetic Profile**: Warm Modern Minimalist, Bilingual Khmer/English, High-Contrast Mobile-First

---

## 1. Brand Identity & Visual Language

Tok Menu is designed around Cambodian café and dining culture. The identity blends local cultural authenticity with international digital product polish.

- **Name Concept**: **"Tok"** (តុ) is the Khmer word for **Table**.
- **Brand Mark**: A terracotta square tile displaying the Khmer character **"តុ"** in white bold display type.
- **Atmosphere**: Warm, welcoming, uncluttered, utilitarian, and fast on budget devices under bright sunlight.

---

## 2. Color Palette & Semantic Tokens

The palette pairs an earthy Cambodian terracotta with warm organic neutrals and crisp operational colors.

### Core Swatches

| Role | Color Name | Hex | HSL / CSS Var | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand** | Terracotta | `#D35400` | `24 100% 36%` | CTA buttons, active accents, brand logo |
| **Brand Dark** | Terracotta Dark | `#B94A00` | `24 100% 28%` | Button active/hover states |
| **Brand Soft** | Terracotta Tint | `#FBEEE4` | `26 70% 95%` | Subtle badges, tag backgrounds |
| **Surface Primary** | Warm White Paper | `#FAFAF8` | `60 14% 98%` | Page background, cards |
| **Surface Secondary**| Soft Sand Neutral | `#F3F3F0` | `60 8% 95%` | Section bands, category headers |
| **Surface Shell** | Backdrop Gray | `#EEEDE8` | — | Mobile wrapper backdrop |
| **Text Primary** | Deep Charcoal | `#1C1C1C` | `0 0% 11%` | Headings, food titles, cart bar |
| **Text Secondary** | Muted Slate | `#525252` | `0 0% 34%` | Descriptions, captions, helper text |
| **Text Tertiary** | Stone Light | `#8A8A8A` | — | Footnotes, timestamps |
| **Border** | Subtle Outline | `#E7E7E2` | `45 9% 89%` | 1px clean separators and cards |

### Kitchen Status Tokens (Kanban & Badges)

| Status | Color | Purpose |
| :--- | :--- | :--- |
| **Pending / New** | `#3B82F6` (Sky Blue) | Flashes with `@keyframes pulseRing` + sound alert |
| **Accepted** | `#8B5CF6` (Violet) | Order acknowledged by kitchen |
| **Preparing** | `#F59E0B` (Amber) | Dish is cooking / drinks are blending |
| **Ready** | `#10B981` (Emerald) | Ready to be served to the table |
| **Completed / Paid**| `#10B981` (Emerald) | Cash settled at counter/table |
| **Rejected / Cancel**| `#EF4444` (Ruby) | Out of stock or kitchen closing reason |

---

## 3. Bilingual Typography System (Khmer + English)

Khmer script has complex ascenders, descenders, and stacked subscript consonants (*chheung*). Standard Western line-heights will clip Khmer characters. This design pattern solves it with CSS font switching:

### Font Families
- **Display / Headings**: `"Kantumruy Pro", "Noto Sans Khmer", sans-serif`
  - High aesthetic balance, contemporary curves, excellent legibility in headlines.
- **Body / Interface**: `"Inter", "Noto Sans Khmer", sans-serif`
  - Crisp readability in small menu descriptions, option groups, and tables.

### Typographic Rules for Khmer
```css
/* English baseline */
body {
  font-family: Inter, sans-serif;
  line-height: 1.55;
}
h1, h2, h3, h4 {
  font-family: "Kantumruy Pro", sans-serif;
  letter-spacing: -0.01em;
}

/* Khmer locale adjustments */
html[lang="km"] body {
  font-family: "Kantumruy Pro", "Noto Sans Khmer", Inter, sans-serif;
  line-height: 1.75; /* Prevents subscript clipping */
}
html[lang="km"] h1, html[lang="km"] h2, html[lang="km"] h3 {
  letter-spacing: 0; /* Never negative-track Khmer letters */
  line-height: 1.45;
}

/* Numbers in receipts, prices and order codes */
.tabular {
  font-variant-numeric: tabular-nums;
}
```

---

## 4. Key Page Layout Patterns

### A. Mobile Customer Menu (`/menu/:slug`)
- **Centered Mobile Shell**: `max-w-md mx-auto min-h-screen bg-background` centered inside an outer canvas (`#EEEDE8`). Mimics a native mobile app on desktop and fills viewport on phones.
- **Restaurant Header**: Cover photo + circular logo badge + dual language toggle (EN / ភាសាខ្មែរ) + open/closed badge.
- **Sticky Category Carousel**:
  - Horizontal swipe with hidden scrollbars (`.no-scrollbar`).
  - Active category highlighted with soft pill background.
  - Linked via `IntersectionObserver` ScrollSpy to auto-scroll tabs as user scrolls dishes.
- **Food Cards**:
  - High-appeal food imagery with rounded corners (`rounded-xl` or `rounded-2xl`).
  - Dual-language dish names with primary language prominent and secondary translation below.
  - Clear pricing formatted in USD (`$3.50`) or Khmer Riel (`14,000៛`).
  - Sold-out items: Grayscale filter + opacity `0.6` + "Sold Out / អស់ហើយ" badge.
- **Thumb-Zone Bottom Cart Bar**:
  - Fixed floating pill at bottom of viewport: `fixed inset-x-0 bottom-0 z-40 px-4 pb-safe`.
  - Dark Charcoal `#1C1C1C` contrast block.
  - Left: Shopping bag icon + item count.
  - Right: "View cart" + tabular sum with chevron.

### B. Customization Sheet (Item Detail Drawer)
- Slides smoothly from bottom using drawer/sheet physics.
- High-res dish banner + description in active language.
- Modifier groups:
  - Radio pills for single-choice (e.g. Size: Regular / Large +$0.50).
  - Checkboxes for add-ons (e.g. Extra egg, Extra rice).
- Live recalculating price at bottom.
- Quantity selector (`- 1 +`) + Special instructions textarea.
- Big full-width Terracotta CTA button: `Add to Cart — $4.00`.

### C. Live Kitchen Order Board (`/dashboard/orders`)
- **4-Column Kanban**: New Orders → Accepted → Preparing → Ready.
- **Top Live Indicator**: Real-time status pill (Green "Live" with Wi-Fi icon, Amber "Reconnecting" if offline).
- **Sound Alert Toggle**: Bell icon toggle button to play pleasant kitchen chime when new orders drop.
- **Order Ticket Cards**:
  - Prominent Table Badge (`Table 4`).
  - Big 3-digit order sequence number (`#007`).
  - Elapsed time tracker (`3m ago`).
  - Bulleted dish checklist with customized options in bold.
  - One-tap next action button ("Accept", "Start preparing", "Mark ready").
  - Dropdown for quick reject reasons ("Sold out", "Kitchen closing", "Duplicate").
  - Independent payment toggle ("Mark Paid (Cash)").

### D. Printable QR Cards (`/dashboard/qr-codes`)
- **Print Optimization**: Configured with `@media print` for standard A4 paper:
  - Generates 4 cards per sheet (2x2 grid).
  - Dashed cutting guides (`border: 1px dashed #999`).
  - Clean card design with restaurant name, Khmer name, table number pill, crisp vector QR, and clear call-to-action: *"Scan to see menu & order · Pay at counter"*.

### E. Restaurant Management Dashboard (`/dashboard`)
- **Clean Tool Aesthetic**: Uncluttered, flat, 1px bordered cards. No distracting glassmorphism or consumer app glitter.
- **Fixed Sidebar**: 240px wide sidebar with grouped navigation icons (`Overview`, `Orders`, `Menu`, `Categories`, `Tables`, `QR codes`, `Analytics`, `Staff`, `Settings`, `Billing`).
- **Data Tables**: Flat tables with tabular numerical alignment and quick action buttons.

---

## 5. Micro-Interactions & Motion Guidelines

- **Restrained Motion**: No heavy transitions that slow down an order on budget 3G/4G connections.
- **Feedback on Tap**: Active scale micro-animation: `active:scale-[0.99]`.
- **New Order Pulse**: `@keyframes pulseRing` with 3 gentle pulses on new orders.
- **Page Entrance**: Subtle vertical translation (`fade-up`: `translateY(8px)` to `0`).
- **Accessibility**: All animations disabled automatically when `prefers-reduced-motion` is detected.

---

## 6. How to Replicate This Pattern in Future Projects

1. **Copy the Color Variables**: Use `--primary: 24 100% 36%` (Terracotta) + `--background: 60 14% 98%` (Warm Paper).
2. **Include Google Fonts**: Add `Kantumruy Pro` and `Inter` in `index.html`.
3. **Use the Mobile-Shell Pattern**: Encapsulate customer-facing views in `max-w-md mx-auto` with a floating bottom action bar.
4. **Implement Dual-Language Fallbacks**: Always store items as `{ name, name_km, description, description_km }` and fall back gracefully if Khmer text is missing.
5. **Keep Kitchen Dashboards Flat & Utilitarian**: High-contrast, large touch targets, color-coded status columns, and audio alerts.
