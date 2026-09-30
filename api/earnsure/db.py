"""Storage: Supabase when configured, otherwise an in-memory store (local dev and tests)."""

import os
import uuid
from datetime import UTC, datetime
from functools import lru_cache


def _now() -> str:
    return datetime.now(UTC).isoformat()


class MemoryStore:
    def __init__(self):
        self.sessions: dict[str, dict] = {}
        self.labels: dict[tuple, dict] = {}
        self.notes: dict[tuple, dict] = {}
        self.proofs: dict[str, dict] = {}

    # sessions
    def create_session(self, user_id: str | None = None) -> str:
        sid = str(uuid.uuid4())
        self.sessions[sid] = {"id": sid, "user_id": user_id, "consent_days": None, "connected_at": None,
                              "created_at": _now()}
        return sid

    def get_session(self, sid: str) -> dict | None:
        return self.sessions.get(sid)

    def find_session_by_user(self, user_id: str) -> dict | None:
        return next((s for s in self.sessions.values() if s.get("user_id") == user_id), None)

    def update_session(self, sid: str, **fields) -> None:
        self.sessions[sid].update(fields)

    def delete_session(self, sid: str) -> None:
        self.sessions.pop(sid, None)
        for store in (self.labels, self.notes):
            for k in [k for k in store if k[0] == sid]:
                del store[k]
        for t in [t for t, p in self.proofs.items() if p["session_id"] == sid]:
            del self.proofs[t]

    # labels
    def upsert_label(self, sid: str, txn_id: str, category: str, note: str | None) -> None:
        self.labels[(sid, txn_id)] = {"txn_id": txn_id, "category": category, "note": note}

    def get_labels(self, sid: str) -> list[dict]:
        return [v for k, v in self.labels.items() if k[0] == sid]

    # notes
    def upsert_note(self, sid: str, period_start: str, note: str, include_on_proof: bool) -> None:
        self.notes[(sid, period_start)] = {"period_start": period_start, "note": note,
                                           "include_on_proof": include_on_proof}

    def get_notes(self, sid: str) -> list[dict]:
        return [v for k, v in self.notes.items() if k[0] == sid]

    # proofs
    def insert_proof(self, record: dict) -> None:
        self.proofs[record["token"]] = dict(record, revoked=False, open_count=0,
                                            last_opened_at=None, created_at=_now())

    def get_proof(self, token: str) -> dict | None:
        p = self.proofs.get(token)
        return dict(p) if p else None

    def latest_proof(self, sid: str) -> dict | None:
        mine = [p for p in self.proofs.values() if p["session_id"] == sid]
        return dict(max(mine, key=lambda p: p["created_at"])) if mine else None

    def update_proof(self, token: str, **fields) -> None:
        self.proofs[token].update(fields)


class SupabaseStore:
    def __init__(self, url: str, key: str):
        from supabase import create_client
        self.c = create_client(url, key)

    def _one(self, res) -> dict | None:
        return res.data[0] if res.data else None

    def create_session(self, user_id: str | None = None) -> str:
        row = {"user_id": user_id} if user_id else {}
        return self.c.table("demo_sessions").insert(row).execute().data[0]["id"]

    def find_session_by_user(self, user_id: str) -> dict | None:
        return self._one(self.c.table("demo_sessions").select("*").eq("user_id", user_id).limit(1).execute())

    def get_session(self, sid: str) -> dict | None:
        try:
            uuid.UUID(sid)
        except ValueError:
            return None
        return self._one(self.c.table("demo_sessions").select("*").eq("id", sid).execute())

    def update_session(self, sid: str, **fields) -> None:
        self.c.table("demo_sessions").update(fields).eq("id", sid).execute()

    def delete_session(self, sid: str) -> None:
        self.c.table("demo_sessions").delete().eq("id", sid).execute()

    def upsert_label(self, sid, txn_id, category, note) -> None:
        self.c.table("user_labels").upsert(
            {"session_id": sid, "txn_id": txn_id, "category": category, "note": note},
            on_conflict="session_id,txn_id").execute()

    def get_labels(self, sid: str) -> list[dict]:
        return self.c.table("user_labels").select("*").eq("session_id", sid).execute().data

    def upsert_note(self, sid, period_start, note, include_on_proof) -> None:
        self.c.table("income_notes").upsert(
            {"session_id": sid, "period_start": period_start, "note": note,
             "include_on_proof": include_on_proof},
            on_conflict="session_id,period_start").execute()

    def get_notes(self, sid: str) -> list[dict]:
        return self.c.table("income_notes").select("*").eq("session_id", sid).execute().data

    def insert_proof(self, record: dict) -> None:
        self.c.table("proofs").insert(record).execute()

    def get_proof(self, token: str) -> dict | None:
        return self._one(self.c.table("proofs").select("*").eq("token", token).execute())

    def latest_proof(self, sid: str) -> dict | None:
        return self._one(self.c.table("proofs").select("*").eq("session_id", sid)
                         .order("created_at", desc=True).limit(1).execute())

    def update_proof(self, token: str, **fields) -> None:
        self.c.table("proofs").update(fields).eq("token", token).execute()


@lru_cache(maxsize=1)
def get_store():
    url, key = os.environ.get("SUPABASE_URL", "").strip(), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url and key:
        # Accept the REST endpoint too: the client wants the bare project URL
        return SupabaseStore(url.split("/rest/v1")[0].rstrip("/"), key)
    print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: using the in-memory store")
    return MemoryStore()
