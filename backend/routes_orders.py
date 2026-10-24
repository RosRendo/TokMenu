import csv
import io
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from auth import MEMBER, OWNER, Ctx
from core import ApiError, audit, clean, db, now
from repo import broadcast_order, order_dashboard_view
from services import (ACTIVE_STATUSES, ORDER_STATUSES, STATUS_TIMESTAMP, can_transition, csv_safe, local_date,
                      minor_to_plain, ordering_status)

router = APIRouter(prefix="/api/dashboard", tags=["orders"])
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class TransitionIn(BaseModel):
    to: Literal["ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED"]
    reason: str = Field(default="", max_length=200)


class PaymentIn(BaseModel):
    status: Literal["paid", "unpaid"]
    method: Literal["cash", "other"] = "cash"


def _tz(ctx: Ctx) -> str:
    return ctx.restaurant["settings"].get("timezone")


async def _get_order(ctx: Ctx, order_id: str) -> dict:
    order = await db.orders.find_one({"id": order_id, "restaurant_id": ctx.rid}, {"_id": 0})
    if not order:
        raise ApiError(404, "NOT_FOUND", "Order not found.")
    return order


@router.get("/orders/active")
async def active_orders(ctx: Ctx = Depends(MEMBER)):
    orders = await db.orders.find({"restaurant_id": ctx.rid, "status": {"$in": list(ACTIVE_STATUSES)}},
                                  {"_id": 0}).sort("created_at", 1).to_list(300)
    return {"orders": [order_dashboard_view(o) for o in orders], "server_time": now().isoformat()}


@router.get("/orders")
async def order_history(status: Optional[str] = None, q: str = "", date_from: Optional[str] = None,
                        date_to: Optional[str] = None, payment: Optional[str] = None, page: int = 1,
                        ctx: Ctx = Depends(MEMBER)):
    query = {"restaurant_id": ctx.rid}
    if status in ORDER_STATUSES:
        query["status"] = status
    if payment in ("paid", "unpaid"):
        query["payment_status"] = payment
    date_q = {}
    if date_from and DATE_RE.match(date_from):
        date_q["$gte"] = date_from
    if date_to and DATE_RE.match(date_to):
        date_q["$lte"] = date_to
    history_days = ctx.plan["history_days"]
    limited_from = None
    if history_days:
        limited_from = (date.fromisoformat(local_date(now(), _tz(ctx))) - timedelta(days=history_days - 1)).isoformat()
        date_q["$gte"] = max(date_q.get("$gte", limited_from), limited_from)
    if date_q:
        query["business_date"] = date_q
    term = q.strip()[:40]
    if term:
        code = re.sub(r"[\s-]", "", term).upper()
        ors = [{"table_label": {"$regex": re.escape(term), "$options": "i"}},
               {"customer_label": {"$regex": re.escape(term), "$options": "i"}}]
        if code.isalnum():
            ors.append({"code": {"$regex": "^" + re.escape(code)}})
        if term.lstrip("#").isdigit():
            ors.append({"daily_number": int(term.lstrip("#"))})
        query["$or"] = ors
    page = max(1, min(page, 1000))
    page_size = 25
    total = await db.orders.count_documents(query)
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size) \
        .limit(page_size).to_list(page_size)
    return {"orders": [order_dashboard_view(o) for o in orders], "total": total, "page": page,
            "page_size": page_size, "history_limited_from": limited_from}


@router.get("/orders/{order_id}")
async def order_detail(order_id: str, ctx: Ctx = Depends(MEMBER)):
    return order_dashboard_view(await _get_order(ctx, order_id))


