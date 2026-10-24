"""Idempotent seeding: platform admin + clearly labelled demo restaurant.

Usage:
  python seed.py              # create anything missing (safe to run repeatedly)
  python seed.py --reset-demo # delete ONLY the demo restaurant's data and recreate it
"""
import asyncio
import os
import random
import sys
from datetime import timedelta

from auth import hash_password, new_user_doc, verify_password
from core import db, logger, new_id, now
from repo import create_restaurant, next_daily_number
from routes_tables import table_doc
from services import STATUS_TIMESTAMP, generate_order_code, local_date, price_cart

DEMO_SLUG = "demo"


def _group(name, name_km, min_select, max_select, options):
    return {"id": new_id(), "name": name, "name_km": name_km, "min_select": min_select, "max_select": max_select,
            "options": [{"id": new_id(), "name": n, "name_km": k, "price_delta": p, "available": True}
                        for n, k, p in options]}


def demo_menu():
    size = lambda big: _group("Size", "ទំហំ", 1, 1, [("Regular", "ធម្មតា", 0), ("Large", "ធំ", big)])  # noqa: E731
    return [
        ("Specials", "មុខម្ហូបពិសេស", [
            dict(name="Fish Amok", name_km="អាម៉ុកត្រី", price=650, image_url="/demo/amok.jpg", featured=True,
                 description="Steamed fish curry with kroeung, coconut milk and noni leaves, served in a banana-leaf cup with rice.",
                 description_km="ត្រីចំហុយជាមួយគ្រឿង ខ្ទិះដូង និងស្លឹកញ័រ បម្រើក្នុងស្លឹកចេកជាមួយបាយ។"),
            dict(name="Beef Lok Lak", name_km="ឡុកឡាក់សាច់គោ", price=600, image_url="/demo/loklak.jpg", featured=True,
                 description="Stir-fried marinated beef with tomato, onion and lettuce, with a Kampot pepper and lime dip.",
                 description_km="សាច់គោឆាជាមួយប៉េងប៉ោះ ខ្ទឹមបារាំង និងសាឡាត់ ជាមួយទឹកម្រេចកំពត និងក្រូចឆ្មា។",
                 option_groups=[_group("Add-ons", "បន្ថែម", 0, 2, [("Fried egg", "ពងមាន់ចៀន", 50),
                                                                   ("Extra rice", "បាយបន្ថែម", 50)])]),
        ]),
        ("Food", "ម្ហូប", [
            dict(name="Kuy Teav Phnom Penh", name_km="គុយទាវភ្នំពេញ", price=350, image_url="/demo/kuyteav.jpg",
                 description="Rice noodle soup with clear pork broth, minced pork, shrimp and fresh herbs.",
                 description_km="គុយទាវទឹកស៊ុបឆ្អឹងជ្រូក សាច់ជ្រូកចិញ្ច្រាំ បង្គា និងបន្លែស្រស់។",
                 option_groups=[size(100)]),
            dict(name="Bai Sach Chrouk", name_km="បាយសាច់ជ្រូក", price=250, image_url="/demo/baisach.jpg",
                 description="Grilled coconut-marinated pork over rice with pickled vegetables.",
                 description_km="សាច់ជ្រូកអាំងប្រឡាក់ខ្ទិះដូងលើបាយ ជាមួយជ្រក់។"),
            dict(name="Num Banh Chok", name_km="នំបញ្ចុក", price=250, image_url="/demo/numbanhchok.jpg",
                 description="Fresh rice noodles with green fish curry gravy and raw vegetables.",
                 description_km="នំបញ្ចុកជាមួយសម្លប្រហើរត្រី និងបន្លែស្រស់។"),
            dict(name="Chicken Fried Rice", name_km="បាយឆាសាច់មាន់", price=300, image_url="/demo/friedrice.jpg",
                 description="Wok-fried rice with chicken, egg and spring onion.",
                 description_km="បាយឆាជាមួយសាច់មាន់ ពងមាន់ និងស្លឹកខ្ទឹម។",
                 option_groups=[_group("Spice level", "កម្រិតហឹរ", 0, 1, [("Mild", "មិនសូវហឹរ", 0),
                                                                          ("Medium", "ហឹរមធ្យម", 0),
                                                                          ("Hot", "ហឹរខ្លាំង", 0)])]),
            dict(name="Khmer Chicken Curry", name_km="ការីសាច់មាន់", price=450, image_url="/demo/curry.jpg",
                 description="Mild red curry with chicken, sweet potato and lemongrass.",
                 description_km="ការីក្រហមមិនសូវហឹរ ជាមួយសាច់មាន់ ដំឡូងជ្វា និងស្លឹកគ្រៃ។",
                 option_groups=[_group("Served with", "ទទួលទានជាមួយ", 1, 1, [("Rice", "បាយ", 0),
                                                                             ("Baguette", "នំបុ័ង", 0)])]),
        ]),
        ("Drinks", "ភេសជ្ជៈ", [
            dict(name="Iced Coffee with Milk", name_km="កាហ្វេទឹកដោះគោទឹកកក", price=150, image_url="/demo/icedcoffee.jpg",
                 featured=True, description="Strong Cambodian coffee with sweetened condensed milk over ice.",
                 description_km="កាហ្វេខ្លាំងជាមួយទឹកដោះគោខាប់ និងទឹកកក។",
                 option_groups=[_group("Sweetness", "កម្រិតស្ករ", 1, 1, [("Normal", "ធម្មតា", 0),
                                                                         ("Less sweet", "ស្ករតិច", 0),
                                                                         ("No sugar", "គ្មានស្ករ", 0)]), size(50)]),
            dict(name="Fresh Coconut", name_km="ទឹកដូង", price=150, image_url="/demo/coconut.jpg",
                 description="Whole young coconut, chilled.", description_km="ដូងខ្ចីទាំងផ្លែ ត្រជាក់។"),
            dict(name="Iced Lemon Tea", name_km="តែក្រូចឆ្មាទឹកកក", price=125, image_url="/demo/lemontea.jpg",
                 description="Black tea with fresh lime and a little sugar.",
                 description_km="តែខ្មៅជាមួយក្រូចឆ្មាស្រស់ និងស្ករបន្តិច។"),
            dict(name="Drinking Water", name_km="ទឹកបរិសុទ្ធ", price=50, description="500 ml bottle.",
                 description_km="ដប ៥០០ មីលីលីត្រ។"),
        ]),
        ("Desserts", "បង្អែម", [
            dict(name="Mango Sticky Rice", name_km="បាយដំណើបស្វាយ", price=250, image_url="/demo/mango.jpg",
                 featured=True, description="Ripe mango with sweet coconut sticky rice.",
                 description_km="ស្វាយទុំជាមួយបាយដំណើបខ្ទិះដូង។"),
            dict(name="Pumpkin Custard", name_km="សង់ខ្យាល្ពៅ", price=200, available=False,
                 description="Steamed coconut custard in pumpkin. Sold out today in this demo.",
                 description_km="សង់ខ្យាចំហុយក្នុងល្ពៅ។"),
        ]),
    ]


