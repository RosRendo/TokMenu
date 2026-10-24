import re
from typing import List, Optional

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

import storage
from auth import user_from_token
from core import ApiError, clean, client_ip, db, logger, new_id, now, rate_limit, request_host
from realtime import hub
from repo import broadcast_order, next_daily_number, order_public_view
from services import (PLANS, TRIAL_DAYS, PricingError, generate_order_code, local_date, normalize_order_code,
                      ordering_status, plan_for, price_cart)

router = APIRouter(prefix="/api", tags=["public"])

PUBLIC_RESTAURANT_FIELDS = ("id", "slug", "name", "name_km", "description", "description_km", "logo_url",
                            "cover_url", "phone", "address", "social", "is_demo")
PUBLIC_SETTINGS_FIELDS = ("currency", "service_charge_bps", "tax_bps", "default_language", "opening_hours",
                          "timezone", "temporarily_closed")
ID_RE = r"^[A-Za-z0-9-]{1,64}$"


async def find_restaurant_by_slug(slug: str) -> dict:
    slug = (slug or "").lower()[:60]
    restaurant = await db.restaurants.find_one({"slug": slug}, {"_id": 0})
    if not restaurant:
        restaurant = await db.restaurants.find_one({"previous_slugs": slug}, {"_id": 0})
    if not restaurant:
        raise ApiError(404, "NOT_FOUND", "We couldn't find this restaurant.")
    return restaurant


@router.get("/health")
async def health():
    return {"ok": True}


@router.get("/public/plans")
async def public_plans():
    return {"plans": list(PLANS.values()), "trial_days": TRIAL_DAYS}


@router.get("/public/menu/{slug}")
async def public_menu(slug: str):
    restaurant = await find_restaurant_by_slug(slug)
    if restaurant["status"] == "suspended":
        return {"suspended": True, "restaurant": {"name": restaurant["name"], "name_km": restaurant.get("name_km", ""),
                                                  "slug": restaurant["slug"]}}
    subscription = await db.subscriptions.find_one({"restaurant_id": restaurant["id"]}, {"_id": 0})
    settings = restaurant["settings"]
    info = {k: restaurant.get(k) for k in PUBLIC_RESTAURANT_FIELDS}
    info["accent_color"] = settings.get("accent_color") if plan_for(subscription)["custom_branding"] else None
    categories = await db.categories.find(
        {"restaurant_id": restaurant["id"], "archived": False},
        {"_id": 0, "id": 1, "name": 1, "name_km": 1, "sort_order": 1}).sort("sort_order", 1).to_list(200)
    order = {c["id"]: i for i, c in enumerate(categories)}
    items = await db.items.find(
        {"restaurant_id": restaurant["id"], "archived": False, "category_id": {"$in": list(order)}},
        {"_id": 0, "restaurant_id": 0, "archived": 0, "created_at": 0, "updated_at": 0}).to_list(2000)
    items.sort(key=lambda i: (order[i["category_id"]], i.get("sort_order", 0)))
    return clean({
        "suspended": False, "canonical_slug": restaurant["slug"], "restaurant": info,
        "settings": {k: settings.get(k) for k in PUBLIC_SETTINGS_FIELDS},
        "status": ordering_status(restaurant, subscription, now()),
        "categories": categories, "items": items,
    })


@router.get("/public/menu/{slug}/table/{token}")
async def public_table(slug: str, token: str):
    restaurant = await find_restaurant_by_slug(slug)
    table = await db.tables.find_one({"restaurant_id": restaurant["id"], "token": token[:64]}, {"_id": 0, "label": 1})
    if not table:
        raise ApiError(404, "TABLE_NOT_FOUND", "This table QR code is no longer valid. Please ask staff for help.")
    return {"label": table["label"]}


class SelectionIn(BaseModel):
    group_id: str = Field(pattern=ID_RE)
    option_ids: List[str] = Field(default_factory=list, max_length=20)


class LineIn(BaseModel):
    item_id: str = Field(pattern=ID_RE)
    quantity: int = Field(ge=1, le=50)
    selections: List[SelectionIn] = Field(default_factory=list, max_length=10)
    note: str = Field(default="", max_length=200)


class OrderIn(BaseModel):
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9-]{16,64}$")
    table_token: Optional[str] = Field(default=None, max_length=64)
    customer_label: str = Field(default="", max_length=40)
    note: str = Field(default="", max_length=300)
    items: List[LineIn] = Field(min_length=1, max_length=50)


