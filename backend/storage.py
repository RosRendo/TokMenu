import asyncio
import os
from collections import OrderedDict

import requests

from core import logger

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key = None
_cache: "OrderedDict[str, tuple[bytes, str]]" = OrderedDict()
_CACHE_MAX = 300


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    for attempt in range(2):
        key = init_storage(force=attempt > 0)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code == 404 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("Storage upload failed")


def _get(path: str):
    for attempt in range(2):
        key = init_storage(force=attempt > 0)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
        if resp.status_code == 404 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    raise RuntimeError("Storage download failed")


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(_put, path, data, content_type)


async def get_object(path: str):
    if path in _cache:
        _cache.move_to_end(path)
        return _cache[path]
    result = await asyncio.to_thread(_get, path)
    _cache[path] = result
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return result


async def startup():
    try:
        await asyncio.to_thread(init_storage)
        logger.info("Object storage initialised")
    except Exception as exc:
        logger.error("Object storage init failed: %s", exc)
