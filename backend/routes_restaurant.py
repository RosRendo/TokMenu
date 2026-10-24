import re
import secrets
from datetime import timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

import emailer
from auth import MEMBER, OWNER, OWNER_ANY, Ctx, hash_token
from core import ApiError, app_base_url, audit, clean, db, new_id, now, rate_limit
from repo import slug_taken, usage
from services import PLANS, ordering_status, subscription_active, valid_slug, within_limit
from routes_menu import check_image_url

router = APIRouter(prefix="/api/dashboard", tags=["restaurant"])
INVITE_TTL = timedelta(days=7)
TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


class SocialIn(BaseModel):
    facebook: str = Field(default="", max_length=200)
    instagram: str = Field(default="", max_length=200)
    telegram: str = Field(default="", max_length=200)
    tiktok: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=200)


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    name_km: str = Field(default="", max_length=80)
    slug: str = Field(min_length=3, max_length=40)
    description: str = Field(default="", max_length=600)
    description_km: str = Field(default="", max_length=600)
    phone: str = Field(default="", max_length=30)
    address: str = Field(default="", max_length=200)
    social: SocialIn = Field(default_factory=SocialIn)
    logo_url: Optional[str] = None
    cover_url: Optional[str] = None

    @field_validator("logo_url", "cover_url")
    @classmethod
    def validate_images(cls, value):
        return check_image_url(value)


class HoursIn(BaseModel):
    day: int = Field(ge=0, le=6)
    closed: bool = False
    open: str = Field(pattern=TIME_RE)
    close: str = Field(pattern=TIME_RE)


class SettingsIn(BaseModel):
    currency: Literal["USD", "KHR"]
    service_charge_bps: int = Field(ge=0, le=3000)
    tax_bps: int = Field(ge=0, le=3000)
    default_language: Literal["en", "km"]
    temporarily_closed: bool = False
    opening_hours: List[HoursIn] = Field(default_factory=list, max_length=7)
    accent_color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class InviteIn(BaseModel):
    email: EmailStr
    can_manage_availability: bool = False


class MemberPatchIn(BaseModel):
    can_manage_availability: bool


class SupportIn(BaseModel):
    type: Literal["support", "upgrade"] = "support"
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    requested_plan: Optional[Literal["starter", "pro"]] = None


def _restaurant_view(r: dict) -> dict:
    return clean({k: v for k, v in r.items() if k not in ("owner_user_id",)})


@router.get("/restaurant")
async def get_restaurant(ctx: Ctx = Depends(MEMBER)):
    return {
        "restaurant": _restaurant_view(ctx.restaurant), "role": ctx.role,
        "can_manage_availability": ctx.is_owner or bool(ctx.membership.get("can_manage_availability")),
        "subscription": clean(ctx.subscription), "plan": ctx.plan,
        "ordering": ordering_status(ctx.restaurant, ctx.subscription, now()),
    }


@router.put("/restaurant")
async def update_profile(body: ProfileIn, ctx: Ctx = Depends(OWNER)):
    data = body.model_dump()
    slug = data.pop("slug").strip().lower()
    update = {**data, "name": body.name.strip(), "updated_at": now()}
    ops = {"$set": update}
    if slug != ctx.restaurant["slug"]:
        if not valid_slug(slug):
            raise ApiError(400, "INVALID_SLUG", "Use 3–40 lowercase letters, numbers and single dashes.")
        if await slug_taken(slug, exclude_id=ctx.rid):
            raise ApiError(409, "SLUG_TAKEN", "This menu link is already used by another restaurant.")
        update["slug"] = slug
        ops["$addToSet"] = {"previous_slugs": ctx.restaurant["slug"]}
        await audit("restaurant.slug_changed", actor=ctx.user, restaurant_id=ctx.rid, target_type="restaurant",
                    target_id=ctx.rid, meta={"from": ctx.restaurant["slug"], "to": slug})
    await db.restaurants.update_one({"id": ctx.rid}, ops)
    if slug != ctx.restaurant["slug"]:
        await db.restaurants.update_one({"id": ctx.rid}, {"$pull": {"previous_slugs": slug}})
    return {"restaurant": _restaurant_view(await db.restaurants.find_one({"id": ctx.rid}, {"_id": 0}))}


@router.put("/restaurant/settings")
async def update_settings(body: SettingsIn, ctx: Ctx = Depends(OWNER)):
    current = ctx.restaurant["settings"]
    settings = {**current, **body.model_dump()}
    settings["opening_hours"] = sorted(settings["opening_hours"], key=lambda h: h["day"])
    if not ctx.plan["custom_branding"]:
        settings["accent_color"] = current.get("accent_color")
    await db.restaurants.update_one({"id": ctx.rid}, {"$set": {"settings": settings, "updated_at": now()}})
    if body.currency != current.get("currency"):
        await audit("restaurant.currency_changed", actor=ctx.user, restaurant_id=ctx.rid, target_type="restaurant",
                    target_id=ctx.rid, meta={"from": current.get("currency"), "to": body.currency})
    return {"settings": settings}


# ---------- Staff ----------
def _invite_view(inv: dict) -> dict:
    return clean({k: inv.get(k) for k in ("id", "email", "can_manage_availability", "created_at", "expires_at")})


