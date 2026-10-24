import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import require_admin
from core import ApiError, audit, clean, db, now
from services import PLANS, SUBSCRIPTION_STATUSES

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SuspendIn(BaseModel):
    reason: str = Field(default="", max_length=300)


class SubscriptionIn(BaseModel):
    plan: Literal["trial", "starter", "pro"]
    status: Literal["trialing", "active", "past_due", "expired", "cancelled"]
    current_period_end: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    notes: str = Field(default="", max_length=500)


class ReplyIn(BaseModel):
    reply: str = Field(default="", max_length=2000)
    resolve: bool = False


@router.get("/stats")
async def stats(admin: dict = Depends(require_admin)):
    since = now() - timedelta(days=30)
    daily = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": "Asia/Phnom_Penh"}},
                    "orders": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]).to_list(40)
    active_ids = await db.orders.distinct("restaurant_id", {"created_at": {"$gte": since}})
    plans = await db.subscriptions.aggregate([{"$group": {"_id": "$plan", "n": {"$sum": 1}}}]).to_list(10)
    return {
        "restaurants": await db.restaurants.count_documents({}),
        "active_restaurants_30d": len(active_ids),
        "suspended": await db.restaurants.count_documents({"status": "suspended"}),
        "orders_30d": await db.orders.count_documents({"created_at": {"$gte": since}}),
        "users": await db.users.count_documents({}),
        "open_support": await db.support_requests.count_documents({"status": "open"}),
        "by_plan": {p["_id"]: p["n"] for p in plans},
        "daily_orders": [{"date": d["_id"], "orders": d["orders"]} for d in daily],
    }


async def _restaurant_rows(query: dict) -> list:
    restaurants = await db.restaurants.find(query, {"_id": 0, "settings": 0}).sort("created_at", -1).to_list(500)
    ids = [r["id"] for r in restaurants]
    subs = {s["restaurant_id"]: s for s in await db.subscriptions.find({"restaurant_id": {"$in": ids}}, {"_id": 0}).to_list(500)}
    owners = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": [r.get("owner_user_id") for r in restaurants]}}, {"_id": 0, "id": 1, "email": 1, "name": 1}).to_list(500)}
    since = now() - timedelta(days=30)
    order_counts = {c["_id"]: c["n"] for c in await db.orders.aggregate([
        {"$match": {"restaurant_id": {"$in": ids}, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$restaurant_id", "n": {"$sum": 1}}}]).to_list(500)}
    item_counts = {c["_id"]: c["n"] for c in await db.items.aggregate([
        {"$match": {"restaurant_id": {"$in": ids}, "archived": False}},
        {"$group": {"_id": "$restaurant_id", "n": {"$sum": 1}}}]).to_list(500)}
    rows = []
    for r in restaurants:
        owner = owners.get(r.get("owner_user_id"), {})
        rows.append(clean({
            "id": r["id"], "name": r["name"], "slug": r["slug"], "status": r["status"], "is_demo": r.get("is_demo"),
            "created_at": r["created_at"], "suspended_reason": r.get("suspended_reason"),
            "owner_email": owner.get("email"), "owner_name": owner.get("name"),
            "subscription": subs.get(r["id"]), "orders_30d": order_counts.get(r["id"], 0),
            "items": item_counts.get(r["id"], 0),
        }))
    return rows


@router.get("/restaurants")
async def list_restaurants(q: str = "", status: Optional[str] = None, admin: dict = Depends(require_admin)):
    query = {}
    if q.strip():
        term = re.escape(q.strip()[:60])
        query["$or"] = [{"name": {"$regex": term, "$options": "i"}}, {"slug": {"$regex": term, "$options": "i"}}]
    if status in ("active", "suspended"):
        query["status"] = status
    return await _restaurant_rows(query)


async def _set_status(restaurant_id: str, status: str, reason: str, admin: dict):
    res = await db.restaurants.update_one(
        {"id": restaurant_id},
        {"$set": {"status": status, "suspended_reason": reason if status == "suspended" else None, "updated_at": now()}})
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Restaurant not found.")
    await audit(f"restaurant.{'suspended' if status == 'suspended' else 'reactivated'}", actor=admin,
                restaurant_id=restaurant_id, target_type="restaurant", target_id=restaurant_id, meta={"reason": reason})
    return {"ok": True, "status": status}


@router.post("/restaurants/{restaurant_id}/suspend")
async def suspend(restaurant_id: str, body: SuspendIn, admin: dict = Depends(require_admin)):
    return await _set_status(restaurant_id, "suspended", body.reason.strip(), admin)


@router.post("/restaurants/{restaurant_id}/reactivate")
async def reactivate(restaurant_id: str, admin: dict = Depends(require_admin)):
    return await _set_status(restaurant_id, "active", "", admin)


@router.put("/subscriptions/{restaurant_id}")
async def update_subscription(restaurant_id: str, body: SubscriptionIn, admin: dict = Depends(require_admin)):
    if not await db.restaurants.find_one({"id": restaurant_id}, {"_id": 1}):
        raise ApiError(404, "NOT_FOUND", "Restaurant not found.")
    end = None
    if body.current_period_end:
        end = datetime.fromisoformat(body.current_period_end).replace(hour=23, minute=59, tzinfo=timezone.utc)
    update = {"plan": body.plan, "status": body.status, "current_period_end": end, "notes": body.notes.strip(),
              "updated_at": now(), "updated_by": admin["id"]}
    await db.subscriptions.update_one({"restaurant_id": restaurant_id}, {"$set": update}, upsert=True)
    await audit("subscription.updated", actor=admin, restaurant_id=restaurant_id, target_type="subscription",
                target_id=restaurant_id, meta={"plan": body.plan, "status": body.status, "end": body.current_period_end})
    return clean(await db.subscriptions.find_one({"restaurant_id": restaurant_id}, {"_id": 0}))


@router.get("/plans")
async def plans(admin: dict = Depends(require_admin)):
    return {"plans": list(PLANS.values()), "statuses": list(SUBSCRIPTION_STATUSES)}


@router.get("/support")
async def support_list(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    query = {"status": status} if status in ("open", "resolved") else {}
    rows = await db.support_requests.find(query, {"_id": 0}).sort([("status", 1), ("created_at", -1)]).to_list(300)
    return clean(rows)


@router.post("/support/{request_id}/reply")
async def support_reply(request_id: str, body: ReplyIn, admin: dict = Depends(require_admin)):
    update = {"updated_at": now()}
    if body.reply.strip():
        update["admin_reply"] = body.reply.strip()
    if body.resolve:
        update.update(status="resolved", resolved_at=now())
    res = await db.support_requests.update_one({"id": request_id}, {"$set": update})
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Support request not found.")
    await audit("support.replied", actor=admin, target_type="support_request", target_id=request_id,
                meta={"resolved": body.resolve})
    return clean(await db.support_requests.find_one({"id": request_id}, {"_id": 0}))


@router.get("/audit")
async def audit_log(limit: int = 100, admin: dict = Depends(require_admin)):
    rows = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(max(1, min(limit, 500))).to_list(500)
    return clean(rows)
