import re
import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from auth import OWNER, Ctx
from core import ApiError, audit, clean, db, new_id, now

router = APIRouter(prefix="/api/dashboard/tables", tags=["tables"])


class TableIn(BaseModel):
    label: str = Field(min_length=1, max_length=30)


class BulkTablesIn(BaseModel):
    prefix: str = Field(default="Table", min_length=1, max_length=20)
    start: int = Field(default=1, ge=0, le=999)
    count: int = Field(ge=1, le=50)


def _label(value: str) -> str:
    return " ".join(value.split())


def _natural(label: str):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", label)]


def new_table_token() -> str:
    return secrets.token_urlsafe(16)


async def _check_table_limit(ctx: Ctx, adding: int = 1):
    limit = ctx.plan["max_tables"]
    if limit is None:
        return
    count = await db.tables.count_documents({"restaurant_id": ctx.rid})
    if count + adding > limit:
        raise ApiError(403, "PLAN_LIMIT", f"Your {ctx.plan['name']} plan allows up to {limit} tables. Upgrade to add more.")


def table_doc(rid: str, label: str) -> dict:
    ts = now()
    return {"id": new_id(), "restaurant_id": rid, "label": label, "label_key": label.lower(),
            "token": new_table_token(), "created_at": ts, "updated_at": ts}


@router.get("")
async def list_tables(ctx: Ctx = Depends(OWNER)):
    tables = await db.tables.find({"restaurant_id": ctx.rid}, {"_id": 0, "label_key": 0}).to_list(1000)
    tables.sort(key=lambda t: _natural(t["label"]))
    return clean(tables)


@router.post("")
async def create_table(body: TableIn, ctx: Ctx = Depends(OWNER)):
    await _check_table_limit(ctx)
    doc = table_doc(ctx.rid, _label(body.label))
    try:
        await db.tables.insert_one(doc)
    except DuplicateKeyError:
        raise ApiError(409, "TABLE_EXISTS", "A table with this name already exists.")
    doc.pop("label_key", None)
    return clean(doc)


@router.post("/bulk")
async def create_tables_bulk(body: BulkTablesIn, ctx: Ctx = Depends(OWNER)):
    existing = set(await db.tables.distinct("label_key", {"restaurant_id": ctx.rid}))
    labels = [f"{_label(body.prefix)} {n}" for n in range(body.start, body.start + body.count)]
    labels = [lbl for lbl in labels if lbl.lower() not in existing]
    await _check_table_limit(ctx, len(labels))
    if labels:
        await db.tables.insert_many([table_doc(ctx.rid, lbl) for lbl in labels])
    return {"created": len(labels)}


@router.put("/{table_id}")
async def rename_table(table_id: str, body: TableIn, ctx: Ctx = Depends(OWNER)):
    label = _label(body.label)
    try:
        res = await db.tables.update_one({"id": table_id, "restaurant_id": ctx.rid},
                                         {"$set": {"label": label, "label_key": label.lower(), "updated_at": now()}})
    except DuplicateKeyError:
        raise ApiError(409, "TABLE_EXISTS", "A table with this name already exists.")
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Table not found.")
    return {"ok": True}


@router.post("/{table_id}/regenerate")
async def regenerate_token(table_id: str, ctx: Ctx = Depends(OWNER)):
    token = new_table_token()
    res = await db.tables.update_one({"id": table_id, "restaurant_id": ctx.rid},
                                     {"$set": {"token": token, "updated_at": now()}})
    if not res.matched_count:
        raise ApiError(404, "NOT_FOUND", "Table not found.")
    await audit("table.qr_regenerated", actor=ctx.user, restaurant_id=ctx.rid, target_type="table", target_id=table_id)
    return {"token": token}


@router.delete("/{table_id}")
async def delete_table(table_id: str, ctx: Ctx = Depends(OWNER)):
    res = await db.tables.delete_one({"id": table_id, "restaurant_id": ctx.rid})
    if not res.deleted_count:
        raise ApiError(404, "NOT_FOUND", "Table not found.")
    await audit("table.deleted", actor=ctx.user, restaurant_id=ctx.rid, target_type="table", target_id=table_id)
    return {"ok": True}
