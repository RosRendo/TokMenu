import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import (PLANS, PricingError, can_transition, csv_safe, display_code, format_money,  # noqa: E402
                      generate_order_code, is_open_at, normalize_order_code, ordering_status, percent_of,
                      plan_for, price_cart, slugify, subscription_active, valid_slug, within_limit)

NOW = datetime(2026, 3, 4, 5, 0, tzinfo=timezone.utc)  # 12:00 in Phnom Penh, Wednesday


def make_item(**kw):
    item = {"id": "i1", "name": "Iced Coffee", "price": 150, "available": True, "option_groups": [
        {"id": "g-size", "name": "Size", "min_select": 1, "max_select": 1, "options": [
            {"id": "o-reg", "name": "Regular", "price_delta": 0, "available": True},
            {"id": "o-large", "name": "Large", "price_delta": 50, "available": True}]},
        {"id": "g-add", "name": "Add-ons", "min_select": 0, "max_select": 2, "options": [
            {"id": "o-shot", "name": "Extra shot", "price_delta": 25, "available": True},
            {"id": "o-jelly", "name": "Jelly", "price_delta": 25, "available": False},
            {"id": "o-foam", "name": "Foam", "price_delta": 30, "available": True}]}]}
    item.update(kw)
    return item


def line(**kw):
    base = {"item_id": "i1", "quantity": 2, "selections": [{"group_id": "g-size", "option_ids": ["o-large"]}]}
    base.update(kw)
    return base


class TestPricing:
    def test_server_calculates_totals_with_options(self):
        result = price_cart([line(selections=[{"group_id": "g-size", "option_ids": ["o-large"]},
                                              {"group_id": "g-add", "option_ids": ["o-shot"]}])],
                            {"i1": make_item()}, {})
        assert result["lines"][0]["unit_price"] == 225
        assert result["subtotal"] == 450 and result["total"] == 450

    def test_service_charge_and_tax(self):
        result = price_cart([line()], {"i1": make_item()}, {"service_charge_bps": 500, "tax_bps": 1000})
        assert result["subtotal"] == 400
        assert result["service_charge"] == 20
        assert result["tax"] == 42
        assert result["total"] == 462

    def test_snapshot_contains_names_and_prices(self):
        result = price_cart([line()], {"i1": make_item()}, {})
        opt = result["lines"][0]["options"][0]
        assert opt["name"] == "Large" and opt["group_name"] == "Size" and opt["price_delta"] == 50

    def test_required_option_missing(self):
        with pytest.raises(PricingError) as err:
            price_cart([line(selections=[])], {"i1": make_item()}, {})
        assert err.value.code == "OPTION_REQUIRED"

    def test_too_many_options(self):
        with pytest.raises(PricingError) as err:
            price_cart([line(selections=[{"group_id": "g-size", "option_ids": ["o-reg", "o-large"]}])],
                       {"i1": make_item()}, {})
        assert err.value.code == "INVALID_OPTIONS"

    def test_unknown_option_or_group(self):
        for sel in ([{"group_id": "g-size", "option_ids": ["nope"]}], [{"group_id": "nope", "option_ids": []}]):
            with pytest.raises(PricingError):
                price_cart([line(selections=sel)], {"i1": make_item()}, {})

    def test_duplicate_option_rejected(self):
        with pytest.raises(PricingError):
            price_cart([line(selections=[{"group_id": "g-size", "option_ids": ["o-reg"]},
                                         {"group_id": "g-add", "option_ids": ["o-shot", "o-shot"]}])],
                       {"i1": make_item()}, {})

    def test_unavailable_option(self):
        with pytest.raises(PricingError) as err:
            price_cart([line(selections=[{"group_id": "g-size", "option_ids": ["o-reg"]},
                                         {"group_id": "g-add", "option_ids": ["o-jelly"]}])],
                       {"i1": make_item()}, {})
        assert err.value.code == "OPTION_UNAVAILABLE"

    def test_unavailable_item(self):
        with pytest.raises(PricingError) as err:
            price_cart([line()], {"i1": make_item(available=False)}, {})
        assert err.value.code == "ITEM_UNAVAILABLE"

    def test_item_from_other_restaurant_not_found(self):
        with pytest.raises(PricingError) as err:
            price_cart([line(item_id="foreign")], {"i1": make_item()}, {})
        assert err.value.code == "ITEM_NOT_FOUND"

    def test_invalid_quantity(self):
        for qty in (0, 51):
            with pytest.raises(PricingError):
                price_cart([line(quantity=qty)], {"i1": make_item()}, {})

    def test_percent_rounds_half_up(self):
        assert percent_of(105, 1000) == 11
        assert percent_of(104, 1000) == 10
        assert percent_of(0, 1000) == 0


