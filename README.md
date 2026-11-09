# 🍽️ TokMenu — Bilingual QR Restaurant Management, Table Ordering & Digital Payment Platform

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688.svg?logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-Document_Store-47A248.svg?logo=mongodb)
![Bakong KHQR](https://img.shields.io/badge/Bakong-KHQR_Integrated-D32F2F)
![ABA PayWay](https://img.shields.io/badge/ABA-PayWay_Integrated-003366)
![Telegram](https://img.shields.io/badge/Telegram-Order_Alerts-26A5E4.svg?logo=telegram)
![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-f69220.svg?logo=pnpm)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**A high-performance contactless dining and restaurant management suite built for Cambodian restaurants, cafés, and bars. Merges branded restaurant landing pages, table-specific digital menus, Bakong KHQR & ABA PayWay checkout, and real-time Telegram kitchen alerts.**

[System Architecture](#-system-architecture) • [Database ERD](#-database-erd) • [Order & Payment Sequence](#-order--payment-lifecycle) • [Quick Start](#-quick-start)

</div>

---

## ⚡ Overview

**TokMenu** solves dining friction for Cambodian hospitality venues. Diners simply scan a physical table QR code to open a beautiful restaurant landing page (`/r/:slug`) with social links, instant contact buttons, and a rich bilingual (Khmer/English) food menu. Diners customize dishes, choose Cash, Bakong KHQR, or ABA PayWay, and kitchen staff receive instant real-time Telegram order tickets.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Diners["📱 Diners & Public Mobile Devices"]
        LandingPage["Restaurant Landing Page<br/>(/r/:slug)"]
        DigitalMenu["Bilingual Interactive Menu<br/>(Cart & Options)"]
        PaymentCheckout["Checkout Modal<br/>(Cash / ABA / KHQR)"]
        LiveStatus["Live Order Status Page<br/>(Real-Time Tracker)"]
        
        LandingPage --> DigitalMenu --> PaymentCheckout --> LiveStatus
    end

    subgraph Staff["🖥️ Staff & Kitchen Terminals"]
        AdminDashboard["Owner Admin Portal<br/>(Menu, Sales, QR Generator)"]
        TelegramAlerts["📱 Kitchen Telegram Group<br/>(Instant Order Tickets)"]
    end

    subgraph BackendAPI["⚡ Backend Core (Python FastAPI)"]
        RouterPublic["Public Router (/public/*)<br/>(Landing, Menu, Orders)"]
        RouterAdmin["Admin Router (/restaurant/*)<br/>(Settings, Catalog, Tables)"]
        PaymentEngine["Payment Service<br/>(Bakong KHQR & ABA HMAC-SHA512)"]
        TelegramService["Telegram Service<br/>(Bot Dispatcher)"]
        
        RouterPublic & RouterAdmin --> PaymentEngine & TelegramService
    end

    subgraph Database["💾 Persistence Layer (MongoDB)"]
        MongoColl[("MongoDB Collections<br/>(restaurants, tables, categories,<br/>items, orders, payments)")]
        
        BackendAPI <--> MongoColl
    end

    Diners <--> RouterPublic
    Staff <--> RouterAdmin
    TelegramService --> TelegramAlerts
```

---

## 📊 Database ERD

```mermaid
erDiagram
    restaurants ||--o{ tables : owns
    restaurants ||--o{ categories : organizes
    categories ||--o{ menu_items : contains
    restaurants ||--o{ orders : receives
    tables ||--o{ orders : placed_at
    orders ||--|{ order_items : includes
    orders ||--o{ payments : settled_by

    restaurants {
        ObjectId id PK
        string slug UK
        string name
        string description
        string phone
        string logo_url
        string facebook_url
        string telegram_url
        string telegram_chat_id
        string aba_merchant_id
        string khqr_bakong_account_id
        boolean is_active
    }

    tables {
        ObjectId id PK
        ObjectId restaurant_id FK
        string table_number
        string qr_token UK
        boolean is_occupied
    }

    categories {
        ObjectId id PK
        ObjectId restaurant_id FK
        string name_en
        string name_kh
        int sort_order
    }

    menu_items {
        ObjectId id PK
        ObjectId restaurant_id FK
        ObjectId category_id FK
        string name_en
        string name_kh
        decimal price
        string image_url
        boolean is_available
    }

    orders {
        ObjectId id PK
        ObjectId restaurant_id FK
        ObjectId table_id FK
        string order_code UK
        decimal total_amount
        string payment_method "CASH | ABA | KHQR"
        string payment_status "PENDING | PAID | FAILED"
        string order_status "PENDING | PREPARING | READY | COMPLETED"
        datetime created_at
    }

    order_items {
        ObjectId id PK
        ObjectId order_id FK
        ObjectId item_id FK
        string item_name
        int quantity
        decimal unit_price
        string notes
    }

    payments {
        ObjectId id PK
        ObjectId order_id FK
        decimal amount
        string currency "USD | KHR"
        string transaction_hash
        string provider "ABA_PAYWAY | BAKONG_KHQR | CASH"
        datetime settled_at
    }
```

---

## 🔄 Order & Payment Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Diner as 📱 Diner at Table 4
    participant Web as 🌐 TokMenu Web (/r/:slug)
    participant API as ⚡ FastAPI Backend
    participant PayService as 💳 Payment Engine (KHQR/ABA)
    participant DB as 💾 MongoDB
    actor Kitchen as 👨‍🍳 Kitchen Staff (Telegram)

    Diner->>Web: Scans Table 4 QR -> Opens Landing Page
    Web->>API: GET /public/restaurant/:slug?token=T4
    API-->>Web: Return Restaurant Profile, Social Links & Menu
    
    Diner->>Web: Adds dishes to cart & clicks Checkout
    Diner->>Web: Chooses Payment (Bakong KHQR)
    Web->>API: POST /public/orders (Cart, Table 4, Method: KHQR)
    
    API->>PayService: Generate Bakong KHQR (EMVCo CRC16-CCITT)
    PayService-->>API: Dynamic KHQR String & Deep Link
    API->>DB: Save Order (Status: PENDING)
    API-->>Web: Return Order Code & Live KHQR Code
    
    API->>Kitchen: 🔔 Telegram Dispatch: "New Order #TK8291 at Table 4!"
    
    Diner->>Diner: Scans KHQR with ABA / Bakong Banking App
    Diner->>Web: Clicks "I have completed payment"
    Web->>API: POST /public/orders/:code/pay
    API->>DB: Mark Order Status: PAID
    API-->>Web: Order Confirmed! Show Live Preparation Tracker
```

---

## 🚀 Quick Start

### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Start Server (Port 8000)
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup (React with pnpm)
```bash
cd ../frontend
pnpm install
pnpm start
```

Visit `http://localhost:3000` to launch the ordering terminal.

---

## 📄 License
MIT License © **[Ros Rendo](https://github.com/RosRendo)**
