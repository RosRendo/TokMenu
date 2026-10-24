"""E2E API regression tests for Tok Menu (public ordering, auth, roles, orders, menu, tables, settings, admin)."""
import io
import uuid

import pytest

from tests.conftest import API, BASE_URL, idem, make_session

KUY_TEAV = "edcde994-77bc-450c-8320-41ab14f37c9f"   # required group 1..1
KUY_GROUP = "6329b12c-e35c-4af4-a5ce-aa001a7b06b5"
KUY_OPT_PLUS100 = "cd20345b-8340-40e0-a9a7-231d9e40dcca"
FISH_AMOK = "c5324749-fa8e-4bcb-916d-5ef9b17b807d"   # 650, no options
PUMPKIN_SOLD_OUT = "9075bc85-f717-4595-ba47-d75822e28b11"


def code_of(r):
    return r.json()["detail"]["code"]


# ---------- Health / public ----------
class TestPublic:
    def test_health_and_plans(self, anon):
        assert anon.get(f"{API}/health").json() == {"ok": True}
        plans = anon.get(f"{API}/public/plans").json()
        assert plans["trial_days"] == 14 and len(plans["plans"]) >= 3

    def test_demo_menu(self, demo_menu):
        assert demo_menu["suspended"] is False
        assert demo_menu["restaurant"]["is_demo"] is True
        assert demo_menu["settings"]["currency"] == "USD"
        assert len(demo_menu["categories"]) > 0 and len(demo_menu["items"]) > 0

    def test_unknown_restaurant_404(self, anon):
        assert anon.get(f"{API}/public/menu/nope-{uuid.uuid4().hex[:6]}").status_code == 404

    def test_invalid_table_token(self, anon):
        r = anon.get(f"{API}/public/menu/demo/table/badtoken123")
        assert r.status_code == 404 and code_of(r) == "TABLE_NOT_FOUND"


# ---------- Ordering: pricing, idempotency, validation ----------
class TestOrdering:
    def test_tampered_price_ignored_and_idempotent(self, anon):
        key = idem()
        body = {"idempotency_key": key, "total": 1, "price": 1, "restaurant_id": "x", "table_id": "y",
                "items": [{"item_id": FISH_AMOK, "quantity": 2, "price": 1, "line_total": 1},
                          {"item_id": KUY_TEAV, "quantity": 1,
                           "selections": [{"group_id": KUY_GROUP, "option_ids": [KUY_OPT_PLUS100]}]}]}
        r1 = anon.post(f"{API}/public/menu/demo/orders", json=body)
        assert r1.status_code == 200, r1.text
        o = r1.json()["order"]
        assert o["subtotal"] == 650 * 2 + 350 + 100
        assert o["status"] == "PENDING" and o["payment_status"] == "unpaid"
        assert len(o["code"].replace("-", "")) == 8
        r2 = anon.post(f"{API}/public/menu/demo/orders", json=body)
        assert r2.status_code == 200 and r2.json()["duplicate"] is True
        assert r2.json()["order"]["code"] == o["code"]
        # public status page
        g = anon.get(f"{API}/public/orders/{o['code']}")
        assert g.status_code == 200 and g.json()["status"] == "PENDING"
        assert "restaurant_id" not in g.json() and "idempotency_key" not in g.json()

    def test_sold_out_rejected(self, anon):
        r = anon.post(f"{API}/public/menu/demo/orders", json={
            "idempotency_key": idem(), "items": [{"item_id": PUMPKIN_SOLD_OUT, "quantity": 1}]})
        assert r.status_code == 409, r.text

    def test_missing_required_option_rejected(self, anon):
        r = anon.post(f"{API}/public/menu/demo/orders", json={
            "idempotency_key": idem(), "items": [{"item_id": KUY_TEAV, "quantity": 1}]})
        assert r.status_code == 409, r.text

    def test_quantity_limit(self, anon):
        r = anon.post(f"{API}/public/menu/demo/orders", json={
            "idempotency_key": idem(), "items": [{"item_id": FISH_AMOK, "quantity": 51}]})
        assert r.status_code == 422
        r = anon.post(f"{API}/public/menu/demo/orders", json={
            "idempotency_key": idem(), "items": [{"item_id": FISH_AMOK, "quantity": 0}]})
        assert r.status_code == 422

    def test_invalid_table_token_order(self, anon):
        r = anon.post(f"{API}/public/menu/demo/orders", json={
            "idempotency_key": idem(), "table_token": "invalidtoken000",
            "items": [{"item_id": FISH_AMOK, "quantity": 1}]})
        assert r.status_code == 400 and code_of(r) == "TABLE_NOT_FOUND"

    def test_unknown_order_404(self, anon):
        assert anon.get(f"{API}/public/orders/ZZZZ-ZZZZ").status_code == 404


