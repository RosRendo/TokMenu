"""Database helpers shared by routes and seed scripts."""
from datetime import timedelta

from pymongo import ReturnDocument

from core import clean, db, new_id, now
from realtime import hub
from services import RESERVED_SLUGS, TRIAL_DAYS, default_settings, display_code, slugify


async def slug_taken(slug: str, exclude_id=None) -> bool:
    query = {"$or": [{"slug": slug}, {"previous_slugs": slug}]}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return await db.restaurants.find_one(query, {"_id": 0, "id": 1}) is not None


async def unique_slug(name: str) -> str:
    base = slugify(name)
    if base in RESERVED_SLUGS:
        base = f"{base}-kitchen"
    slug, n = base, 2
    while await slug_taken(slug):
        slug = f"{base[:35]}-{n}"
        n += 1
    return slug


async def create_restaurant(owner, name, *, slug=None, is_demo=False, plan="trial",
                            sub_status="trialing", period_days=TRIAL_DAYS, extra=None):
    ts = now()
    restaurant = {
        "id": new_id(), "slug": slug or await unique_slug(name), "previous_slugs": [],
        "name": name.strip(), "name_km": "", "description": "", "description_km": "",
        "logo_url": None, "cover_url": None, "phone": "", "address": "", "social": {},
        "status": "active", "is_demo": is_demo, "settings": default_settings(),
        "owner_user_id": owner["id"], "created_at": ts, "updated_at": ts,
    }
    restaurant.update(extra or {})
    await db.restaurants.insert_one(restaurant)
    await db.memberships.insert_one({
        "id": new_id(), "user_id": owner["id"], "restaurant_id": restaurant["id"], "role": "owner",
        "can_manage_availability": True, "created_at": ts,
    })
    await db.subscriptions.insert_one({
        "id": new_id(), "restaurant_id": restaurant["id"], "plan": plan, "status": sub_status,
        "current_period_end": ts + timedelta(days=period_days),
        "trial_ends_at": ts + timedelta(days=TRIAL_DAYS) if plan == "trial" else None,
        "notes": "", "created_at": ts, "updated_at": ts,
    })
    return restaurant


async def next_daily_number(restaurant_id: str, business_date: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": f"orders:{restaurant_id}:{business_date}"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    return doc["seq"]


async def pending_invites_count(restaurant_id: str) -> int:
    return await db.invites.count_documents({
        "restaurant_id": restaurant_id, "accepted_at": None, "revoked": False, "expires_at": {"$gt": now()},
    })


async def usage(restaurant_id: str) -> dict:
    return {
        "items": await db.items.count_documents({"restaurant_id": restaurant_id, "archived": False}),
        "tables": await db.tables.count_documents({"restaurant_id": restaurant_id}),
        "staff": await db.memberships.count_documents({"restaurant_id": restaurant_id, "role": "staff"}),
        "pending_invites": await pending_invites_count(restaurant_id),
    }


def _public_line(line):
    return {
        "name": line["name"], "name_km": line.get("name_km", ""), "quantity": line["quantity"],
        "unit_price": line["unit_price"], "line_total": line["line_total"], "note": line.get("note", ""),
        "options": [
            {"group_name": o["group_name"], "group_name_km": o.get("group_name_km", ""), "name": o["name"],
             "name_km": o.get("name_km", ""), "price_delta": o["price_delta"]}
            for o in line.get("options", [])
        ],
    }


def order_public_view(order: dict, restaurant: dict) -> dict:
    return clean({
        "code": order["code"], "display_code": display_code(order["code"]),
        "daily_number": order["daily_number"], "status": order["status"],
        "payment_status": order["payment_status"], "table_label": order.get("table_label"),
        "customer_label": order.get("customer_label") or "", "currency": order["currency"],
        "items": [_public_line(line) for line in order["items"]],
        "subtotal": order["subtotal"], "service_charge": order["service_charge"], "tax": order["tax"],
        "total": order["total"], "note": order.get("note", ""), "reject_reason": order.get("reject_reason"),
        "created_at": order["created_at"], "updated_at": order["updated_at"],
        "accepted_at": order.get("accepted_at"), "preparing_at": order.get("preparing_at"),
        "ready_at": order.get("ready_at"), "completed_at": order.get("completed_at"),
        "rejected_at": order.get("rejected_at"),
        "restaurant": {
            "name": restaurant.get("name"), "name_km": restaurant.get("name_km", ""),
            "slug": restaurant.get("slug"), "logo_url": restaurant.get("logo_url"),
        },
    })


def order_dashboard_view(order: dict) -> dict:
    view = clean({k: v for k, v in order.items() if k not in ("idempotency_key",)})
    view["display_code"] = display_code(order["code"])
    return view


async def broadcast_order(order: dict, restaurant: dict, event: str):
    await hub.publish(f"r:{restaurant['id']}", {"type": event, "order": order_dashboard_view(order)})
    await hub.publish(f"o:{order['code']}", {"type": "order.updated", "order": order_public_view(order, restaurant)})
