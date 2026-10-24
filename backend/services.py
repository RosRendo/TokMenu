"""Pure business rules: pricing, order state machine, plans, money, hours. No database access."""
import re
import secrets
import unicodedata
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

DEFAULT_TIMEZONE = "Asia/Phnom_Penh"
TRIAL_DAYS = 14

ORDER_STATUSES = ("PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED")
ACTIVE_STATUSES = ("PENDING", "ACCEPTED", "PREPARING", "READY")
TRANSITIONS = {
    "PENDING": {"ACCEPTED", "REJECTED"},
    "ACCEPTED": {"PREPARING"},
    "PREPARING": {"READY"},
    "READY": {"COMPLETED"},
}
STATUS_TIMESTAMP = {
    "ACCEPTED": "accepted_at",
    "PREPARING": "preparing_at",
    "READY": "ready_at",
    "COMPLETED": "completed_at",
    "REJECTED": "rejected_at",
}


def can_transition(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, set())


# ---------- Money ----------
CURRENCIES = {"USD": {"decimals": 2, "symbol": "$"}, "KHR": {"decimals": 0, "symbol": "៛"}}


def format_money(minor: int, currency: str) -> str:
    sign = "-" if minor < 0 else ""
    value = abs(int(minor))
    if currency == "KHR":
        return f"{sign}{value:,}៛"
    return f"{sign}${value // 100:,}.{value % 100:02d}"


def minor_to_plain(minor: int, currency: str) -> str:
    if currency == "KHR":
        return str(int(minor))
    return f"{int(minor) / 100:.2f}"


def percent_of(amount: int, bps: int) -> int:
    """Percentage in basis points, rounded half up to the nearest minor unit."""
    return (int(amount) * int(bps) + 5000) // 10000


# ---------- Plans ----------
PLANS = {
    "trial": {
        "key": "trial", "name": "Free Trial", "name_km": "សាកល្បងឥតគិតថ្លៃ", "price_usd": 0,
        "max_items": 25, "max_tables": 5, "max_staff": 0, "history_days": 2,
        "reports": False, "advanced_reports": False, "custom_branding": False, "priority_support": False,
    },
    "starter": {
        "key": "starter", "name": "Starter", "name_km": "ចាប់ផ្ដើម", "price_usd": 10,
        "max_items": None, "max_tables": 50, "max_staff": 2, "history_days": None,
        "reports": True, "advanced_reports": False, "custom_branding": False, "priority_support": False,
    },
    "pro": {
        "key": "pro", "name": "Pro", "name_km": "Pro", "price_usd": 20,
        "max_items": None, "max_tables": 200, "max_staff": 10, "history_days": None,
        "reports": True, "advanced_reports": True, "custom_branding": True, "priority_support": True,
    },
}
SUBSCRIPTION_STATUSES = ("trialing", "active", "past_due", "expired", "cancelled")


def plan_for(subscription) -> dict:
    return PLANS.get((subscription or {}).get("plan"), PLANS["trial"])


def within_limit(limit, current_count: int) -> bool:
    return limit is None or current_count < limit


def _aware(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def subscription_active(subscription, at: datetime) -> bool:
    if not subscription or subscription.get("status") not in ("trialing", "active"):
        return False
    end = _aware(subscription.get("current_period_end"))
    return end is None or end > at


# ---------- Opening hours ----------
def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def is_open_at(opening_hours, tz_name: str, at: datetime) -> bool:
    """opening_hours: [{day 0=Mon..6=Sun, closed, open 'HH:MM', close 'HH:MM'}]. Empty list = always open."""
    if not opening_hours:
        return True
    local = at.astimezone(ZoneInfo(tz_name or DEFAULT_TIMEZONE))
    by_day = {h["day"]: h for h in opening_hours}
    mins = local.hour * 60 + local.minute
    today = by_day.get(local.weekday())
    if today and not today.get("closed"):
        o, c = _minutes(today["open"]), _minutes(today["close"])
        if o == c:
            return True
        if o < c and o <= mins < c:
            return True
        if o > c and mins >= o:
            return True
    yesterday = by_day.get((local.weekday() - 1) % 7)
    if yesterday and not yesterday.get("closed"):
        o, c = _minutes(yesterday["open"]), _minutes(yesterday["close"])
        if o > c and mins < c:
            return True
    return False


def ordering_status(restaurant: dict, subscription, at: datetime) -> dict:
    s = restaurant.get("settings") or {}
    open_now = (not s.get("temporarily_closed")) and is_open_at(
        s.get("opening_hours") or [], s.get("timezone") or DEFAULT_TIMEZONE, at
    )
    if restaurant.get("status") == "suspended":
        reason = "SUSPENDED"
    elif not subscription_active(subscription, at):
        reason = "ORDERING_PAUSED"
    elif s.get("temporarily_closed"):
        reason = "TEMP_CLOSED"
    elif not open_now:
        reason = "CLOSED"
    else:
        reason = None
    return {"is_open": open_now, "can_order": reason is None, "reason": reason}


def local_date(at: datetime, tz_name: str) -> str:
    return at.astimezone(ZoneInfo(tz_name or DEFAULT_TIMEZONE)).date().isoformat()


def default_settings() -> dict:
    return {
        "currency": "USD",
        "timezone": DEFAULT_TIMEZONE,
        "service_charge_bps": 0,
        "tax_bps": 0,
        "default_language": "en",
        "temporarily_closed": False,
        "accent_color": None,
        "opening_hours": [{"day": d, "closed": False, "open": "07:00", "close": "21:00"} for d in range(7)],
    }


# ---------- Codes & slugs ----------
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_order_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def normalize_order_code(raw: str):
    code = re.sub(r"[\s-]", "", raw or "").upper()
    return code if re.fullmatch(r"[A-Z0-9]{8}", code) else None


def display_code(code: str) -> str:
    return f"{code[:4]}-{code[4:]}"


RESERVED_SLUGS = {
    "admin", "api", "app", "dashboard", "login", "register", "pricing", "menu", "cart",
    "order", "orders", "static", "help", "support", "www", "tokmenu", "new", "settings",
}
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$")


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40].strip("-")
    return s if len(s) >= 3 else "restaurant"