# ---------- Auth ----------
class TestAuth:
    def test_wrong_password(self):
        s = make_session()
        r = s.post(f"{API}/auth/login", json={"email": "owner@demo.tokmenu.app", "password": "nope-wrong"})
        assert r.status_code == 401

    def test_me_roles(self, owner, staff, admin):
        assert owner.get(f"{API}/auth/me").json()["membership"]["role"] == "owner"
        assert staff.get(f"{API}/auth/me").json()["membership"]["role"] == "staff"
        assert admin.get(f"{API}/auth/me").json()["user"]["is_platform_admin"] is True

    def test_forgot_generic(self, anon):
        r1 = anon.post(f"{API}/auth/forgot-password", json={"email": "nobody_x@example.com"})
        assert r1.status_code == 200 and r1.json() == {"ok": True}

    def test_reset_invalid_token(self, anon):
        r = anon.post(f"{API}/auth/reset-password", json={"token": "invalidtoken1234", "password": "Whatever#123"})
        assert r.status_code == 400 and code_of(r) == "INVALID_TOKEN"

    def test_bad_origin_blocked(self, owner):
        r = owner.post(f"{API}/dashboard/tables", json={"label": "TEST_x"}, headers={"Origin": "https://evil.com"})
        assert r.status_code == 403

    def test_register_creates_trial(self, test_owner):
        assert test_owner.me["membership"]["role"] == "owner"
        b = test_owner.get(f"{API}/dashboard/billing")
        assert b.status_code == 200, b.text
        assert "trial" in str(b.json()).lower()

    def test_logout(self):
        s = make_session()
        s.post(f"{API}/auth/login", json={"email": "staff@demo.tokmenu.app", "password": "DemoStaff#2026"})
        assert s.post(f"{API}/auth/logout").status_code == 200
        assert s.get(f"{API}/auth/me").status_code == 401


# ---------- Role restrictions ----------
class TestRoles:
    @pytest.mark.parametrize("method,path", [
        ("get", "/dashboard/staff"), ("get", "/dashboard/analytics"), ("get", "/dashboard/tables"),
        ("get", "/dashboard/overview"), ("get", "/dashboard/billing"), ("post", "/dashboard/items")])
    def test_staff_forbidden(self, staff, method, path):
        r = getattr(staff, method)(f"{API}{path}", **({"json": {}} if method == "post" else {}))
        assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_staff_put_restaurant_forbidden(self, staff):
        r = staff.put(f"{API}/dashboard/restaurant", json={"name": "Hack", "slug": "demo"})
        assert r.status_code == 403

    def test_staff_can_see_orders_and_toggle_availability(self, staff):
        assert staff.get(f"{API}/dashboard/orders/active").status_code == 200
        r = staff.patch(f"{API}/dashboard/items/{FISH_AMOK}/availability", json={"available": True})
        assert r.status_code == 200 and r.json()["available"] is True

    def test_non_admin_admin_api(self, owner, staff):
        for s in (owner, staff):
            assert s.get(f"{API}/admin/stats").status_code == 403
            assert s.get(f"{API}/admin/restaurants").status_code == 403