class TestStateMachine:
    @pytest.mark.parametrize("a,b", [("PENDING", "ACCEPTED"), ("PENDING", "REJECTED"), ("ACCEPTED", "PREPARING"),
                                     ("PREPARING", "READY"), ("READY", "COMPLETED")])
    def test_allowed(self, a, b):
        assert can_transition(a, b)

    @pytest.mark.parametrize("a,b", [("PENDING", "COMPLETED"), ("PENDING", "READY"), ("ACCEPTED", "REJECTED"),
                                     ("COMPLETED", "PENDING"), ("REJECTED", "ACCEPTED"), ("READY", "PREPARING"),
                                     ("PENDING", "PAID"), ("COMPLETED", "COMPLETED")])
    def test_blocked(self, a, b):
        assert not can_transition(a, b)


class TestMoney:
    def test_usd(self):
        assert format_money(350, "USD") == "$3.50"
        assert format_money(123456, "USD") == "$1,234.56"
        assert format_money(5, "USD") == "$0.05"
        assert format_money(-150, "USD") == "-$1.50"

    def test_khr(self):
        assert format_money(12000, "KHR") == "12,000៛"
        assert format_money(500, "KHR") == "500៛"


class TestPlans:
    def test_limits(self):
        trial = PLANS["trial"]
        assert within_limit(trial["max_items"], 24)
        assert not within_limit(trial["max_items"], 25)
        assert not within_limit(trial["max_staff"], 0)
        assert within_limit(PLANS["starter"]["max_items"], 10_000)
        assert not within_limit(PLANS["starter"]["max_staff"], 2)

    def test_plan_for_defaults_to_trial(self):
        assert plan_for(None)["key"] == "trial"
        assert plan_for({"plan": "pro"})["advanced_reports"]

    def test_subscription_active(self):
        assert subscription_active({"status": "active", "current_period_end": NOW + timedelta(days=1)}, NOW)
        assert not subscription_active({"status": "active", "current_period_end": NOW - timedelta(days=1)}, NOW)
        assert not subscription_active({"status": "expired", "current_period_end": None}, NOW)


class TestHours:
    def hours(self, open_, close, closed=False):
        return [{"day": d, "closed": closed, "open": open_, "close": close} for d in range(7)]

    def test_open_and_closed(self):
        assert is_open_at(self.hours("07:00", "21:00"), "Asia/Phnom_Penh", NOW)
        assert not is_open_at(self.hours("13:00", "21:00"), "Asia/Phnom_Penh", NOW)
        assert not is_open_at(self.hours("07:00", "21:00", closed=True), "Asia/Phnom_Penh", NOW)

    def test_overnight(self):
        late = datetime(2026, 3, 4, 18, 30, tzinfo=timezone.utc)  # 01:30 local
        assert is_open_at(self.hours("17:00", "02:00"), "Asia/Phnom_Penh", late)

    def test_ordering_status_reasons(self):
        sub = {"status": "active", "current_period_end": None}
        r = {"status": "active", "settings": {"opening_hours": [], "timezone": "Asia/Phnom_Penh"}}
        assert ordering_status(r, sub, NOW)["can_order"]
        assert ordering_status({**r, "status": "suspended"}, sub, NOW)["reason"] == "SUSPENDED"
        assert ordering_status(r, {"status": "expired"}, NOW)["reason"] == "ORDERING_PAUSED"
        closed = {**r, "settings": {**r["settings"], "temporarily_closed": True}}
        assert ordering_status(closed, sub, NOW)["reason"] == "TEMP_CLOSED"


class TestCodes:
    def test_order_code_shape(self):
        codes = {generate_order_code() for _ in range(500)}
        assert len(codes) == 500
        for c in codes:
            assert len(c) == 8 and not set(c) & set("01ILO")

    def test_normalize_and_display(self):
        assert normalize_order_code("k7m4-qx2p") == "K7M4QX2P"
        assert normalize_order_code("bad") is None
        assert display_code("K7M4QX2P") == "K7M4-QX2P"

    def test_slugs(self):
        assert slugify("Café Sabay!") == "cafe-sabay"
        assert slugify("ហាងកាហ្វេ") == "restaurant"
        assert valid_slug("cafe-sabay") and not valid_slug("admin") and not valid_slug("a") and not valid_slug("bad--slug")

    def test_csv_safe(self):
        assert csv_safe("=SUM(A1)") == "'=SUM(A1)"
        assert csv_safe("Table 1") == "Table 1"
