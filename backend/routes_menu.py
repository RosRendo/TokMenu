import asyncio
import io
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator, model_validator

import storage
from auth import MEMBER, OWNER, Ctx
from core import APP_NAME, ApiError, audit, clean, db, logger, new_id, now

router = APIRouter(prefix="/api/dashboard", tags=["menu"])

IMAGE_URL_RE = re.compile(r"^/(api/files/tokmenu/uploads/[A-Za-z0-9-]+/[A-Za-z0-9-]+\.webp|demo/[a-z0-9_-]+\.jpg)$")
OPT_ID_RE = re.compile(r"^[A-Za-z0-9-]{1,64}$")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
Image.MAX_IMAGE_PIXELS = 40_000_000


def check_image_url(value):
    if value and not IMAGE_URL_RE.match(value):
        raise ValueError("Invalid image reference")
    return value or None


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    name_km: str = Field(default="", max_length=60)


class ReorderIn(BaseModel):
    ids: List[str] = Field(max_length=500)


class OptionIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=60)
    name_km: str = Field(default="", max_length=60)
    price_delta: int = Field(default=0, ge=0, le=100_000_000)
    available: bool = True


class OptionGroupIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=60)
    name_km: str = Field(default="", max_length=60)
    min_select: int = Field(default=0, ge=0, le=20)
    max_select: int = Field(default=1, ge=1, le=20)
    options: List[OptionIn] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def check_bounds(self):
        if self.min_select > self.max_select:
            raise ValueError("Minimum choices cannot be more than maximum choices")
        if self.max_select > len(self.options):
            raise ValueError("Maximum choices cannot be more than the number of options")
        return self


class ItemIn(BaseModel):
    category_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    name_km: str = Field(default="", max_length=80)
    description: str = Field(default="", max_length=500)
    description_km: str = Field(default="", max_length=500)
    price: int = Field(ge=0, le=100_000_000)
    image_url: Optional[str] = None
    available: bool = True
    featured: bool = False
    option_groups: List[OptionGroupIn] = Field(default_factory=list, max_length=10)

    @field_validator("image_url")
    @classmethod
    def validate_image(cls, value):
        return check_image_url(value)


class AvailabilityIn(BaseModel):
    available: bool


def _normalize_groups(groups: List[OptionGroupIn]) -> list:
    seen, result = set(), []
    for g in groups:
        gd = g.model_dump()
        if not gd["id"] or not OPT_ID_RE.match(gd["id"]) or gd["id"] in seen:
            gd["id"] = new_id()
        seen.add(gd["id"])
        for o in gd["options"]:
            if not o["id"] or not OPT_ID_RE.match(o["id"]) or o["id"] in seen:
                o["id"] = new_id()
            seen.add(o["id"])
        gd["name"], gd["name_km"] = gd["name"].strip(), gd["name_km"].strip()
        result.append(gd)
    return result


async def _ensure_category(rid: str, category_id: str):
    if not await db.categories.find_one({"id": category_id, "restaurant_id": rid}, {"_id": 1}):
        raise ApiError(400, "INVALID_CATEGORY", "Please choose a valid category.")


async def _check_item_limit(ctx: Ctx):
    limit = ctx.plan["max_items"]
    if limit is None:
        return
    count = await db.items.count_documents({"restaurant_id": ctx.rid, "archived": False})
    if count >= limit:
        raise ApiError(403, "PLAN_LIMIT", f"Your {ctx.plan['name']} plan allows up to {limit} menu items. "
                                          "Upgrade to add more.")


async def _get_item(rid: str, item_id: str) -> dict:
    item = await db.items.find_one({"id": item_id, "restaurant_id": rid}, {"_id": 0})
    if not item:
        raise ApiError(404, "NOT_FOUND", "Menu item not found.")
    return item


async def _next_sort(collection, query) -> int:
    last = await collection.find(query, {"_id": 0, "sort_order": 1}).sort("sort_order", -1).limit(1).to_list(1)
    return (last[0]["sort_order"] + 1) if last else 0