# ---------- Tables + order board flow ----------
class TestTablesAndOrders:
    def test_table_order_full_flow(self, owner, staff, anon):
        label = f"TEST_T{uuid.uuid4().hex[:4]}"
        t = owner.post(f"{API}/dashboard/tables", json={"label": label})
        assert t.status_code == 200, t.text
        table = t.json()
        try:
            assert anon.get(f"{API}/public/menu/demo/table/{table['token']}").json()["label"] == label
            r = anon.post(f"{API}/public/menu/demo/orders", json={
                "idempotency_key": idem(), "table_token": table["token"],
                "items": [{"item_id": FISH_AMOK, "quantity": 1}]})
            assert r.status_code == 200, r.text
            order = r.json()["order"]
            assert order["table_label"] == label
            active = staff.get(f"{API}/dashboard/orders/active").json()["orders"]
            mine = [o for o in active if o["code"] == order["code"]]
            assert mine, "order not on board"
            oid = mine[0]["id"]
            # invalid transition
            bad = staff.post(f"{API}/dashboard/orders/{oid}/transition", json={"to": "COMPLETED"})
            assert bad.status_code == 409 and code_of(bad) == "INVALID_TRANSITION"
            for st in ("ACCEPTED", "PREPARING", "READY", "COMPLETED"):
                x = staff.post(f"{API}/dashboard/orders/{oid}/transition", json={"to": st})
                assert x.status_code == 200, x.text
                assert anon.get(f"{API}/public/orders/{order['code']}").json()["status"] == st
            p = staff.post(f"{API}/dashboard/orders/{oid}/payment", json={"status": "paid", "method": "cash"})
            assert p.status_code == 200 and p.json()["payment_status"] == "paid"
            p = staff.post(f"{API}/dashboard/orders/{oid}/payment", json={"status": "unpaid"})
            assert p.json()["payment_status"] == "unpaid"
            h = staff.get(f"{API}/dashboard/orders", params={"status": "COMPLETED", "q": order["code"][:4]}).json()
            assert any(o["id"] == oid for o in h["orders"])
            # regenerate token -> old token invalid
            old = table["token"]
            new = owner.post(f"{API}/dashboard/tables/{table['id']}/regenerate").json()["token"]
            assert new != old
            assert anon.get(f"{API}/public/menu/demo/table/{old}").status_code == 404
            assert anon.get(f"{API}/public/menu/demo/table/{new}").status_code == 200
        finally:
            assert owner.delete(f"{API}/dashboard/tables/{table['id']}").status_code == 200

    def test_reject_with_reason(self, owner, anon):
        r = anon.post(f"{API}/public/menu/demo/orders", json={
            "idempotency_key": idem(), "customer_label": "TEST_rej", "items": [{"item_id": FISH_AMOK, "quantity": 1}]})
        assert r.status_code == 200, r.text
        code = r.json()["order"]["code"]
        oid = [o for o in owner.get(f"{API}/dashboard/orders/active").json()["orders"] if o["code"] == code][0]["id"]
        x = owner.post(f"{API}/dashboard/orders/{oid}/transition", json={"to": "REJECTED", "reason": "Out of fish"})
        assert x.status_code == 200
        pub = anon.get(f"{API}/public/orders/{code}").json()
        assert pub["status"] == "REJECTED" and pub["reject_reason"] == "Out of fish"
        assert owner.post(f"{API}/dashboard/orders/{oid}/payment", json={"status": "paid"}).status_code == 409

    def test_bulk_tables(self, test_owner):
        r = test_owner.post(f"{API}/dashboard/tables/bulk", json={"prefix": "T", "start": 1, "count": 3})
        assert r.status_code == 200 and r.json()["created"] == 3
        # trial limit is 5
        r = test_owner.post(f"{API}/dashboard/tables/bulk", json={"prefix": "X", "start": 1, "count": 3})
        assert r.status_code == 403


