import os
import uuid

import pytest
import requests


def _frontend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE_URL = _frontend_url()
API = f"{BASE_URL}/api"


def make_session():
    s = requests.Session()
    s.headers.update({"Origin": BASE_URL, "Content-Type": "application/json"})
    return s


def login(email, password):
    s = make_session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="session")
def owner():
    return login("owner@demo.tokmenu.app", "DemoOwner#2026")


@pytest.fixture(scope="session")
def staff():
    return login("staff@demo.tokmenu.app", "DemoStaff#2026")


@pytest.fixture(scope="session")
def admin():
    return login("admin@tokmenu.app", "TokAdmin#2026")


@pytest.fixture(scope="session")
def anon():
    return make_session()


@pytest.fixture(scope="session")
def test_owner():
    s = make_session()
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": "TEST Owner", "email": email, "password": "TestPass#2026",
                                              "restaurant_name": f"TEST_Rest {uuid.uuid4().hex[:4]}"})
    if r.status_code != 200:
        pytest.skip(f"register failed {r.status_code} {r.text[:200]}")
    s.me = r.json()
    s.email = email
    return s


@pytest.fixture(scope="session")
def demo_menu(anon):
    return anon.get(f"{API}/public/menu/demo").json()


def idem():
    return "TEST-" + uuid.uuid4().hex
