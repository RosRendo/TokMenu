# Test Credentials
# Agent writes here when creating/modifying auth credentials (admin accounts, test users).
# Testing agent reads this before auth tests. Fork/continuation agents read on startup.

Seeded idempotently on backend startup from backend/.env (seed.py).

## Platform admin
- Email: admin@tokmenu.app
- Password: TokAdmin#2026
- Lands on: /admin

## Demo restaurant owner (Tok Demo Kitchen, slug `demo`, Pro plan, is_demo=true)
- Email: owner@demo.tokmenu.app
- Password: DemoOwner#2026
- Lands on: /dashboard

## Demo staff (role=staff, can_manage_availability=true)
- Email: staff@demo.tokmenu.app
- Password: DemoStaff#2026
- Lands on: /dashboard/orders

## Public
- Demo menu: /menu/demo (no login). Table QR links use /menu/demo?t=<table public token> (see Tables page).

## Auth mechanism
- httpOnly cookies (access + refresh). Endpoints: POST /api/auth/login, /api/auth/logout, /api/auth/refresh, GET /api/auth/me
- Mutating requests check Origin header against allowed origins (CSRF guard).