# ---------- Menu management ----------
class TestMenu:
    def test_category_item_crud(self, owner, anon):
        c = owner.post(f"{API}/dashboard/categories", json={"name": "TEST_Cat", "name_km": "តេស្ត"})
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        item = {"category_id": cid, "name": "TEST_Item", "name_km": "មុខម្ហូប", "price": 375,
                "option_groups": [{"name": "Size", "min_select": 1, "max_select": 1,
                                   "options": [{"name": "S"}, {"name": "L", "price_delta": 100}]}]}
        i = owner.post(f"{API}/dashboard/items", json=item)
        assert i.status_code == 200, i.text
        iid = i.json()["id"]
        try:
            assert i.json()["option_groups"][0]["options"][1]["price_delta"] == 100
            u = owner.put(f"{API}/dashboard/items/{iid}", json={**item, "name": "TEST_Item2", "price": 400})
            assert u.status_code == 200 and u.json()["price"] == 400
            d = owner.post(f"{API}/dashboard/items/{iid}/duplicate")
            assert d.status_code == 200
            did = d.json()["id"]
            assert owner.post(f"{API}/dashboard/items/{did}/archive").status_code == 200
            pub_ids = [x["id"] for x in anon.get(f"{API}/public/menu/demo").json()["items"]]
            assert iid in pub_ids and did not in pub_ids
            assert owner.post(f"{API}/dashboard/items/{did}/restore").status_code == 200
            assert owner.post(f"{API}/dashboard/item-order", json={"ids": [did, iid]}).status_code == 200
            assert owner.patch(f"{API}/dashboard/items/{iid}/availability", json={"available": False}).status_code == 200
            owner.post(f"{API}/dashboard/items/{did}/archive")
        finally:
            owner.post(f"{API}/dashboard/items/{iid}/archive")
            owner.post(f"{API}/dashboard/categories/{cid}/archive")
        cats = owner.get(f"{API}/dashboard/categories").json()
        assert isinstance(cats, (list, dict))

    def test_upload_validation(self, owner):
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (50, 50), "red").save(buf, "PNG")
        hdr = {"Origin": BASE_URL}
        s = owner
        ct = s.headers.pop("Content-Type")
        try:
            ok = s.post(f"{API}/dashboard/uploads", files={"file": ("a.png", buf.getvalue(), "image/png")}, headers=hdr)
            assert ok.status_code == 200, ok.text
            url = ok.json()["url"]
            assert s.get(f"{BASE_URL}{url}").status_code == 200
            txt = s.post(f"{API}/dashboard/uploads", files={"file": ("a.txt", b"hello", "text/plain")}, headers=hdr)
            assert txt.status_code == 400
            fake = s.post(f"{API}/dashboard/uploads", files={"file": ("a.png", b"notanimage", "image/png")}, headers=hdr)
            assert fake.status_code == 400
            big = s.post(f"{API}/dashboard/uploads",
                         files={"file": ("b.jpg", b"\xff\xd8" + b"0" * (5 * 1024 * 1024 + 10), "image/jpeg")}, headers=hdr)
            assert big.status_code == 413
        finally:
            s.headers["Content-Type"] = ct


# ---------- Settings / analytics / staff / billing ----------
class TestOwnerPages:
    def test_analytics_and_csv(self, owner):
        a = owner.get(f"{API}/dashboard/analytics")
        assert a.status_code == 200 and "totals" in a.json()
        c = owner.get(f"{API}/dashboard/analytics/export")
        assert c.status_code == 200 and c.text.startswith("date,time,order_code")

    def test_trial_analytics_blocked(self, test_owner):
        assert test_owner.get(f"{API}/dashboard/analytics").status_code == 403

    def test_currency_and_closed_toggle(self, owner, anon):
        rest = owner.get(f"{API}/dashboard/restaurant").json()
        settings = rest.get("settings") or rest["restaurant"]["settings"]
        base = {k: settings.get(k) for k in ("currency", "service_charge_bps", "tax_bps", "default_language",
                                             "temporarily_closed", "opening_hours", "accent_color")}
        try:
            r = owner.put(f"{API}/dashboard/restaurant/settings", json={**base, "currency": "KHR",
                                                                        "temporarily_closed": True})
            assert r.status_code == 200, r.text
            m = anon.get(f"{API}/public/menu/demo").json()
            assert m["settings"]["currency"] == "KHR"
            assert m["status"]["can_order"] is False
            o = anon.post(f"{API}/public/menu/demo/orders", json={
                "idempotency_key": idem(), "items": [{"item_id": FISH_AMOK, "quantity": 1}]})
            assert o.status_code == 409 and code_of(o) == "ORDERING_UNAVAILABLE"
        finally:
            r = owner.put(f"{API}/dashboard/restaurant/settings", json=base)
            assert r.status_code == 200
        assert anon.get(f"{API}/public/menu/demo").json()["settings"]["currency"] == "USD"

    def test_staff_invite_accept_revoke(self, owner):
        email = f"test_staff_{uuid.uuid4().hex[:6]}@example.com"
        r = owner.post(f"{API}/dashboard/staff/invites", json={"email": email, "can_manage_availability": True})
        assert r.status_code == 200, r.text
        token = r.json()["invite_url"].split("token=")[1]
        s = make_session()
        info = s.get(f"{API}/auth/invites/{token}")
        assert info.status_code == 200 and info.json()["email"] == email
        acc = s.post(f"{API}/auth/invites/accept", json={"token": token, "name": "TEST Staff", "password": "TestStaff#1"})
        assert acc.status_code == 200, acc.text
        assert acc.json()["membership"]["role"] == "staff"
        mid = acc.json()["membership"]["id"]
        assert s.post(f"{API}/auth/invites/accept", json={"token": token, "password": "TestStaff#1"}).status_code == 400
        # second invite -> revoke
        r2 = owner.post(f"{API}/dashboard/staff/invites", json={"email": f"test_rev_{uuid.uuid4().hex[:6]}@example.com"})
        inv_id = r2.json()["invite"]["id"]
        assert owner.delete(f"{API}/dashboard/staff/invites/{inv_id}").status_code == 200
        # cleanup member
        assert owner.delete(f"{API}/dashboard/staff/{mid}").status_code == 200

    def test_support_upgrade_request(self, test_owner):
        r = test_owner.post(f"{API}/dashboard/support", json={"type": "upgrade", "subject": "TEST upgrade",
                                                              "message": "please", "requested_plan": "pro"})
        assert r.status_code == 200, r.text
        lst = test_owner.get(f"{API}/dashboard/support").json()
        assert "TEST upgrade" in str(lst)


