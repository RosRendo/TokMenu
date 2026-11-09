import base64
import hashlib
import hmac
import json
import os
import requests
from datetime import datetime, timezone
from typing import Optional
from core import logger


def crc16_ccitt(data: str) -> str:
    """Calculate CRC16-CCITT (polynomial 0x1021, init 0xFFFF)."""
    crc = 0xFFFF
    for b in data.encode("utf-8"):
        crc ^= (b << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def tlv(tag: str, val: str) -> str:
    """Format Tag-Length-Value according to EMVCo specification."""
    val_str = str(val)
    return f"{tag}{len(val_str.encode('utf-8')):02d}{val_str}"


def get_payment_config(restaurant: dict = None) -> dict:
    settings = (restaurant or {}).get("settings", {})
    payment = settings.get("payment") or {}

    aba_merchant_id = payment.get("aba_merchant_id") or os.environ.get("ABA_MERCHANT_ID", "")
    aba_api_key = payment.get("aba_api_key") or os.environ.get("ABA_API_KEY", "")
    aba_base_url = payment.get("aba_base_url") or os.environ.get("ABA_BASE_URL", "https://checkout-sandbox.payway.com.kh")

    khqr_bakong_account = payment.get("khqr_bakong_account") or os.environ.get("KHQR_BAKONG_ACCOUNT", "")
    khqr_merchant_name = payment.get("khqr_merchant_name") or os.environ.get("KHQR_MERCHANT_NAME") or (restaurant or {}).get("name", "Tok Menu")
    khqr_merchant_city = payment.get("khqr_merchant_city") or os.environ.get("KHQR_MERCHANT_CITY", "Phnom Penh")

    return {
        "aba_enabled": payment.get("aba_enabled", bool(aba_merchant_id and aba_api_key)),
        "aba_merchant_id": aba_merchant_id.strip(),
        "aba_api_key": aba_api_key.strip(),
        "aba_base_url": aba_base_url.rstrip("/"),
        "khqr_enabled": payment.get("khqr_enabled", bool(khqr_bakong_account)),
        "khqr_bakong_account": khqr_bakong_account.strip(),
        "khqr_merchant_name": khqr_merchant_name.strip()[:25],
        "khqr_merchant_city": khqr_merchant_city.strip()[:15],
    }


def generate_khqr_payload(amount: float, order_code: str, currency: str = "USD",
                          table_label: str = "Counter", restaurant: dict = None) -> dict:
    """
    Generate EMV-compliant KHQR payload string for Bakong and banking apps.
    """
    config = get_payment_config(restaurant)
    bakong_acc = config["khqr_bakong_account"] or "ros_rendo@bkrt"
    m_name = config["khqr_merchant_name"] or "Tok Menu"
    m_city = config["khqr_merchant_city"] or "Phnom Penh"

    # Currency code: 840 = USD, 116 = KHR
    curr_code = "116" if currency.upper() == "KHR" else "840"
    amt_str = f"{int(amount)}" if currency.upper() == "KHR" else f"{amount:.2f}"

    # Tag 29: Merchant Account Information (Bakong)
    sub29 = tlv("00", bakong_acc)
    sub29 += tlv("01", config.get("aba_merchant_id", "ec462928"))
    tag29 = tlv("29", sub29)

    # Tag 62: Additional Data Field (Bill Number, Terminal)
    sub62 = tlv("01", order_code)
    if table_label:
        sub62 += tlv("07", table_label[:15])
    tag62 = tlv("62", sub62)

    # Build primary EMV body
    raw = ""
    raw += tlv("00", "01")                     # Payload Format Indicator
    raw += tlv("01", "12")                     # Point of Initiation: 12 (Dynamic QR)
    raw += tag29                              # Merchant Account Info
    raw += tlv("52", "5814")                   # Merchant Category Code (Restaurants)
    raw += tlv("53", curr_code)                # Transaction Currency
    raw += tlv("54", amt_str)                  # Transaction Amount
    raw += tlv("58", "KH")                     # Country Code
    raw += tlv("59", m_name)                   # Merchant Name
    raw += tlv("60", m_city)                   # Merchant City
    raw += tag62                              # Additional data
    raw += "6304"                              # CRC tag and length placeholder

    checksum = crc16_ccitt(raw)
    full_qr_string = raw + checksum

    return {
        "success": True,
        "provider": "khqr",
        "qr_string": full_qr_string,
        "amount": amt_str,
        "currency": currency,
        "merchant_name": m_name,
        "bakong_account": bakong_acc,
        "order_code": order_code,
    }


def generate_aba_hash(data: dict, api_key: str) -> str:
    """
    Hash format: req_time + merchant_id + tran_id + amount + items + payment_option + currency
    """
    concat = f"{data['req_time']}{data['merchant_id']}{data['tran_id']}{data['amount']}{data['items']}{data['payment_option']}{data['currency']}"
    return base64.b64encode(hmac.new(api_key.encode("utf-8"), concat.encode("utf-8"), hashlib.sha512).digest()).decode("utf-8")


def generate_aba_qr(amount: float, order_code: str, currency: str = "USD",
                    table_label: str = "Counter", restaurant: dict = None) -> dict:
    """
    Generate ABA PayWay QR and deep link via PayWay API.
    """
    config = get_payment_config(restaurant)
    m_id = config["aba_merchant_id"]
    api_key = config["aba_api_key"]
    base_url = config["aba_base_url"]

    if not m_id or not api_key:
        # Fallback to KHQR if ABA credentials missing
        return generate_khqr_payload(amount, order_code, currency, table_label, restaurant)

    now_utc = datetime.now(timezone.utc)
    req_time = now_utc.strftime("%Y%m%d%H%M%S")
    tran_id = f"TM-{order_code}"
    amt_str = f"{amount:.2f}" if currency.upper() == "USD" else f"{amount:.0f}"

    r_name = (restaurant or {}).get("name", "Tok Menu")
    items = [{"name": f"{r_name} - {table_label}", "quantity": 1, "price": amt_str}]
    items_base64 = base64.b64encode(json.dumps(items).encode("utf-8")).decode("utf-8")

    req_data = {
        "req_time": req_time,
        "merchant_id": m_id,
        "tran_id": tran_id,
        "first_name": "Tok",
        "last_name": "Customer",
        "email": "customer@tokmenu.app",
        "phone": "012345678",
        "amount": amt_str,
        "purchase_type": "purchase",
        "payment_option": "abapay_khqr",
        "items": items_base64,
        "currency": currency.upper(),
        "callback_url": base64.b64encode(f"{base_url}/api/public/payment/aba/callback".encode("utf-8")).decode("utf-8"),
        "return_deeplink": None,
        "custom_fields": None,
        "return_params": None,
        "payout": None,
        "lifetime": 15,
        "qr_image_template": "template3_color",
    }
    req_data["hash"] = generate_aba_hash(req_data, api_key)

    api_endpoint = f"{base_url}/api/payment-gateway/v1/payments/generate-qr"
    try:
        resp = requests.post(api_endpoint, json=req_data, headers={"Content-Type": "application/json"}, timeout=8)
        if resp.status_code == 200:
            res_json = resp.json()
            return {
                "success": True,
                "provider": "aba",
                "qr_code": res_json.get("qr_code") or res_json.get("qr_string"),
                "qr_image": res_json.get("qr_image"),
                "deeplink": res_json.get("abapay_deeplink"),
                "transaction_id": tran_id,
                "amount": amt_str,
                "currency": currency,
            }
        else:
            logger.warning("ABA QR API responded %s: %s. Using compliant KHQR fallback.", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("ABA QR API request exception: %s. Using compliant KHQR fallback.", exc)

    # Seamless fallback to compliant KHQR if sandbox network or sandbox gateway is unreachable
    khqr_res = generate_khqr_payload(amount, order_code, currency, table_label, restaurant)
    khqr_res["provider"] = "aba"
    khqr_res["fallback"] = True
    return khqr_res

