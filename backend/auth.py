import hashlib
import os
import secrets
from datetime import timedelta

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field

import emailer
from core import ApiError, app_base_url, audit, clean, client_ip, db, logger, new_id, now, rate_limit
from repo import create_restaurant
from services import plan_for, within_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALG = "HS256"
ACCESS_TTL = timedelta(minutes=15)
REFRESH_TTL = timedelta(days=7)
RESET_TTL = timedelta(hours=1)
LOCKOUT_ATTEMPTS = 5
LOCKOUT_TTL = timedelta(minutes=15)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _make_token(user: dict, kind: str, ttl: timedelta) -> str:
    payload = {"sub": user["id"], "type": kind, "ver": user.get("token_version", 0), "iat": now(), "exp": now() + ttl}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


def _cookie_secure() -> bool:
    return os.environ.get("COOKIE_SECURE", "false").lower() in ("true", "1", "yes")


def set_auth_cookies(response: Response, user: dict):
    opts = dict(httponly=True, secure=_cookie_secure(), samesite="lax")
    response.set_cookie("access_token", _make_token(user, "access", ACCESS_TTL),
                        max_age=int(ACCESS_TTL.total_seconds()), path="/", **opts)
    response.set_cookie("refresh_token", _make_token(user, "refresh", REFRESH_TTL),
                        max_age=int(REFRESH_TTL.total_seconds()), path="/api/auth", **opts)


def clear_auth_cookies(response: Response):
    sec = _cookie_secure()
    response.delete_cookie("access_token", path="/", secure=sec, httponly=True, samesite="lax")
    response.delete_cookie("refresh_token", path="/api/auth", secure=sec, httponly=True, samesite="lax")


async def user_from_token(token, kind: str = "access") -> dict:
    if not token:
        raise ApiError(401, "NOT_AUTHENTICATED", "Please sign in.")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "TOKEN_EXPIRED", "Your session has expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise ApiError(401, "NOT_AUTHENTICATED", "Please sign in.")
    if payload.get("type") != kind:
        raise ApiError(401, "NOT_AUTHENTICATED", "Please sign in.")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user or user.get("token_version", 0) != payload.get("ver"):
        raise ApiError(401, "NOT_AUTHENTICATED", "Please sign in.")
    return user


async def current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:]
    return await user_from_token(token)


class Ctx:
    """Authenticated restaurant context. Every tenant query must filter by ctx.rid."""

    def __init__(self, user, membership, restaurant, subscription):
        self.user = user
        self.membership = membership
        self.restaurant = restaurant
        self.subscription = subscription
        self.rid = restaurant["id"]
        self.role = membership["role"]
        self.plan = plan_for(subscription)

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"


def tenant(roles=("owner", "staff"), allow_suspended=False):
    async def dependency(user: dict = Depends(current_user)) -> Ctx:
        membership = await db.memberships.find_one({"user_id": user["id"]}, {"_id": 0})
        if not membership or membership["role"] not in roles:
            raise ApiError(403, "FORBIDDEN", "You do not have access to this.")
        restaurant = await db.restaurants.find_one({"id": membership["restaurant_id"]}, {"_id": 0})
        if not restaurant:
            raise ApiError(403, "FORBIDDEN", "You do not have access to this.")
        if restaurant["status"] == "suspended" and not allow_suspended:
            raise ApiError(403, "RESTAURANT_SUSPENDED", "This restaurant is suspended. Please contact Tok Menu support.")
        subscription = await db.subscriptions.find_one({"restaurant_id": restaurant["id"]}, {"_id": 0})
        return Ctx(user, membership, restaurant, subscription)

    return dependency


MEMBER = tenant()
OWNER = tenant(("owner",))
OWNER_ANY = tenant(("owner",), allow_suspended=True)


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_platform_admin"):
        raise ApiError(403, "FORBIDDEN", "You do not have access to this.")
    return user


def public_user(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "name": user.get("name", ""),
            "is_platform_admin": bool(user.get("is_platform_admin"))}


async def me_payload(user: dict) -> dict:
    membership = await db.memberships.find_one({"user_id": user["id"]}, {"_id": 0})
    restaurant = None
    if membership:
        restaurant = await db.restaurants.find_one(
            {"id": membership["restaurant_id"]}, {"_id": 0, "id": 1, "name": 1, "name_km": 1, "slug": 1, "status": 1})
    return {"user": public_user(user), "membership": clean(membership) if membership else None,
            "restaurant": clean(restaurant)}