# ---------- Tenant isolation ----------
class TestTenantIsolation:
    def test_cross_tenant(self, test_owner, owner):
        orders = owner.get(f"{API}/dashboard/orders").json()["orders"]
        oid = orders[0]["id"]
        assert test_owner.get(f"{API}/dashboard/orders/{oid}").status_code == 404
        assert test_owner.post(f"{API}/dashboard/orders/{oid}/transition", json={"to": "ACCEPTED"}).status_code == 404
        assert test_owner.post(f"{API}/dashboard/orders/{oid}/payment", json={"status": "paid"}).status_code == 404
        assert test_owner.put(f"{API}/dashboard/items/{FISH_AMOK}", json={
            "category_id": "x", "name": "hack", "price": 1}).status_code in (400, 404)
        assert test_owner.patch(f"{API}/dashboard/items/{FISH_AMOK}/availability",
                                json={"available": False}).status_code == 404
        assert test_owner.post(f"{API}/dashboard/items/{FISH_AMOK}/archive").status_code == 404
        tables = owner.get(f"{API}/dashboard/tables").json()
        if tables:
            assert test_owner.delete(f"{API}/dashboard/tables/{tables[0]['id']}").status_code == 404
            assert test_owner.post(f"{API}/dashboard/tables/{tables[0]['id']}/regenerate").status_code == 404
        ids = [o["id"] for o in test_owner.get(f"{API}/dashboard/orders").json()["orders"]]
        assert oid not in ids


# ---------- Platform admin ----------
class TestAdmin:
    def test_stats_list_support(self, admin):
        assert admin.get(f"{API}/admin/stats").status_code == 200
        rows = admin.get(f"{API}/admin/restaurants", params={"q": "demo"})
        assert rows.status_code == 200 and "demo" in rows.text
        assert admin.get(f"{API}/admin/support").status_code == 200

    def test_suspend_reactivate_test_restaurant(self, admin, test_owner, anon):
        rid = test_owner.me["restaurant"]["id"]
        slug = test_owner.me["restaurant"]["slug"]
        r = admin.post(f"{API}/admin/restaurants/{rid}/suspend", json={"reason": "TEST suspend"})
        assert r.status_code == 200
        try:
            assert anon.get(f"{API}/public/menu/{slug}").json()["suspended"] is True
            me = test_owner.get(f"{API}/auth/me").json()
            assert me["restaurant"]["status"] == "suspended"
        finally:
            assert admin.post(f"{API}/admin/restaurants/{rid}/reactivate").status_code == 200
        assert anon.get(f"{API}/public/menu/{slug}").json()["suspended"] is False

    def test_subscription_edit_and_ticket_reply(self, admin, test_owner):
        rid = test_owner.me["restaurant"]["id"]
        r = admin.put(f"{API}/admin/subscriptions/{rid}", json={"plan": "starter", "status": "active",
                                                                "current_period_end": "2026-12-31", "notes": "TEST"})
        assert r.status_code == 200, r.text
        assert "starter" in test_owner.get(f"{API}/dashboard/billing").text.lower()
        tickets = admin.get(f"{API}/admin/support").json()
        tickets = tickets.get("requests", tickets) if isinstance(tickets, dict) else tickets
        mine = [t for t in tickets if t.get("restaurant_id") == rid]
        if mine:
            x = admin.post(f"{API}/admin/support/{mine[0]['id']}/reply", json={"reply": "TEST ok", "resolve": True})
            assert x.status_code == 200, x.text
