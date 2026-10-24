"""Transactional email through Emergent's managed Resend integration. Fixed server-side templates only."""
import ipaddress
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

from core import logger

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    if resp.status_code >= 400:
        try:
            code = resp.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning("Email paused: %s (%s)", code, resp.status_code)
        else:
            logger.error("Email send failed: %s", resp.status_code)
        resp.raise_for_status()
    return resp.json().get("id")


def _layout(inner: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8">'
        '<tr><td style="padding:32px 16px">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #E7E5E0;border-radius:12px">'
        '<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#1C1C1C;font-size:15px;line-height:1.6">'
        f'<p style="font-size:18px;font-weight:bold;margin:0 0 16px">{escape(EMAIL_FROM_NAME)}</p>'
        f"{inner}"
        f'<p style="font-size:12px;color:#8A8A8A;margin-top:28px">Sent by {escape(EMAIL_FROM_NAME)}. '
        "We never ask for your password or payment details by email.</p>"
        "</td></tr></table></td></tr></table>"
    )


def _button(url: str, label: str) -> str:
    return (
        f'<p style="margin:24px 0"><a href="{escape(url, quote=True)}" '
        'style="background:#B94A00;color:#ffffff;text-decoration:none;padding:12px 20px;'
        f'border-radius:8px;display:inline-block;font-weight:bold">{escape(label)}</a></p>'
    )


async def _safe_send(to: str, subject: str, html: str) -> bool:
    try:
        await send_email(to=to, subject=subject, html=html)
        return True
    except Exception as exc:
        logger.error("Email to recipient failed: %s", type(exc).__name__)
        return False


async def send_password_reset(email: str, name: str, url: str) -> bool:
    inner = (
        f"<p>Hi {escape(name or 'there')},</p>"
        "<p>We received a request to reset the password for your account. "
        "This link works once and expires in 1 hour.</p>"
        f"{_button(url, 'Choose a new password')}"
        "<p>If you did not request this, you can ignore this email. Your password will stay the same.</p>"
    )
    return await _safe_send(email, f"Reset your {EMAIL_FROM_NAME} password", _layout(inner))


async def send_staff_invite(email: str, inviter: str, restaurant_name: str, url: str) -> bool:
    inner = (
        "<p>Hello,</p>"
        f"<p>{escape(inviter or 'The owner')} invited you to help run <strong>{escape(restaurant_name)}</strong> "
        f"on {escape(EMAIL_FROM_NAME)}. You will be able to see and manage incoming orders.</p>"
        f"{_button(url, 'Accept invitation')}"
        "<p>This invitation expires in 7 days.</p>"
    )
    return await _safe_send(email, f"You're invited to {restaurant_name} on {EMAIL_FROM_NAME}", _layout(inner))