@router.post("/public/menu/{slug}/orders")
async def create_order(slug: str, body: OrderIn, request: Request):
    ip = client_ip(request)
    restaurant = await find_restaurant_by_slug(slug)
    rid = restaurant["id"]
    existing = await db.orders.find_one({"restaurant_id": rid, "idempotency_key": body.idempotency_key}, {"_id": 0})
    if existing:
        return {"order": order_public_view(existing, restaurant), "duplicate": True}
    await rate_limit(f"order-ip:{ip}", 20, 60)
    await rate_limit(f"order-table:{rid}:{body.table_token or 'none'}", 10, 120)

    subscription = await db.subscriptions.find_one({"restaurant_id": rid}, {"_id": 0})
    status = ordering_status(restaurant, subscription, now())
    if not status["can_order"]:
        raise ApiError(409, "ORDERING_UNAVAILABLE", "This restaurant is not taking orders right now.",
                       reason=status["reason"])

    table = None
    if body.table_token:
        table = await db.tables.find_one({"restaurant_id": rid, "token": body.table_token}, {"_id": 0})
        if not table:
            raise ApiError(400, "TABLE_NOT_FOUND", "This table QR code is no longer valid. Please ask staff for help.")

    item_ids = list({line.item_id for line in body.items})
    active_categories = await db.categories.distinct("id", {"restaurant_id": rid, "archived": False})
    items = await db.items.find(
        {"restaurant_id": rid, "id": {"$in": item_ids}, "archived": False, "category_id": {"$in": active_categories}},
        {"_id": 0}).to_list(len(item_ids))
    settings = restaurant["settings"]
    try:
        priced = price_cart([line.model_dump() for line in body.items], {i["id"]: i for i in items}, settings)
    except PricingError as err:
        raise ApiError(409, err.code, err.message, item_id=err.item_id)

    ts = now()
    business_date = local_date(ts, settings.get("timezone"))
    order = {
        "id": new_id(), "restaurant_id": rid, "code": None,
        "daily_number": await next_daily_number(rid, business_date), "business_date": business_date,
        "status": "PENDING", "payment_status": "unpaid", "payment_method": None, "paid_at": None,
        "table_id": table["id"] if table else None, "table_label": table["label"] if table else None,
        "customer_label": body.customer_label.strip(), "currency": settings["currency"],
        "items": priced["lines"], "subtotal": priced["subtotal"], "service_charge": priced["service_charge"],
        "tax": priced["tax"], "total": priced["total"],
        "service_charge_bps": settings.get("service_charge_bps", 0), "tax_bps": settings.get("tax_bps", 0),
        "note": body.note.strip(), "idempotency_key": body.idempotency_key, "reject_reason": None,
        "status_history": [{"status": "PENDING", "at": ts, "by": None}],
        "is_demo": bool(restaurant.get("is_demo")), "created_at": ts, "updated_at": ts,
    }
    for _ in range(5):
        order["code"] = generate_order_code()
        order.pop("_id", None)
        try:
            await db.orders.insert_one(order)
            break
        except DuplicateKeyError:
            duplicate = await db.orders.find_one(
                {"restaurant_id": rid, "idempotency_key": body.idempotency_key}, {"_id": 0})
            if duplicate:
                return {"order": order_public_view(duplicate, restaurant), "duplicate": True}
    else:
        logger.error("Could not allocate order code for restaurant %s", rid)
        raise ApiError(500, "SERVER_ERROR", "Something went wrong. Please try again.")
    await broadcast_order(order, restaurant, "order.created")
    return {"order": order_public_view(order, restaurant), "duplicate": False}


@router.get("/public/orders/{code}")
async def public_order(code: str, request: Request):
    await rate_limit(f"order-view:{client_ip(request)}", 120, 60)
    normalized = normalize_order_code(code)
    order = await db.orders.find_one({"code": normalized}, {"_id": 0}) if normalized else None
    if not order:
        raise ApiError(404, "ORDER_NOT_FOUND", "We couldn't find this order.")
    restaurant = await db.restaurants.find_one({"id": order["restaurant_id"]}, {"_id": 0})
    return order_public_view(order, restaurant or {})


@router.get("/files/{path:path}")
async def get_file(path: str):
    if not re.fullmatch(r"[A-Za-z0-9/_.-]{1,200}", path) or ".." in path:
        raise ApiError(404, "NOT_FOUND", "File not found.")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise ApiError(404, "NOT_FOUND", "File not found.")
    try:
        data, _ = await storage.get_object(path)
    except Exception as exc:
        logger.error("File fetch failed: %s", exc)
        raise ApiError(502, "FILE_UNAVAILABLE", "Image temporarily unavailable.")
    return Response(content=data, media_type=record["content_type"],
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


def _ws_origin_ok(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        return True
    return re.sub(r"^https?://", "", origin).rstrip("/") == request_host(websocket.headers)


async def _ws_loop(websocket: WebSocket, room: str):
    await websocket.accept()
    hub.join(room, websocket)
    try:
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.leave(room, websocket)


@router.websocket("/ws/orders/{code}")
async def ws_order(websocket: WebSocket, code: str):
    normalized = normalize_order_code(code)
    if not normalized or not await db.orders.find_one({"code": normalized}, {"_id": 1}):
        await websocket.close(code=4404)
        return
    await _ws_loop(websocket, f"o:{normalized}")


@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    if not _ws_origin_ok(websocket):
        await websocket.close(code=4403)
        return
    try:
        user = await user_from_token(websocket.cookies.get("access_token"))
    except Exception:
        await websocket.close(code=4401)
        return
    membership = await db.memberships.find_one({"user_id": user["id"]}, {"_id": 0})
    if not membership:
        await websocket.close(code=4403)
        return
    await _ws_loop(websocket, f"r:{membership['restaurant_id']}")
