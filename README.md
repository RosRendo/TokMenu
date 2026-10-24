# 🍽️ Tok Menu (តុ) — QR Menu & Table Ordering Platform

> **Modern bilingual (Khmer & English) digital menu, table ordering, and live kitchen management platform designed for cafés and restaurants in Cambodia.**

---

## ✨ Features

- 📱 **Frictionless Customer Experience**: Customers scan a table QR code and browse the menu instantly on their phone. **No app download, no account required.**
- 🇰🇭 **Bilingual Support (Khmer & English)**: Native dual-language dishes, categories, and modifier options with typography optimized for Khmer script (*Kantumruy Pro*).
- 🛎️ **Live Kitchen Order Board**: Real-time 4-stage Kanban (`New` ➔ `Accepted` ➔ `Preparing` ➔ `Ready`) with live WebSocket updates and sound alerts.
- 🖨️ **Printable A4 QR Sheets**: Generates print-ready table cards (4 per A4 page) with dashed cut guides and restaurant branding.
- 💰 **Cash & Counter Payment Tracking**: Built for local workflows where customers pay at counter or table; kitchen staff record cash settlements directly.
- 📊 **Owner Analytics & Menu Management**: Track top-selling items, daily sales, manage categories, availability toggles, and staff permissions.
- ⚡ **Zero-Setup Local Development**: Seamless automatic fallback to in-memory MongoDB (`mongomock-motor`) if no local MongoDB instance is running.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (CRACO)
- **Styling**: Tailwind CSS, Radix UI, Lucide Icons, Sonner
- **Typography**: Kantumruy Pro & Inter

### Backend
- **API Framework**: FastAPI & Uvicorn (Python 3.11+)
- **Database**: MongoDB (via Motor & PyMongo) with automated in-memory mock fallback
- **Authentication**: JWT HTTP-only cookies with role-based access control (Admin, Owner, Staff)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/RosRendo/TokMenu.git
cd TokMenu
```

### 2. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python -m pip install motor pymongo bcrypt pyjwt email-validator python-multipart tzdata mongomock-motor

# Start the API server on port 8000
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```
> The database automatically seeds with a demo restaurant (`Tok Demo Kitchen`) upon startup.

### 3. Frontend Setup
```bash
cd ../frontend
yarn install

# Start the dev server on port 3000
yarn start
```

Visit:
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Customer Demo Menu**: [http://localhost:3000/menu/demo](http://localhost:3000/menu/demo)
- **API Documentation**: [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 🔐 Seeded Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Restaurant Owner** | `owner@demo.tokmenu.app` | `DemoOwner#2026` |
| **Kitchen Staff** | `staff@demo.tokmenu.app` | `DemoStaff#2026` |
| **Platform Admin** | `admin@tokmenu.app` | `TokAdmin#2026` |

---

## 📄 License
MIT License
