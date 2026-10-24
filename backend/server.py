import os
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

import auth
import routes_admin
import routes_menu
import routes_orders
import routes_public
import routes_restaurant
import routes_tables
import seed
import storage
from core import client, db, logger, request_host

app = FastAPI(title="Tok Menu API", docs_url=None, redoc_url=None, openapi_url=None)

for module in (auth, routes_public, routes_menu, routes_tables, routes_orders, routes_restaurant, routes_admin):
    app.include_router(module.router)

CONFIGURED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip() and o.strip() != "*"]
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}


def _origin_allowed(origin: str, request: Request) -> bool:
    netloc = urlparse(origin).netloc
    if netloc and netloc == request_host(request.headers):
        return True
    return origin.rstrip("/") in CONFIGURED_ORIGINS


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if (request.method not in SAFE_METHODS and request.url.path.startswith("/api/")
            and (request.cookies.get("access_token") or request.cookies.get("refresh_token"))):
        origin = request.headers.get("origin")
        if origin and not _origin_allowed(origin, request):
            logger.warning("Blocked cross-origin %s %s from %s", request.method, request.url.path, origin)
            return JSONResponse(status_code=403, content={"detail": {"code": "BAD_ORIGIN", "message": "Request blocked."}})
    response = await call_next(request)
    for key, value in SECURITY_HEADERS.items():
        response.headers.setdefault(key, value)
    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/files/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = [{"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "msg": e.get("msg", "")} for e in exc.errors()]
    first = errors[0] if errors else {"field": "", "msg": "Invalid input"}
    message = f"{first['field']}: {first['msg']}" if first["field"] else first["msg"]
    return JSONResponse(status_code=422, content={"detail": {"code": "VALIDATION_ERROR", "message": message,
                                                             "errors": errors}})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": {"code": "SERVER_ERROR",
                                                             "message": "Something went wrong. Please try again."}})


if CONFIGURED_ORIGINS:
    app.add_middleware(CORSMiddleware, allow_origins=CONFIGURED_ORIGINS, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.restaurants.create_index("id", unique=True)
    await db.restaurants.create_index("slug", unique=True)
    await db.restaurants.create_index("previous_slugs")
    await db.memberships.create_index("id", unique=True)
    await db.memberships.create_index("user_id", unique=True)
    await db.memberships.create_index("restaurant_id")
    await db.invites.create_index("token_hash", unique=True)
    await db.invites.create_index([("restaurant_id", 1), ("email", 1)])
    await db.categories.create_index("id", unique=True)
    await db.categories.create_index([("restaurant_id", 1), ("sort_order", 1)])
    await db.items.create_index("id", unique=True)
    await db.items.create_index([("restaurant_id", 1), ("category_id", 1), ("sort_order", 1)])
    await db.tables.create_index("id", unique=True)
    await db.tables.create_index("token", unique=True)
    await db.tables.create_index([("restaurant_id", 1), ("label_key", 1)], unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("code", unique=True)
    await db.orders.create_index([("restaurant_id", 1), ("idempotency_key", 1)], unique=True)
    await db.orders.create_index([("restaurant_id", 1), ("status", 1), ("created_at", 1)])
    await db.orders.create_index([("restaurant_id", 1), ("business_date", 1)])
    await db.orders.create_index([("restaurant_id", 1), ("created_at", -1)])
    await db.subscriptions.create_index("restaurant_id", unique=True)
    await db.support_requests.create_index([("restaurant_id", 1), ("created_at", -1)])
    await db.support_requests.create_index("status")
    await db.audit_logs.create_index([("created_at", -1)])
    await db.audit_logs.create_index("restaurant_id")
    await db.login_attempts.create_index("identifier", unique=True)
    await db.login_attempts.create_index("updated_at", expireAfterSeconds=86400)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.rate_limits.create_index([("key", 1), ("at", 1)])
    await db.rate_limits.create_index("at", expireAfterSeconds=3600)
    await db.files.create_index("storage_path", unique=True)


@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    await seed.run_all()
    await storage.startup()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
