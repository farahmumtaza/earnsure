import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Tests always run against the in-memory store with no artificial delay,
# with sign-in off unless a test turns it on.
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
os.environ.pop("AUTH_ENABLED", None)
os.environ.pop("AUTH_REQUIRE_MFA", None)


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient

    from earnsure import db
    from earnsure.providers.bank import DummyBankProvider

    db.get_store.cache_clear()
    monkeypatch.setattr(DummyBankProvider, "delay_seconds", 0)
    from index import app

    c = TestClient(app)
    assert c.post("/api/session").status_code == 200
    return c