# ---------- Categories ----------
@router.get("/categories")
async def list_categories(ctx: Ctx = Depends(MEMBER)):
    categories = await db.categories.find({"restaurant_id": ctx.rid}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    counts = await db.items.aggregate([
        {"$match": {"restaurant_id": ctx.rid, "archived": False}},
        {"$group": {"_id": "$category_id", "n": {"$sum": 1}}},
    ]).to_list(500)
    by_id = {c["_id"]: c["n"] for c in counts}
    for c in categories:
        c["item_count"] = by_id.get(c["id"], 0)
    return clean(categories)


@router.post("/categories")
async def create_category(body: CategoryIn, ctx: Ctx = Depends(OWNER)):
    ts = now()
    doc = {"id": new_id(), "restaurant_id": ctx.rid, "name": body.name.strip(), "name_km": body.name_km.strip(),
           "sort_order": await _next_sort(db.categories, {"restaurant_id": ctx.rid}), "archived": False,
           "created_at": ts, "updated_at": ts}
    await db.categories.insert_one(doc)
    return clean(doc)


@router.put("/categories/{category_id}")
async def update_category(category_id: str, body: CategoryIn, ctx: Ctx = Depends(OWNER)):
    res = await db.categories.update_one(
        {"id": category_id, "restaurant_id": ctx.rid},
        {"$set": {"name": body.name.strip(), "name_km": body.name_km.strip(), "updated_at": now()}})
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Category not found.")
    return {"ok": True}


@router.post("/categories/{category_id}/{action}")
async def toggle_category(category_id: str, action: str, ctx: Ctx = Depends(OWNER)):
    if action not in ("archive", "restore"):
        raise ApiError(404, "NOT_FOUND", "Not found.")
    res = await db.categories.update_one({"id": category_id, "restaurant_id": ctx.rid},
                                         {"$set": {"archived": action == "archive", "updated_at": now()}})
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Category not found.")
    return {"ok": True}


@router.post("/category-order")
async def reorder_categories(body: ReorderIn, ctx: Ctx = Depends(OWNER)):
    for index, cid in enumerate(body.ids):
        await db.categories.update_one({"id": cid, "restaurant_id": ctx.rid}, {"$set": {"sort_order": index}})
    return {"ok": True}


# ---------- Items ----------
@router.get("/items")
async def list_items(archived: str = "active", ctx: Ctx = Depends(MEMBER)):
    query = {"restaurant_id": ctx.rid}
    if archived == "active":
        query["archived"] = False
    elif archived == "archived":
        query["archived"] = True
    items = await db.items.find(query, {"_id": 0}).sort("sort_order", 1).to_list(2000)
    return clean(items)


@router.post("/items")
async def create_item(body: ItemIn, ctx: Ctx = Depends(OWNER)):
    await _ensure_category(ctx.rid, body.category_id)
    await _check_item_limit(ctx)
    ts = now()
    data = body.model_dump()
    data["option_groups"] = _normalize_groups(body.option_groups)
    doc = {"id": new_id(), "restaurant_id": ctx.rid, **data, "name": body.name.strip(),
           "sort_order": await _next_sort(db.items, {"restaurant_id": ctx.rid, "category_id": body.category_id}),
           "archived": False, "created_at": ts, "updated_at": ts}
    await db.items.insert_one(doc)
    return clean(doc)


@router.put("/items/{item_id}")
async def update_item(item_id: str, body: ItemIn, ctx: Ctx = Depends(OWNER)):
    current = await _get_item(ctx.rid, item_id)
    await _ensure_category(ctx.rid, body.category_id)
    data = body.model_dump()
    data["option_groups"] = _normalize_groups(body.option_groups)
    data["name"] = body.name.strip()
    if body.category_id != current["category_id"]:
        data["sort_order"] = await _next_sort(db.items, {"restaurant_id": ctx.rid, "category_id": body.category_id})
    data["updated_at"] = now()
    await db.items.update_one({"id": item_id, "restaurant_id": ctx.rid}, {"$set": data})
    return clean(await _get_item(ctx.rid, item_id))


@router.post("/items/{item_id}/duplicate")
async def duplicate_item(item_id: str, ctx: Ctx = Depends(OWNER)):
    item = await _get_item(ctx.rid, item_id)
    await _check_item_limit(ctx)
    ts = now()
    copy = {**item, "id": new_id(), "name": f"{item['name']} (copy)"[:80], "archived": False,
            "sort_order": await _next_sort(db.items, {"restaurant_id": ctx.rid, "category_id": item["category_id"]}),
            "created_at": ts, "updated_at": ts}
    copy["option_groups"] = _normalize_groups([OptionGroupIn(**{**g, "id": None, "options": [
        {**o, "id": None} for o in g["options"]]}) for g in item.get("option_groups", [])])
    await db.items.insert_one(copy)
    return clean(copy)


@router.post("/items/{item_id}/archive")
async def archive_item(item_id: str, ctx: Ctx = Depends(OWNER)):
    await _get_item(ctx.rid, item_id)
    await db.items.update_one({"id": item_id, "restaurant_id": ctx.rid}, {"$set": {"archived": True, "updated_at": now()}})
    return {"ok": True}


@router.post("/items/{item_id}/restore")
async def restore_item(item_id: str, ctx: Ctx = Depends(OWNER)):
    await _get_item(ctx.rid, item_id)
    await _check_item_limit(ctx)
    await db.items.update_one({"id": item_id, "restaurant_id": ctx.rid}, {"$set": {"archived": False, "updated_at": now()}})
    return {"ok": True}


@router.patch("/items/{item_id}/availability")
async def set_availability(item_id: str, body: AvailabilityIn, ctx: Ctx = Depends(MEMBER)):
    if not ctx.is_owner and not ctx.membership.get("can_manage_availability"):
        raise ApiError(403, "FORBIDDEN", "You are not allowed to change item availability.")
    await _get_item(ctx.rid, item_id)
    await db.items.update_one({"id": item_id, "restaurant_id": ctx.rid},
                              {"$set": {"available": body.available, "updated_at": now()}})
    await audit("item.availability", actor=ctx.user, restaurant_id=ctx.rid, target_type="item", target_id=item_id,
                meta={"available": body.available})
    return {"ok": True, "available": body.available}


@router.post("/item-order")
async def reorder_items(body: ReorderIn, ctx: Ctx = Depends(OWNER)):
    for index, iid in enumerate(body.ids):
        await db.items.update_one({"id": iid, "restaurant_id": ctx.rid}, {"$set": {"sort_order": index}})
    return {"ok": True}


# ---------- Uploads ----------
def _process_image(data: bytes, kind: str) -> bytes:
    with Image.open(io.BytesIO(data)) as probe:
        probe.verify()
    image = Image.open(io.BytesIO(data))
    if image.format not in ("JPEG", "PNG", "WEBP"):
        raise ValueError("unsupported format")
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
    max_side = {"cover": 1600, "logo": 512}.get(kind, 1200)
    image.thumbnail((max_side, max_side))
    out = io.BytesIO()
    image.save(out, "WEBP", quality=82, method=4)
    return out.getvalue()


@router.post("/uploads")
async def upload_image(file: UploadFile = File(...), kind: str = Form("item"), ctx: Ctx = Depends(OWNER)):
    if file.content_type not in ALLOWED_TYPES:
        raise ApiError(400, "INVALID_FILE", "Please upload a JPG, PNG or WebP image.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "Images must be 5 MB or smaller.")
    try:
        processed = await asyncio.to_thread(_process_image, data, kind)
    except Exception:
        raise ApiError(400, "INVALID_FILE", "This file is not a valid image.")
    path = f"{APP_NAME}/uploads/{ctx.rid}/{uuid.uuid4()}.webp"
    try:
        result = await storage.put_object(path, processed, "image/webp")
    except Exception as exc:
        logger.error("Upload failed: %s", exc)
        raise ApiError(502, "UPLOAD_FAILED", "Upload failed. Please try again.")
    await db.files.insert_one({
        "id": new_id(), "restaurant_id": ctx.rid, "storage_path": result["path"], "content_type": "image/webp",
        "size": len(processed), "original_filename": (file.filename or "")[:120], "kind": kind,
        "is_deleted": False, "uploaded_by": ctx.user["id"], "created_at": now(),
    })
    return {"url": f"/api/files/{result['path']}"}