def valid_slug(slug: str) -> bool:
    return bool(SLUG_RE.fullmatch(slug or "")) and "--" not in slug and slug not in RESERVED_SLUGS


def csv_safe(value):
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


# ---------- Pricing ----------
class PricingError(Exception):
    def __init__(self, code: str, message: str, item_id=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.item_id = item_id


def price_cart(lines, items_by_id: dict, settings: dict) -> dict:
    """Authoritative server-side pricing. `lines` come from the browser; only IDs and quantities are trusted."""
    priced, subtotal = [], 0
    for line in lines:
        item = items_by_id.get(line["item_id"])
        if not item:
            raise PricingError("ITEM_NOT_FOUND", "An item in your cart is no longer on the menu.", line["item_id"])
        if not item.get("available", True):
            raise PricingError("ITEM_UNAVAILABLE", f"{item['name']} just became unavailable.", item["id"])
        qty = int(line["quantity"])
        if qty < 1 or qty > 50:
            raise PricingError("INVALID_QUANTITY", "Quantity must be between 1 and 50.", item["id"])
        selected = {}
        for sel in line.get("selections") or []:
            if sel["group_id"] in selected:
                raise PricingError("INVALID_OPTIONS", f"Please re-add {item['name']} to your cart.", item["id"])
            selected[sel["group_id"]] = list(sel.get("option_ids") or [])
        groups = item.get("option_groups") or []
        if set(selected) - {g["id"] for g in groups}:
            raise PricingError("INVALID_OPTIONS", f"The options for {item['name']} changed. Please re-add it.", item["id"])
        unit = int(item["price"])
        snapshot = []
        for g in groups:
            chosen = selected.get(g["id"], [])
            if len(set(chosen)) != len(chosen):
                raise PricingError("INVALID_OPTIONS", f"Please re-add {item['name']} to your cart.", item["id"])
            if len(chosen) < int(g.get("min_select", 0)):
                raise PricingError("OPTION_REQUIRED", f"Please choose {g['name']} for {item['name']}.", item["id"])
            if len(chosen) > int(g.get("max_select", 1)):
                raise PricingError("INVALID_OPTIONS", f"Too many choices for {g['name']}.", item["id"])
            opts = {o["id"]: o for o in g.get("options") or []}
            for oid in chosen:
                opt = opts.get(oid)
                if not opt:
                    raise PricingError("INVALID_OPTIONS", f"The options for {item['name']} changed. Please re-add it.", item["id"])
                if not opt.get("available", True):
                    raise PricingError("OPTION_UNAVAILABLE", f"{opt['name']} is no longer available.", item["id"])
                delta = int(opt.get("price_delta", 0))
                unit += delta
                snapshot.append({
                    "group_id": g["id"], "group_name": g["name"], "group_name_km": g.get("name_km", ""),
                    "option_id": opt["id"], "name": opt["name"], "name_km": opt.get("name_km", ""),
                    "price_delta": delta,
                })
        line_total = unit * qty
        subtotal += line_total
        priced.append({
            "item_id": item["id"], "name": item["name"], "name_km": item.get("name_km", ""),
            "unit_price": unit, "quantity": qty, "options": snapshot,
            "note": (line.get("note") or "").strip()[:200], "line_total": line_total,
        })
    service = percent_of(subtotal, settings.get("service_charge_bps", 0))
    tax = percent_of(subtotal + service, settings.get("tax_bps", 0))
    return {"lines": priced, "subtotal": subtotal, "service_charge": service, "tax": tax,
            "total": subtotal + service + tax}
