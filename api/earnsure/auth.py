"""Optional sign-in: Google via Supabase Auth, plus authenticator-app MFA.

Controlled by environment variables:
  AUTH_ENABLED=false (default)  anonymous demo sessions (cookie); the sign-in
                                screens in the web app are dummies you can skip
  AUTH_ENABLED=true             every /api call (except the public proof page)
                                needs a Supabase access token (Bearer header)
  AUTH_REQUIRE_MFA=true         with auth on, the token must show MFA was passed
                                (aal2); set false to allow Google-only sign-in
  SUPABASE_ANON_KEY             publishable key, handed to the browser so
                                supabase-js can run the Google/MFA flows
"""

import base64
import json
import os
import time
from dataclasses import dataclass
from functools import lru_cache

from fastapi import HTTPException, Request

TRUE = {"1", "true", "yes", "on"}


def enabled() -> bool:
    return os.environ.get("AUTH_ENABLED", "false").strip().lower() in TRUE


def require_mfa() -> bool:
    return os.environ.get("AUTH_REQUIRE_MFA", "true").strip().lower() in TRUE


def _supabase_url() -> str:
    return os.environ.get("SUPABASE_URL", "").strip().split("/rest/v1")[0].rstrip("/")


def public_config() -> dict:
    """What the browser needs to run sign-in. The anon key is public by design."""
    if not enabled():
        return {"enabled": False, "require_mfa": False}
    return {
        "enabled": True,
        "require_mfa": require_mfa(),
        "supabase_url": _supabase_url(),
        "supabase_anon_key": os.environ.get("SUPABASE_ANON_KEY", "").strip(),
    }


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    aal: str  # "aal1" = signed in, "aal2" = signed in and passed MFA


@lru_cache(maxsize=1)
def _client():
    from supabase import create_client

    url, key = _supabase_url(), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("AUTH_ENABLED needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def _claims(token: str) -> dict:
    payload = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))


# Verified tokens, cached briefly so each page load doesn't call Supabase repeatedly
_cache: dict[str, tuple[float, AuthUser]] = {}


def verify_token(token: str) -> AuthUser:
    """Supabase Auth validates the token (signature, expiry, signed-out sessions);
    only then do we read its claims (user id, MFA level)."""
    now = time.time()
    hit = _cache.get(token)
    if hit and hit[0] > now:
        return hit[1]
    try:
        res = _client().auth.get_user(token)
        claims = _claims(token)
    except Exception as e:
        raise HTTPException(401, "Your sign-in has expired. Please sign in again.") from e
    if not res or not res.user or claims.get("sub") != res.user.id:
        raise HTTPException(401, "Your sign-in has expired. Please sign in again.")
    user = AuthUser(id=res.user.id, email=res.user.email, aal=claims.get("aal", "aal1"))
    if len(_cache) > 1000:
        _cache.clear()
    _cache[token] = (min(float(claims.get("exp", now)), now + 300), user)
    return user


def current_user(request: Request) -> AuthUser:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in required")
    user = verify_token(header[7:].strip())
    if require_mfa() and user.aal != "aal2":
        raise HTTPException(403, "mfa_required")
    return user