@router.get("/staff")
async def list_staff(ctx: Ctx = Depends(OWNER)):
    members = await db.memberships.find({"restaurant_id": ctx.rid}, {"_id": 0}).sort("created_at", 1).to_list(100)
    users = await db.users.find({"id": {"$in": [m["user_id"] for m in members]}},
                                {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(100)
    by_id = {u["id"]: u for u in users}
    invites = await db.invites.find({"restaurant_id": ctx.rid, "accepted_at": None, "revoked": False,
                                     "expires_at": {"$gt": now()}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {
        "members": [clean({**m, "name": by_id.get(m["user_id"], {}).get("name", ""),
                           "email": by_id.get(m["user_id"], {}).get("email", "")}) for m in members],
        "invites": [_invite_view(i) for i in invites],
        "max_staff": ctx.plan["max_staff"],
    }


@router.post("/staff/invites")
async def invite_staff(body: InviteIn, request: Request, ctx: Ctx = Depends(OWNER)):
    await rate_limit(f"invite:{ctx.rid}", 20, 3600)
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
    if existing and await db.memberships.find_one({"user_id": existing["id"]}, {"_id": 1}):
        raise ApiError(409, "ALREADY_MEMBER", "This person already belongs to a restaurant on Tok Menu.")
    await db.invites.update_many({"restaurant_id": ctx.rid, "email": email, "accepted_at": None},
                                 {"$set": {"revoked": True}})
    stats = await usage(ctx.rid)
    if not within_limit(ctx.plan["max_staff"], stats["staff"] + stats["pending_invites"]):
        raise ApiError(403, "PLAN_LIMIT", f"Your {ctx.plan['name']} plan allows {ctx.plan['max_staff']} staff accounts. "
                                          "Upgrade to invite more.")
    token = secrets.token_urlsafe(32)
    invite = {"id": new_id(), "restaurant_id": ctx.rid, "email": email, "token_hash": hash_token(token),
              "can_manage_availability": body.can_manage_availability, "invited_by": ctx.user["id"],
              "accepted_at": None, "revoked": False, "created_at": now(), "expires_at": now() + INVITE_TTL}
    await db.invites.insert_one(invite)
    url = f"{app_base_url(request)}/accept-invite?token={token}"
    sent = await emailer.send_staff_invite(email, ctx.user.get("name", ""), ctx.restaurant["name"], url)
    await audit("staff.invited", actor=ctx.user, restaurant_id=ctx.rid, target_type="invite", target_id=invite["id"],
                meta={"email_sent": sent})
    return {"invite": _invite_view(invite), "invite_url": url, "email_sent": sent}


@router.delete("/staff/invites/{invite_id}")
async def revoke_invite(invite_id: str, ctx: Ctx = Depends(OWNER)):
    res = await db.invites.update_one({"id": invite_id, "restaurant_id": ctx.rid}, {"$set": {"revoked": True}})
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Invitation not found.")
    return {"ok": True}


async def _staff_member(ctx: Ctx, membership_id: str) -> dict:
    m = await db.memberships.find_one({"id": membership_id, "restaurant_id": ctx.rid, "role": "staff"}, {"_id": 0})
    if not m:
        raise ApiError(404, "NOT_FOUND", "Staff member not found.")
    return m


@router.patch("/staff/{membership_id}")
async def update_staff(membership_id: str, body: MemberPatchIn, ctx: Ctx = Depends(OWNER)):
    await _staff_member(ctx, membership_id)
    await db.memberships.update_one({"id": membership_id, "restaurant_id": ctx.rid},
                                    {"$set": {"can_manage_availability": body.can_manage_availability}})
    return {"ok": True}


@router.delete("/staff/{membership_id}")
async def remove_staff(membership_id: str, ctx: Ctx = Depends(OWNER)):
    m = await _staff_member(ctx, membership_id)
    await db.memberships.delete_one({"id": membership_id, "restaurant_id": ctx.rid})
    await audit("staff.removed", actor=ctx.user, restaurant_id=ctx.rid, target_type="user", target_id=m["user_id"])
    return {"ok": True}


# ---------- Billing & support ----------
@router.get("/billing")
async def billing(ctx: Ctx = Depends(OWNER_ANY)):
    return {
        "subscription": clean(ctx.subscription), "plan": ctx.plan, "plans": list(PLANS.values()),
        "usage": await usage(ctx.rid), "ordering_allowed": subscription_active(ctx.subscription, now()),
        "restaurant_status": ctx.restaurant["status"],
    }


@router.get("/support")
async def my_support_requests(ctx: Ctx = Depends(OWNER_ANY)):
    rows = await db.support_requests.find({"restaurant_id": ctx.rid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return clean(rows)


@router.post("/support")
async def create_support_request(body: SupportIn, ctx: Ctx = Depends(OWNER_ANY)):
    await rate_limit(f"support:{ctx.rid}", 10, 3600)
    doc = {"id": new_id(), "restaurant_id": ctx.rid, "restaurant_name": ctx.restaurant["name"],
           "user_id": ctx.user["id"], "user_email": ctx.user["email"], "type": body.type,
           "subject": body.subject.strip(), "message": body.message.strip(), "requested_plan": body.requested_plan,
           "status": "open", "admin_reply": None, "priority": ctx.plan["priority_support"],
           "created_at": now(), "updated_at": now(), "resolved_at": None}
    await db.support_requests.insert_one(doc)
    return clean(doc)