@router.post("/orders/{order_id}/transition")
async def transition_order(order_id: str, body: TransitionIn, ctx: Ctx = Depends(MEMBER)):
    order = await _get_order(ctx, order_id)
    if not can_transition(order["status"], body.to):
        raise ApiError(409, "INVALID_TRANSITION", f"An order that is {order['status'].lower()} cannot be moved to "
                                                  f"{body.to.lower()}.", current_status=order["status"])
    ts = now()
    update = {"status": body.to, "updated_at": ts, STATUS_TIMESTAMP[body.to]: ts}
    if body.to == "REJECTED":
        update["reject_reason"] = body.reason.strip() or None
    updated = await db.orders.find_one_and_update(
        {"id": order_id, "restaurant_id": ctx.rid, "status": order["status"]},
        {"$set": update, "$push": {"status_history": {"status": body.to, "at": ts, "by": ctx.user["id"]}}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not updated:
        raise ApiError(409, "ORDER_CHANGED", "This order was just updated by someone else.")
    await broadcast_order(updated, ctx.restaurant, "order.updated")
    return order_dashboard_view(updated)


@router.post("/orders/{order_id}/payment")
async def record_payment(order_id: str, body: PaymentIn, ctx: Ctx = Depends(MEMBER)):
    order = await _get_order(ctx, order_id)
    if order["status"] == "REJECTED" and body.status == "paid":
        raise ApiError(409, "INVALID_PAYMENT", "A rejected order cannot be marked as paid.")
    paid = body.status == "paid"
    updated = await db.orders.find_one_and_update(
        {"id": order_id, "restaurant_id": ctx.rid},
        {"$set": {"payment_status": body.status, "payment_method": body.method if paid else None,
                  "paid_at": now() if paid else None, "paid_by": ctx.user["id"] if paid else None,
                  "updated_at": now()}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    await audit("order.payment_recorded", actor=ctx.user, restaurant_id=ctx.rid, target_type="order",
                target_id=order_id, meta={"status": body.status, "method": body.method})
    await broadcast_order(updated, ctx.restaurant, "order.updated")
    return order_dashboard_view(updated)


@router.get("/overview")
async def overview(ctx: Ctx = Depends(OWNER)):
    today = local_date(now(), _tz(ctx))
    todays = await db.orders.find({"restaurant_id": ctx.rid, "business_date": today},
                                  {"_id": 0, "status": 1, "total": 1}).to_list(5000)
    completed = [o for o in todays if o["status"] == "COMPLETED"]
    pending = await db.orders.count_documents({"restaurant_id": ctx.rid, "status": "PENDING"})
    in_progress = await db.orders.count_documents({"restaurant_id": ctx.rid, "status": {"$in": ["ACCEPTED", "PREPARING", "READY"]}})
    recent = await db.orders.find({"restaurant_id": ctx.rid}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    r = ctx.restaurant
    checklist = {
        "profile": bool(r.get("description") or r.get("logo_url") or r.get("cover_url")),
        "categories": await db.categories.count_documents({"restaurant_id": ctx.rid, "archived": False}) > 0,
        "items": await db.items.count_documents({"restaurant_id": ctx.rid, "archived": False}) > 0,
        "tables": await db.tables.count_documents({"restaurant_id": ctx.rid}) > 0,
        "first_order": await db.orders.count_documents({"restaurant_id": ctx.rid}, limit=1) > 0,
    }
    return {
        "today": today, "currency": r["settings"]["currency"],
        "orders_today": len(todays), "completed_today": len(completed),
        "sales_today": sum(o["total"] for o in completed), "pending": pending, "in_progress": in_progress,
        "recent": [order_dashboard_view(o) for o in recent], "checklist": checklist,
        "ordering": ordering_status(r, ctx.subscription, now()),
    }


def _range(ctx: Ctx, date_from: Optional[str], date_to: Optional[str]):
    today = date.fromisoformat(local_date(now(), _tz(ctx)))
    try:
        end = date.fromisoformat(date_to) if date_to else today
        start = date.fromisoformat(date_from) if date_from else end - timedelta(days=6)
    except ValueError:
        raise ApiError(400, "INVALID_DATE", "Please choose valid dates.")
    if start > end or (end - start).days > 366:
        raise ApiError(400, "INVALID_DATE", "Please choose a date range of up to one year.")
    return start, end


async def _orders_in_range(ctx: Ctx, start: date, end: date):
    return await db.orders.find(
        {"restaurant_id": ctx.rid, "business_date": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        {"_id": 0, "status_history": 0, "idempotency_key": 0}).sort("created_at", 1).to_list(50000)


@router.get("/analytics")
async def analytics(date_from: Optional[str] = None, date_to: Optional[str] = None, ctx: Ctx = Depends(OWNER)):
    if not ctx.plan["reports"]:
        raise ApiError(403, "PLAN_FEATURE", "Reports are available on the Starter and Pro plans.")
    start, end = _range(ctx, date_from, date_to)
    orders = await _orders_in_range(ctx, start, end)
    tz = ZoneInfo(_tz(ctx))
    days = {(start + timedelta(days=i)).isoformat(): {"orders": 0, "completed": 0, "gross": 0}
            for i in range((end - start).days + 1)}
    weekly = defaultdict(lambda: {"orders": 0, "completed": 0, "gross": 0})
    statuses = defaultdict(int)
    sellers = {}
    hourly = [{"hour": h, "orders": 0, "gross": 0} for h in range(24)]
    paid_total = paid_count = items_sold = 0
    for o in orders:
        d = o["business_date"]
        week = (date.fromisoformat(d) - timedelta(days=date.fromisoformat(d).weekday())).isoformat()
        done = o["status"] == "COMPLETED"
        statuses[o["status"]] += 1
        hour = o["created_at"].astimezone(tz).hour
        hourly[hour]["orders"] += 1
        for bucket in (days[d], weekly[week]):
            bucket["orders"] += 1
            if done:
                bucket["completed"] += 1
                bucket["gross"] += o["total"]
        if o.get("payment_status") == "paid":
            paid_total += o["total"]
            paid_count += 1
        if done:
            hourly[hour]["gross"] += o["total"]
            for line in o["items"]:
                key = line.get("item_id") or line["name"]
                s = sellers.setdefault(key, {"name": line["name"], "name_km": line.get("name_km", ""),
                                             "quantity": 0, "gross": 0})
                s["quantity"] += line["quantity"]
                s["gross"] += line["line_total"]
                items_sold += line["quantity"]
    completed = statuses.get("COMPLETED", 0)
    gross = sum(v["gross"] for v in days.values())
    return {
        "range": {"from": start.isoformat(), "to": end.isoformat()},
        "currency": ctx.restaurant["settings"]["currency"], "advanced": ctx.plan["advanced_reports"],
        "totals": {
            "orders": len(orders), "completed": completed, "rejected": statuses.get("REJECTED", 0),
            "open": sum(statuses.get(s, 0) for s in ACTIVE_STATUSES), "gross_completed": gross,
            "avg_completed": gross // completed if completed else 0, "payments_recorded": paid_total,
            "payments_recorded_count": paid_count, "items_sold": items_sold,
        },
        "daily": [{"date": k, **v} for k, v in days.items()],
        "weekly": [{"week_start": k, **v} for k, v in sorted(weekly.items())],
        "status_breakdown": [{"status": s, "count": statuses.get(s, 0)} for s in ORDER_STATUSES],
        "best_sellers": sorted(sellers.values(), key=lambda s: (-s["quantity"], -s["gross"]))[:10],
        "hourly": hourly if ctx.plan["advanced_reports"] else None,
    }


@router.get("/analytics/export")
async def analytics_export(date_from: Optional[str] = None, date_to: Optional[str] = None, ctx: Ctx = Depends(OWNER)):
    if not ctx.plan["advanced_reports"]:
        raise ApiError(403, "PLAN_FEATURE", "CSV export is available on the Pro plan.")
    start, end = _range(ctx, date_from, date_to)
    orders = await _orders_in_range(ctx, start, end)
    tz = ZoneInfo(_tz(ctx))
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["date", "time", "order_code", "daily_number", "table", "customer_label", "status", "payment",
                     "items", "subtotal", "service_charge", "tax", "total", "currency"])
    for o in orders:
        cur = o["currency"]
        writer.writerow([csv_safe(v) for v in [
            o["business_date"], o["created_at"].astimezone(tz).strftime("%H:%M"), o["code"], o["daily_number"],
            o.get("table_label") or "", o.get("customer_label") or "", o["status"], o["payment_status"],
            sum(line["quantity"] for line in o["items"]), minor_to_plain(o["subtotal"], cur),
            minor_to_plain(o["service_charge"], cur), minor_to_plain(o["tax"], cur), minor_to_plain(o["total"], cur), cur,
        ]])
    filename = f"orders-{start.isoformat()}-to-{end.isoformat()}.csv"
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
