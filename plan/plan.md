# Tok Menu — QR Menu & Table Ordering for Cambodian Restaurants

A multi-restaurant web platform: each restaurant builds a bilingual Khmer/English digital menu, prints a QR code for each table, and gets dine-in orders on a live dashboard.
Customers scan, browse, and order from their phone. They don't need an app, an account, or online payment, and they pay at the counter or table.

## Who it's for

- **Restaurant owners** (small cafés and restaurants in Cambodia, not technical) who set up the menu, tables, staff and settings.
- **Restaurant staff** who handle incoming orders during service.
- **Customers** at the table, mostly on budget Android phones.
- **Platform administrator** (the SaaS operator), who manages restaurants, plans and support requests.

## Core features and experience

**Public site**
- Landing page with these sections: hero (scan → browse → order), a working sample menu built from the labelled demo restaurant, how it works in 3 steps, owner benefits, dashboard preview, pricing, FAQ, and a final call to action.
- Pricing page that compares Free Trial, Starter and Pro. Prices are marked as example prices.
- Login, register, forgot password and reset password. Reset links are sent by email.

**Customer menu (mobile-first, opened from a QR code)**
- Header with logo, cover image, restaurant name, open/closed status, Khmer/English switch and search.
- Category tabs that scroll sideways, a featured items row, and food cards led by photos. Each card shows name, description, price and availability. Unavailable items appear greyed out and can't be added.
- An item sheet with photo, options (for example a required size choice or optional add-ons with extra prices), quantity and a special-instructions box.
- A cart summary bar stays visible while the cart has items. The cart page lets customers edit quantities and shows chosen options, subtotal, any configured service charge or tax, and the table label.
- Placing an order is protected against double taps and retries. Error messages say clearly what went wrong, for example "this item just became unavailable".
- The confirmation page shows the order code, items, total and live status (Pending → Accepted → Preparing → Ready → Completed, or Rejected with an optional reason). It also says "Pay at counter / table". Customers can reopen it from the same phone, and only the order link gives access.
- Item and category names and descriptions appear in the customer's chosen language. If no Khmer text was entered, English is shown.

**Restaurant dashboard (owner and staff)**
- **Overview:** orders today, completed orders, sales total from completed orders, pending orders needing attention, recent orders, and quick actions ("Add menu item", "Print QR codes"). A setup checklist guides new owners.
- **Orders:** a live board with New, Accepted, Preparing and Ready columns. Each order shows its short daily number, table, items, options, notes and total. Action buttons are Accept, Reject, Start Preparing, Ready and Completed, and each shows a loading state and handles failure. Changes made in another session appear on the board. If the live connection drops, the board falls back to automatic refresh. An "Enable sound" button turns on new-order alerts. Payment is tracked separately: staff mark an order "Paid (cash/counter)" by hand, and submitting an order never marks it paid. Order history can be searched and filtered.
- **Menu:** owners can create, edit, duplicate, reorder, archive and restore items. Each item has a photo upload with preview, Khmer and English names and descriptions, a price, availability, a featured flag, and option groups with prices. Forms are checked before saving, empty states explain what to do, and destructive actions ask for confirmation.
- **Categories:** owners can create, rename (in both languages), reorder and archive categories.
- **Tables & QR codes:** each table gets a label and its own unguessable QR link. Owners can download a single QR as an image and print QR cards showing the restaurant name, table label and QR code, several per A4 page. There is also a restaurant-wide menu QR for counters or flyers that isn't linked to a table, and table QR links can be regenerated.
- **Analytics:** daily and weekly order counts, gross sales from completed orders, best-selling items, a status breakdown, and date filters (today, 7 days, 30 days, custom). Labels keep these apart: gross order value, payments recorded by hand, and the fact that no discounts or refunds exist yet. Pro adds an hourly breakdown and CSV export.
- **Staff:** owners invite staff by email, staff set their own password through the invite link, and owners can remove staff. A per-staff switch controls whether they may change item availability.
- **Settings:** name, link name (slug), logo, cover image, description, phone, address, social links, opening hours, a "temporarily closed" switch, currency (USD or KHR), optional service charge and tax percentages, and default menu language.
- **Billing:** shows the current plan, status, renewal or trial end date, and usage against limits. A "Request upgrade" button sends a request to the platform admin. No card is collected and nothing is charged.

**Platform admin**
- Restaurant list with search, status, plan and usage. Admins can suspend or reactivate a restaurant, and both actions are recorded in the audit log.
- Subscriptions: set each restaurant's plan, status and end date by hand.
- Platform usage: restaurants, active restaurants, and orders over the last 30 days.
- Support requests: owners send them from the dashboard, and the admin views, replies with a note, and marks them resolved.

**Trust and safety (visible effects)**
- Each restaurant only ever sees its own data, and staff only see the restaurant they belong to. Every check runs on the server.
- Prices and totals are always calculated by the server from the menu. Past orders keep the item names, options and prices they were placed with, even if the menu changes later.
- Login attempts and order submissions are rate-limited. Image uploads are checked for type and size. Public error messages stay generic. Important admin and owner actions are recorded in an audit log.