async def _upsert_user(email, password, name, **extra):
    email = email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = new_user_doc(email, name, password, **extra)
        await db.users.insert_one(user)
    elif not verify_password(password, user["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
    if extra:
        await db.users.update_one({"email": email}, {"$set": extra})
    return await db.users.find_one({"email": email}, {"_id": 0})


async def seed_admin():
    await _upsert_user(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Platform Admin",
                       is_platform_admin=True)


async def _seed_orders(restaurant, items):
    rng = random.Random(7)
    sellable = [i for i in items if i.get("available", True)]
    tables = await db.tables.find({"restaurant_id": restaurant["id"]}, {"_id": 0}).to_list(20)
    settings = restaurant["settings"]
    plan = [(d, 3 + d % 3) for d in range(6, 0, -1)] + [(0, 3)]
    for days_ago, count in plan:
        for n in range(count):
            ts = now() - timedelta(days=days_ago, hours=rng.randint(0, 6), minutes=rng.randint(0, 59))
            lines = []
            for item in rng.sample(sellable, rng.randint(1, 3)):
                selections = [{"group_id": g["id"], "option_ids": [g["options"][0]["id"]]}
                              for g in item.get("option_groups", []) if g["min_select"] >= 1]
                lines.append({"item_id": item["id"], "quantity": rng.randint(1, 2), "selections": selections})
            priced = price_cart(lines, {i["id"]: i for i in items}, settings)
            if days_ago == 0:
                status = ["PENDING", "PREPARING", "COMPLETED"][n % 3]
            else:
                status = "REJECTED" if n == 0 and days_ago % 3 == 0 else "COMPLETED"
            table = rng.choice(tables)
            business_date = local_date(ts, settings["timezone"])
            order = {
                "id": new_id(), "restaurant_id": restaurant["id"], "code": generate_order_code(),
                "daily_number": await next_daily_number(restaurant["id"], business_date),
                "business_date": business_date, "status": status,
                "payment_status": "paid" if status == "COMPLETED" else "unpaid",
                "payment_method": "cash" if status == "COMPLETED" else None,
                "paid_at": ts + timedelta(minutes=40) if status == "COMPLETED" else None,
                "table_id": table["id"], "table_label": table["label"], "customer_label": "",
                "currency": settings["currency"], "items": priced["lines"], "subtotal": priced["subtotal"],
                "service_charge": priced["service_charge"], "tax": priced["tax"], "total": priced["total"],
                "service_charge_bps": 0, "tax_bps": 0, "note": "", "idempotency_key": f"demo-seed-{new_id()}",
                "reject_reason": "Kitchen closing (demo)" if status == "REJECTED" else None,
                "status_history": [{"status": "PENDING", "at": ts, "by": None}],
                "is_demo": True, "created_at": ts, "updated_at": ts,
            }
            if status != "PENDING":
                order[STATUS_TIMESTAMP[status]] = ts + timedelta(minutes=30)
            await db.orders.insert_one(order)


async def seed_demo():
    owner = await _upsert_user(os.environ["DEMO_OWNER_EMAIL"], os.environ["DEMO_OWNER_PASSWORD"], "Demo Owner")
    staff = await _upsert_user(os.environ["DEMO_STAFF_EMAIL"], os.environ["DEMO_STAFF_PASSWORD"], "Demo Staff")
    if await db.restaurants.find_one({"slug": DEMO_SLUG}, {"_id": 1}):
        return
    restaurant = await create_restaurant(owner, "Tok Demo Kitchen", slug=DEMO_SLUG, is_demo=True, plan="pro",
                                         sub_status="active", period_days=3650, extra={
            "name_km": "ផ្ទះបាយសាកល្បង តុ",
            "description": "Demo restaurant for trying Tok Menu. Dishes, prices and orders here are sample content.",
            "description_km": "ភោជនីយដ្ឋានសាកល្បងសម្រាប់សាកល្បង Tok Menu។ មុខម្ហូប តម្លៃ និងការបញ្ជាទិញ ជាទិន្នន័យគំរូ។",
            "address": "Phnom Penh (demo address)", "cover_url": "/demo/kuyteav.jpg",
        })
    restaurant["settings"]["opening_hours"] = [{"day": d, "closed": False, "open": "00:00", "close": "00:00"}
                                               for d in range(7)]
    await db.restaurants.update_one({"id": restaurant["id"]}, {"$set": {"settings": restaurant["settings"]}})
    if not await db.memberships.find_one({"user_id": staff["id"]}, {"_id": 1}):
        await db.memberships.insert_one({"id": new_id(), "user_id": staff["id"], "restaurant_id": restaurant["id"],
                                         "role": "staff", "can_manage_availability": True, "created_at": now()})
    items = []
    for c_index, (name, name_km, dishes) in enumerate(demo_menu()):
        category = {"id": new_id(), "restaurant_id": restaurant["id"], "name": name, "name_km": name_km,
                    "sort_order": c_index, "archived": False, "created_at": now(), "updated_at": now()}
        await db.categories.insert_one(category)
        for i_index, dish in enumerate(dishes):
            item = {"id": new_id(), "restaurant_id": restaurant["id"], "category_id": category["id"],
                    "description": "", "description_km": "", "image_url": None, "available": True,
                    "featured": False, "option_groups": [], **dish, "sort_order": i_index, "archived": False,
                    "created_at": now(), "updated_at": now()}
            await db.items.insert_one(item)
            items.append(item)
    labels = [f"Table {n}" for n in range(1, 7)] + ["Terrace 1", "Terrace 2"]
    await db.tables.insert_many([table_doc(restaurant["id"], label) for label in labels])
    await _seed_orders(restaurant, items)
    logger.info("Demo restaurant seeded at /menu/%s", DEMO_SLUG)


async def reset_demo():
    restaurant = await db.restaurants.find_one({"slug": DEMO_SLUG, "is_demo": True}, {"_id": 0})
    if restaurant:
        rid = restaurant["id"]
        for name in ("categories", "items", "tables", "orders", "memberships", "subscriptions", "invites"):
            await db[name].delete_many({"restaurant_id": rid})
        await db.counters.delete_many({"_id": {"$regex": f"^orders:{rid}:"}})
        await db.restaurants.delete_one({"id": rid})
    await seed_demo()


async def run_all():
    await seed_admin()
    await seed_demo()


if __name__ == "__main__":
    asyncio.run(reset_demo() if "--reset-demo" in sys.argv else run_all())