def new_user_doc(email: str, name: str, password: str, **extra) -> dict:
    ts = now()
    return {"id": new_id(), "email": email, "name": name.strip(), "password_hash": hash_password(password),
            "is_platform_admin": False, "token_version": 0, "created_at": ts, "updated_at": ts, **extra}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    restaurant_name: str = Field(min_length=2, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class AcceptInviteIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    name: str = Field(default="", max_length=80)
    password: str = Field(min_length=8, max_length=128)


@router.post("/register")
async def register(body: RegisterIn, request: Request, response: Response):
    await rate_limit(f"register:{client_ip(request)}", 10, 3600)
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise ApiError(409, "EMAIL_TAKEN", "An account with this email already exists. Try signing in.")
    user = new_user_doc(email, body.name, body.password)
    await db.users.insert_one(user)
    restaurant = await create_restaurant(user, body.restaurant_name)
    await audit("restaurant.created", actor=user, restaurant_id=restaurant["id"], target_type="restaurant",
                target_id=restaurant["id"], meta={"slug": restaurant["slug"]})
    set_auth_cookies(response, user)
    return await me_payload(user)


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    ip = client_ip(request)
    email = body.email.lower().strip()
    await rate_limit(f"login-ip:{ip}", 30, 300)
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > now():
        raise ApiError(429, "LOCKED", "Too many failed attempts. Please try again in 15 minutes.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        update = {"count": count, "updated_at": now(), "locked_until": None}
        if count >= LOCKOUT_ATTEMPTS:
            update.update(count=0, locked_until=now() + LOCKOUT_TTL)
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")
    await db.login_attempts.delete_one({"identifier": identifier})
    set_auth_cookies(response, user)
    return await me_payload(user)


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return await me_payload(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    user = await user_from_token(request.cookies.get("refresh_token"), kind="refresh")
    set_auth_cookies(response, user)
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn, request: Request):
    await rate_limit(f"forgot:{client_ip(request)}", 5, 900)
    user = await db.users.find_one({"email": body.email.lower().strip()}, {"_id": 0})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token_hash": hash_token(token), "user_id": user["id"], "used": False,
            "expires_at": now() + RESET_TTL, "created_at": now(),
        })
        sent = await emailer.send_password_reset(user["email"], user.get("name", ""),
                                                 f"{app_base_url(request)}/reset-password?token={token}")
        logger.info("Password reset requested for user %s (email sent: %s)", user["id"], sent)
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(body: ResetIn, request: Request):
    await rate_limit(f"reset:{client_ip(request)}", 10, 900)
    record = await db.password_reset_tokens.find_one({"token_hash": hash_token(body.token)}, {"_id": 0})
    if not record or record["used"] or record["expires_at"] < now():
        raise ApiError(400, "INVALID_TOKEN", "This reset link is invalid or has expired. Please request a new one.")
    await db.users.update_one({"id": record["user_id"]}, {
        "$set": {"password_hash": hash_password(body.password), "updated_at": now()},
        "$inc": {"token_version": 1},
    })
    await db.password_reset_tokens.update_one({"token_hash": record["token_hash"]}, {"$set": {"used": True}})
    await audit("user.password_reset", target_type="user", target_id=record["user_id"])
    return {"ok": True}


async def _valid_invite(token: str) -> dict:
    invite = await db.invites.find_one({"token_hash": hash_token(token)}, {"_id": 0})
    if not invite or invite.get("accepted_at") or invite.get("revoked") or invite["expires_at"] < now():
        raise ApiError(400, "INVALID_INVITE", "This invitation is invalid or has expired. Ask the owner for a new one.")
    return invite


@router.get("/invites/{token}")
async def invite_info(token: str, request: Request):
    await rate_limit(f"invite-view:{client_ip(request)}", 30, 300)
    invite = await _valid_invite(token)
    restaurant = await db.restaurants.find_one({"id": invite["restaurant_id"]}, {"_id": 0, "name": 1})
    existing = await db.users.find_one({"email": invite["email"]}, {"_id": 0, "id": 1})
    return {"email": invite["email"], "restaurant_name": (restaurant or {}).get("name", ""),
            "existing_user": bool(existing)}


@router.post("/invites/accept")
async def accept_invite(body: AcceptInviteIn, request: Request, response: Response):
    await rate_limit(f"invite-accept:{client_ip(request)}", 10, 300)
    invite = await _valid_invite(body.token)
    restaurant = await db.restaurants.find_one({"id": invite["restaurant_id"]}, {"_id": 0})
    if not restaurant or restaurant["status"] == "suspended":
        raise ApiError(400, "INVALID_INVITE", "This invitation can no longer be used.")
    subscription = await db.subscriptions.find_one({"restaurant_id": restaurant["id"]}, {"_id": 0})
    staff_count = await db.memberships.count_documents({"restaurant_id": restaurant["id"], "role": "staff"})
    if not within_limit(plan_for(subscription)["max_staff"], staff_count):
        raise ApiError(403, "PLAN_LIMIT", "This restaurant has reached its staff limit. Ask the owner to upgrade.")
    user = await db.users.find_one({"email": invite["email"]}, {"_id": 0})
    if user:
        if not verify_password(body.password, user["password_hash"]):
            raise ApiError(401, "INVALID_CREDENTIALS", "The password is incorrect for this existing account.")
        if await db.memberships.find_one({"user_id": user["id"]}, {"_id": 1}):
            raise ApiError(409, "ALREADY_MEMBER", "This account already belongs to a restaurant.")
    else:
        if not body.name.strip():
            raise ApiError(400, "NAME_REQUIRED", "Please enter your name.")
        user = new_user_doc(invite["email"], body.name, body.password)
        await db.users.insert_one(user)
    await db.memberships.insert_one({
        "id": new_id(), "user_id": user["id"], "restaurant_id": restaurant["id"], "role": "staff",
        "can_manage_availability": bool(invite.get("can_manage_availability")), "created_at": now(),
    })
    await db.invites.update_one({"id": invite["id"]}, {"$set": {"accepted_at": now()}})
    await audit("staff.joined", actor=user, restaurant_id=restaurant["id"], target_type="user", target_id=user["id"])
    set_auth_cookies(response, user)
    return await me_payload(user)