## User flow

1. **Owner:** registers, names the restaurant (the menu link is created automatically), follows the setup checklist (profile → categories → items with photos → tables), prints the QR cards, and opens the Orders board.
2. **Customer:** scans the table QR, the menu opens with the table already recognised, they choose items and options, review the cart, place the order, and see the order code and live status.
3. **Staff:** a new order arrives on the board with an optional sound. Staff accept or reject it, then move it through Preparing → Ready → Completed, and mark it paid when the customer pays.
4. **Customer:** the status page updates on its own as staff move the order along.
5. **Admin:** reviews new restaurants, sets plans, suspends or reactivates restaurants, and answers support requests.

## UI/UX feel

- Warm off-white background, dark charcoal text, and one restrained terracotta accent used for actions and status highlights.
- Large food photos on the customer menu, generous spacing, soft borders and shadows, and consistent rounded corners. Animation is kept minimal so it never slows ordering down.
- The customer menu is light and fast on budget phones, with large tap targets and a one-handed cart bar.
- The dashboard is a plain working tool: side navigation, dense but readable order cards, clear status colours, and no decorative card walls.
- Khmer-friendly fonts throughout, with layouts sized for longer Khmer text. Contrast is accessible and focus outlines are visible.

## Implementation phases

**Phase 1 — MVP (built now): the full brief**
Everything listed above: public site and pricing, owner/staff/admin accounts, password reset and staff invites by email, restaurant setup, bilingual menu with photos and options, tables and printable QR codes, customer cart and ordering, live order board with refresh fallback, customer order tracking, manual payment marking, analytics, staff permissions, manual subscription plans with limits, admin console, support requests, audit log, labelled demo restaurant, and written guides for setup, backups and restore, deployment, custom domain, smoke-testing and rollback. The phase ends with deployment on HTTPS.

**Phase 2 — Payments and operations**
Online payment through an approved Cambodian provider (ABA PayWay / KHQR), added only once a merchant account is approved and tested. Live subscription billing. Kitchen ticket printing. New-order alerts sent to a Telegram group.

**Phase 3 — Growth**
Multiple branches per owner, takeaway and pre-orders, discounts and promotions (with refunds and net revenue reporting), customer feedback, and optional USD/KHR dual price display.

## Assumptions

- **Stack:** the build uses this platform's stack (React web app, Python API, MongoDB database) instead of Next.js, PostgreSQL/Prisma, Vitest and Playwright. The brief's rules are kept with equivalents: tenant isolation, server-side pricing, an order and its items saved together in one step (all or nothing), duplicate-order protection, the order state machine, migrations-style index setup, and a repeatable seed. Hosting is on this platform, with HTTPS and custom domain support, rather than Vercel.
- **Working name:** "Tok Menu" (តុ, tok = "table" in Khmer). It is a placeholder that can be changed, and it is also the sender name on emails.
- Login uses email and password with secure cookies. Each owner account has one restaurant in the MVP.
- Menu photos, logos and cover images go into the platform's built-in file storage. Accepted formats are JPG, PNG and WebP, up to 5 MB each.
- Password reset and staff invite emails use the platform's managed email service. Reset links expire after 1 hour and invite links after 7 days.
- One currency per restaurant, USD (default, shown as $3.50) or KHR (shown as 12,000៛, no decimals). Switching currency does not convert existing prices, and the owner sees a warning before switching.
- The default timezone is Asia/Phnom_Penh. Opening status, "today" and the analytics days use restaurant time.
- When the restaurant is closed (outside opening hours or switched to temporarily closed), customers can browse but can't place orders.
- Service charge and tax are off by default. When turned on they are percentages shown as separate cart lines.
- Live updates use a direct live connection, with automatic refresh every ~10 seconds when it drops. The sound alert stays off until staff tap "Enable sound".
- Order codes are random 8-character codes, for example K7M4-QX2P. The dashboard also shows a short daily number (#012) to make calling orders easier.
- Customers can't cancel orders themselves. Staff can reject a pending order and give an optional reason.
- Plan limits are adjustable defaults:
  - **Free Trial** (14 days): 1 restaurant, 25 menu items, 5 tables, owner only, basic board.
  - **Starter** ($10/mo, example price): unlimited items, up to 50 tables, 2 staff, order history, basic reports.
  - **Pro** ($20/mo, example price): up to 10 staff, advanced reports with CSV export, brand accent colour, and a priority support label.
- When a trial or subscription expires, the menu stays visible but ordering pauses until the admin renews it. A suspended restaurant's menu shows "temporarily unavailable".
- Staff can see the Orders board, order history and (if allowed) item availability. They can't see analytics, billing, staff, settings or admin pages.
- One platform admin account is created at setup. Its credentials are kept in a private credentials file, not shown publicly.
- Demo content is a clearly labelled demo restaurant with typical Cambodian dishes and drinks (for example Fish Amok, Beef Lok Lak, iced coffee) and stock photos. It powers the landing page sample menu and contains no fake reviews or fake statistics.
- The interface text (buttons, labels, messages) is fully available in Khmer and English on both the customer menu and the dashboard.
