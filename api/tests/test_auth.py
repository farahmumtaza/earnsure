import pytest
from fastapi.testclient import TestClient

from earnsure import auth, db


def test_config_default_is_dummy_sign_in():
    from index import app
    assert TestClient(app).get("/api/auth/config").json() == {"enabled": False, "require_mfa": False}


@pytest.fixture
def signed_in(monkeypatch):
    """Sign-in on, with Supabase's token check replaced by fake tokens: '<user>:<aal>'."""
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")
    db.get_store.cache_clear()
    monkeypatch.setattr(db, "get_store", lambda _s=db.MemoryStore(): _s)

    def fake_verify(token: str) -> auth.AuthUser:
        user, _, aal = token.partition(":")
        if not user:
            raise auth.HTTPException(401, "bad token")
        return auth.AuthUser(id=user, email=f"{user}@example.com", aal=aal or "aal1")

    monkeypatch.setattr(auth, "verify_token", fake_verify)
    import earnsure.routes as routes
    monkeypatch.setattr(routes, "get_store", db.get_store)
    from index import app
    return TestClient(app)


def test_verify_token_reads_claims_after_supabase_check(monkeypatch):
    import base64
    import json
    import time
    from types import SimpleNamespace

    def jwt(claims: dict) -> str:
        body = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
        return f"header.{body}.signature"

    calls = []

    class FakeAuth:
        def get_user(self, token):
            calls.append(token)
            if token == "bad":
                raise ValueError("invalid JWT")
            return SimpleNamespace(user=SimpleNamespace(id="u1", email="u1@example.com"))

    monkeypatch.setattr(auth, "_client", lambda: SimpleNamespace(auth=FakeAuth()))
    auth._cache.clear()
    good = jwt({"sub": "u1", "aal": "aal2", "exp": time.time() + 600})
    assert auth.verify_token(good) == auth.AuthUser("u1", "u1@example.com", "aal2")
    auth.verify_token(good)
    assert calls.count(good) == 1  # cached
    with pytest.raises(auth.HTTPException):
        auth.verify_token("bad")
    with pytest.raises(auth.HTTPException):  # token for a different user than Supabase says
        auth.verify_token(jwt({"sub": "someone-else", "aal": "aal2", "exp": time.time() + 600}))


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_config_when_enabled(signed_in):
    cfg = signed_in.get("/api/auth/config").json()
    assert cfg == {"enabled": True, "require_mfa": True,
                   "supabase_url": "https://example.supabase.co", "supabase_anon_key": "anon-key"}


def test_requires_token(signed_in):
    assert signed_in.post("/api/session").status_code == 401
    assert signed_in.get("/api/health").status_code == 401
    # The old demo cookie is ignored when sign-in is on
    signed_in.cookies.set("demo_session_id", "anything")
    assert signed_in.get("/api/health").status_code == 401


def test_requires_mfa(signed_in, monkeypatch):
    r = signed_in.get("/api/health", headers=bearer("alice:aal1"))
    assert r.status_code == 403 and r.json()["detail"] == "mfa_required"
    monkeypatch.setenv("AUTH_REQUIRE_MFA", "false")
    assert signed_in.get("/api/health", headers=bearer("alice:aal1")).status_code == 200


def test_signed_in_flow_and_isolation(signed_in):
    alice, bob = bearer("alice:aal2"), bearer("bob:aal2")
    assert signed_in.post("/api/session", headers=alice).json() == {"ok": True, "new": True}
    assert signed_in.post("/api/session", headers=alice).json() == {"ok": True, "new": False}

    h = signed_in.get("/api/health", headers=alice).json()
    assert (h["status"], h["dependable"]["display"]) == ("Watch", "$790")

    item = signed_in.get("/api/confirmations", headers=alice).json()["items"][0]
    signed_in.post(f"/api/confirmations/{item['txn_id']}", json={"category": "work_income"}, headers=alice)
    assert signed_in.get("/api/streams", headers=alice).json()["needs_check"] == 2
    # Bob has his own session and data
    assert signed_in.get("/api/streams", headers=bob).json()["needs_check"] == 3

    token = signed_in.post("/api/proofs", json={}, headers=alice).json()["token"]
    # The landlord page stays public: no token needed
    assert signed_in.get(f"/api/proofs/{token}").json()["state"] == "verified"
    # Bob can't switch off Alice's link
    assert signed_in.post(f"/api/proofs/{token}/revoke", headers=bob).status_code == 404

    # Restart demo wipes Alice's data; her next request starts fresh
    assert signed_in.delete("/api/session", headers=alice).status_code == 200
    assert signed_in.get("/api/streams", headers=alice).json()["needs_check"] == 3
