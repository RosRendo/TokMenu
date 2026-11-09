import asyncio
import os
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from core import logger


def get_telegram_config(restaurant: dict = None) -> tuple[str, str, bool]:
    """
    Returns (bot_token, chat_id, enabled) from restaurant settings or environment fallback.
    """
    settings = (restaurant or {}).get("settings", {})
    tg = settings.get("telegram") or {}
    
    bot_token = tg.get("bot_token") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = tg.get("chat_id") or os.environ.get("TELEGRAM_CHAT_ID", "")
    
    # If explicitly set in restaurant settings, honor that boolean; otherwise enabled if credentials exist
    enabled = tg.get("enabled", True) if (bot_token and chat_id) else False
    return bot_token.strip(), str(chat_id).strip(), enabled


def format_order_telegram_message(order: dict, restaurant: dict) -> str:
    tz_name = restaurant.get("settings", {}).get("timezone", "Asia/Phnom_Penh")
    try:
        dt = order.get("created_at")
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        time_str = dt.astimezone(ZoneInfo(tz_name)).strftime("%d/%m/%Y %I:%M %p")
    except Exception:
        time_str = datetime.now().strftime("%d/%m/%Y %I:%M %p")

    r_name = restaurant.get("name", "Tok Menu")
    code = order.get("code", "N/A")
    daily_num = order.get("daily_number", 0)
    table = order.get("table_label") or order.get("customer_label") or "Counter"
    currency = order.get("currency", "USD")
    
    msg = f"🍽️ <b>NEW ORDER — {r_name}</b>\n\n"
    msg += f"🆔 <b>Code:</b> <code>{code}</code> (#{str(daily_num).padStart(3, '0') if hasattr(str(daily_num), 'padStart') else f'{daily_num:03d}'})\n"
    msg += f"📍 <b>Table/Customer:</b> {table}\n"
    msg += f"🕒 <b>Time:</b> {time_str}\n"
    msg += "━━━━━━━━━━━━━━━━━━\n\n"

    items = order.get("items", [])
    for it in items:
        qty = it.get("quantity", 1)
        name = it.get("name") or it.get("name_km") or "Item"
        unit_price = it.get("unit_price", 0) / 100.0 if currency == "USD" else it.get("unit_price", 0)
        line_total = it.get("line_total", 0) / 100.0 if currency == "USD" else it.get("line_total", 0)
        price_fmt = f"${unit_price:.2f}" if currency == "USD" else f"{unit_price:,.0f}៛"
        total_fmt = f"${line_total:.2f}" if currency == "USD" else f"{line_total:,.0f}៛"
        
        msg += f"• <b>{name}</b> × {qty} ({price_fmt}) = <b>{total_fmt}</b>\n"
        if it.get("options"):
            opts = [o.get("name", "") for o in it.get("options", []) if o.get("name")]
            if opts:
                msg += f"   <i>Options: {', '.join(opts)}</i>\n"
        if it.get("note"):
            msg += f"   <i>Note: {it.get('note')}</i>\n"

    msg += "\n━━━━━━━━━━━━━━━━━━\n"
    total_amount = order.get("total", 0) / 100.0 if currency == "USD" else order.get("total", 0)
    total_fmt = f"${total_amount:.2f}" if currency == "USD" else f"{total_amount:,.0f}៛"
    msg += f"💰 <b>TOTAL: {total_fmt}</b>\n"
    
    pay_method = order.get("payment_method") or "Cash at counter"
    pay_status = order.get("payment_status", "unpaid").upper()
    msg += f"💳 <b>Payment:</b> {pay_method.upper()} ({pay_status})\n"
    
    if order.get("note"):
        msg += f"📝 <b>Customer Note:</b> {order.get('note')}\n"

    return msg


async def send_telegram_order_notification(order: dict, restaurant: dict):
    bot_token, chat_id, enabled = get_telegram_config(restaurant)
    if not enabled or not bot_token or not chat_id:
        return

    text = format_order_telegram_message(order, restaurant)
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    def _post():
        return requests.post(url, json=payload, timeout=8)

    try:
        resp = await asyncio.to_thread(_post)
        if resp.status_code != 200:
            logger.error("Telegram notification failed: status=%s, response=%s", resp.status_code, resp.text)
        else:
            logger.info("Telegram notification sent for order %s to chat %s", order.get("code"), chat_id)
    except Exception as exc:
        logger.error("Failed to send Telegram notification: %s", exc)


async def send_test_telegram(bot_token: str, chat_id: str) -> dict:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": "🎉 <b>Tok Menu Telegram Bot Connected!</b>\n\nYour restaurant is now connected. You will receive live order alerts here.",
        "parse_mode": "HTML",
    }

    def _post():
        return requests.post(url, json=payload, timeout=8)

    try:
        resp = await asyncio.to_thread(_post)
        if resp.status_code == 200:
            return {"ok": True, "message": "Test notification delivered successfully!"}
        return {"ok": False, "error": resp.text}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

