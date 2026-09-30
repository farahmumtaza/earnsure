"""HTTP API (TD §9). Every figure is recalculated per request from the cached
dataset plus this session's labels; nothing numeric is stored."""

import os
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from . import affordability, auth, classify, config, data_gen, fmt, metrics, proof, trends
from .db import get_store
from .providers.bank import get_bank_provider
from .providers.explain import get_explanation_provider

router = APIRouter(prefix="/api")
COOKIE = "demo_session_id"
SYDNEY = ZoneInfo("Australia/Sydney")


def today() -> date:
    """Dates are Sydney dates; Vercel servers run in UTC."""
    return datetime.now(SYDNEY).date()


def _sydney_time(value) -> str | None:
    """Stored timestamp -> '30 Sep, 3:12 pm' in Sydney time."""
    if not value:
        return None
    t = datetime.fromisoformat(str(value)).astimezone(SYDNEY)
    return f"{t.day} {t:%b}, {t.hour % 12 or 12}:{t:%M} {'am' if t.hour < 12 else 'pm'}"

FREQ_DETAIL = {
    "work_income": lambda s: f"{s['frequency']} · {s['count']} payments",
    "gig_income": lambda s: f"{s['frequency']} · {s['count']} payments",
    "freelance_income": lambda s: f"{s['frequency']} · {s['count']} invoices",
    "remittance": lambda s: "Monthly · family obligation",
    "bnpl": lambda s: "Fortnightly repayment",
    "subscription": lambda s: f"Monthly · {s['services']} services",
}
CONFIRM_REASONS = {
    "T NGUYEN": "first time from this person",
    "M PATEL": "no clear reference",
    "A OKAFOR": "first time from this person",
}


# --- session plumbing ----------------------------------------------------------
# AUTH_ENABLED=false: an anonymous session per browser, identified by a cookie.
# AUTH_ENABLED=true:  one session per signed-in Supabase user (see auth.py).

def _session_for_user(user_id: str) -> tuple[str, bool]:
    """(session id, created now) for a signed-in user."""
    store = get_store()
    found = store.find_session_by_user(user_id)
    if found:
        return found["id"], False
    try:
        return store.create_session(user_id=user_id), True
    except Exception:
        # Two first requests raced; the other one created it (user_id is unique)
        found = store.find_session_by_user(user_id)
        if not found:
            raise
        return found["id"], False


def session_id(request: Request, demo_session_id: str | None = Cookie(default=None)) -> str:
    if auth.enabled():
        return _session_for_user(auth.current_user(request).id)[0]
    if not demo_session_id or not get_store().get_session(demo_session_id):
        raise HTTPException(401, "No demo session")
    return demo_session_id


def _set_cookie(response: Response, sid: str) -> None:
    response.set_cookie(COOKIE, sid, httponly=True, samesite="lax",
                        secure=bool(os.environ.get("VERCEL")), max_age=60 * 60 * 24 * 30, path="/")


def _labels(sid: str) -> dict[str, str]:
    return {row["txn_id"]: row["category"] for row in get_store().get_labels(sid)}


def _note(sid: str, weekly) -> dict:
    """The note for the first lean period: saved, or the demo default."""
    periods = trends.lean_periods(weekly)
    if not periods:
        return {"period_start": None, "note": None, "include_on_proof": False, "label": None}
    start = periods[0]["start"]
    saved = next((n for n in get_store().get_notes(sid) if str(n["period_start"]) == start.isoformat()), None)
    note = saved["note"] if saved else config.DEFAULT_NOTE
    include = saved["include_on_proof"] if saved else True
    label = get_explanation_provider().proof_note_label(note, start)
    return {"period_start": start.isoformat(), "note": note, "include_on_proof": include,
            "label": label, "saved": bool(saved), "month_label": start.strftime("%B")}


# --- screens 1–3 -----------------------------------------------------------------

@router.get("/auth/config")
def auth_config():
    """Public: tells the web app whether sign-in is real or a skippable dummy."""
    return auth.public_config()


@router.post("/session")
def create_session(request: Request, response: Response, demo_session_id: str | None = Cookie(default=None)):
    if auth.enabled():
        _, created = _session_for_user(auth.current_user(request).id)
        return {"ok": True, "new": created}
    store = get_store()
    if demo_session_id and store.get_session(demo_session_id):
        return {"ok": True, "new": False}
    _set_cookie(response, store.create_session())
    return {"ok": True, "new": True}


@router.delete("/session")
def delete_session(response: Response, sid: str = Depends(session_id)):
    """Restart demo: deletes this session's labels, notes and proofs (cascade).
    With sign-in on, the user's next request starts a fresh session."""
    get_store().delete_session(sid)
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


class ConsentIn(BaseModel):
    consent_days: Literal[30, 90, 365]


@router.post("/consent")
def save_consent(body: ConsentIn, sid: str = Depends(session_id)):
    get_store().update_session(sid, consent_days=body.consent_days)
    return {"ok": True, "consent_days": body.consent_days}


@router.get("/institutions")
def institutions(q: str = "", sid: str = Depends(session_id)):
    return {"institutions": get_bank_provider().list_institutions(q)}


@router.get("/institutions/{institution_id}")
def institution_detail(institution_id: str, sid: str = Depends(session_id)):
    """Bank and accounts for the simulated bank authorisation page."""
    provider = get_bank_provider()
    bank = provider.institution(institution_id)
    if not bank:
        raise HTTPException(404, "Unknown bank")
    consent = get_store().get_session(sid).get("consent_days") or 90
    return {"institution": bank, "accounts": provider.list_accounts(sid, institution_id), "consent_days": consent}


class ConnectIn(BaseModel):
    institution_id: str | None = Field(default=None, max_length=40)


@router.post("/connect")
def connect(body: ConnectIn | None = None, sid: str = Depends(session_id)):
    store = get_store()
    consent = store.get_session(sid).get("consent_days") or 90
    institution_id = body.institution_id if body else None
    if institution_id and not any(b["id"] == institution_id for b in get_bank_provider().list_institutions("")):
        raise HTTPException(422, "Unknown bank")
    result = get_bank_provider().connect(sid, consent, institution_id)
    store.update_session(sid, connected_at=datetime.now(SYDNEY).isoformat())
    return result


SYNC_FREQUENCY = "Weekly"


@router.post("/sync")
def sync(sid: str = Depends(session_id)):
    """Manual resync from Home. Bank data otherwise syncs weekly.
    demo_sessions.connected_at doubles as the last-synced time."""
    result = get_bank_provider().sync(sid)
    now = datetime.now(SYDNEY)
    get_store().update_session(sid, connected_at=now.isoformat())
    return {**result, "last_synced": _sydney_time(now), "frequency": SYNC_FREQUENCY}


# --- screens 4–5 -----------------------------------------------------------------

@router.get("/streams")
def streams(sid: str = Depends(session_id)):
    labels = _labels(sid)
    a = metrics.analyse(labels)
    base = list(metrics.base_classified())
    pending = [t for t in classify.confirmation_queue(base) if t["txn_id"] not in labels]
    nc = classify.not_counted(a.txns)

    def row(s):
        detail = FREQ_DETAIL.get(s["key"], lambda s: s["frequency"].replace("Every fortnight", "Fortnightly"))(s)
        return {"key": s["key"], "name": s["name"], "detail": detail, "tag": s.get("tag"),
                "typical": fmt.money(s["typical"])}

    income = [dict(row(s), typical={"value": s["typical"], "display": f"~${fmt.whole(s['typical'] / 10) * 10:,}"})
              for s in classify.income_streams(a.txns)]
    return {
        "period": f"{config.N_WEEKS} weeks · {fmt.day_month(config.PERIOD_START)} – "
                  f"{fmt.day_month_year(config.PERIOD_END)}",
        "income": income,
        "outgoing": [row(s) for s in classify.outgoing_streams(a.txns)],
        "not_counted": {
            "transfers": {"count": nc["transfers"]["count"], "total": fmt.money(nc["transfers"]["total"])},
            "refunds": {"count": nc["refunds"]["count"], "total": fmt.money(nc["refunds"]["total"])},
        },
        "needs_check": len(pending),
    }


@router.get("/confirmations")
def confirmations(sid: str = Depends(session_id)):
    labels = {r["txn_id"]: r for r in get_store().get_labels(sid)}
    accounts = {a["account_id"]: a for a in config.ACCOUNTS}
    items = []
    for t in classify.confirmation_queue(list(metrics.base_classified())):
        acc = accounts[t["account_id"]]
        items.append({
            "txn_id": t["txn_id"], "description": t["description"],
            "initials": "".join(w[0] for w in t["counterparty"].split()[:2]),
            "amount": {"value": t["amount"], "display": f"+${t['amount']:,.2f}"},
            "detail": f"{fmt.day_month_year(t['date'])} · {acc['name'].split()[0]} {acc['masked_number']} · "
                      f"{CONFIRM_REASONS.get(t['counterparty'], 'person-to-person payment')}",
            "label": labels.get(t["txn_id"], {}).get("category"),
            "note": labels.get(t["txn_id"], {}).get("note"),
        })
    options = [{"category": k, "label": v[0]} for k, v in config.LABEL_OPTIONS.items()]
    return {"items": items, "options": options}


class LabelIn(BaseModel):
    category: Literal["work_income", "family_support", "one_off_personal", "other_in"]
    note: str | None = Field(default=None, max_length=500)


@router.post("/confirmations/{txn_id}")
def save_label(txn_id: str, body: LabelIn, sid: str = Depends(session_id)):
    queue_ids = {t["txn_id"] for t in classify.confirmation_queue(list(metrics.base_classified()))}
    if txn_id not in queue_ids:
        raise HTTPException(404, "Not a confirmation item")
    get_store().upsert_label(sid, txn_id, body.category, body.note)
    return {"ok": True}


# --- screen 6 --------------------------------------------------------------------

@router.get("/health")
def health(sid: str = Depends(session_id)):
    s = metrics.summary(metrics.analyse(_labels(sid)))
    figures = {
        "status": s["status"],
        "dependable": fmt.money(s["dependable"])["display"],
        "regular": fmt.money(s["regular_outflows"])["display"],
        "buffer": fmt.one_dp(s["buffer_weeks"])["display"],
        "next_status_threshold": config.STABLE_BUFFER_WEEKS,
    }
    week_of = config.TODAY - timedelta(days=config.TODAY.weekday())  # Monday of the current week
    return {
        "greeting": f"Hi {config.APPLICANT_FIRST_NAME}",
        "week_label": f"Week of {fmt.day_month(week_of)}",
        "status": s["status"],
        "explanation": get_explanation_provider().health_explanation(figures),
        "dependable": fmt.money(s["dependable"]),
        "typical": fmt.money(s["typical"]),
        "regular_outflows": fmt.money(s["regular_outflows"]),
        "typical_left": fmt.money(s["typical_left"]),
        "lowest_left": fmt.money(s["lowest_left"]),
        "buffer_weeks": fmt.one_dp(s["buffer_weeks"]),
        "balance": fmt.money(s["balance"]),
        "account_count": len(config.ACCOUNTS),
        "sync": {"frequency": SYNC_FREQUENCY,
                 "last": _sydney_time(get_store().get_session(sid).get("connected_at"))},
        "safe_to_spend": fmt.money(s["safe"]),
        "top_up": fmt.money(s["top_up"]),
        # Static (feature 13, roadmap)
        "lean_alert": {
            "title": f"{config.UPCOMING_BILL['name']} of about ${config.UPCOMING_BILL['amount']} "
                     f"due {config.UPCOMING_BILL['due']}",
            "body": f"That week usually brings in less than your dependable "
                    f"{fmt.money(s['dependable'])['display']}. After the bill you may have under one week "
                    f"of costs left. Moving $100 to savings now would cover it.",
        },
    }


# --- screen 7 --------------------------------------------------------------------

@router.get("/trends")
def get_trends(sid: str = Depends(session_id)):
    a = metrics.analyse(_labels(sid))
    lean = trends.lean_weeks(a.weekly_income)
    weeks = [{"week_start": data_gen.week_start(i).isoformat(),
              "label": f"Week of {fmt.day_month(data_gen.week_start(i))}",
              "month": data_gen.week_start(i).strftime("%b"),
              "amount": fmt.money(v), "lean": bool(lean[i])}
             for i, v in enumerate(a.weekly_income)]
    return {
        "period": f"{fmt.day_month(config.PERIOD_START)} – {fmt.day_month(config.PERIOD_END)}",
        "weeks": weeks,
        "dependable": fmt.money(metrics.dependable(a.weekly_income)),
        "lean_periods": [trends.describe_period(p) for p in trends.lean_periods(a.weekly_income)],
        "drops": [w for w in weeks if w["lean"]],
        "note": _note(sid, a.weekly_income),
    }


class NoteIn(BaseModel):
    period_start: date
    note: str = Field(min_length=1, max_length=500)
    include_on_proof: bool = True


@router.put("/trends/note")
def save_note(body: NoteIn, sid: str = Depends(session_id)):
    get_store().upsert_note(sid, body.period_start.isoformat(), body.note.strip(), body.include_on_proof)
    return {"ok": True, "label": get_explanation_provider().proof_note_label(body.note, body.period_start)}


# --- screen 8 --------------------------------------------------------------------

class AffordIn(BaseModel):
    type: Literal["Rent", "Phone plan", "Loan repayment"] = "Rent"
    amount: float = Field(gt=0, le=100000)
    frequency: Literal["Weekly", "Fortnightly", "Monthly"] = "Weekly"


@router.post("/affordability")
def afford(body: AffordIn, sid: str = Depends(session_id)):
    a = metrics.analyse(_labels(sid))
    result = affordability.check(a, body.amount, body.frequency, body.type)
    what_if = []
    if body.type == "Rent" and body.frequency == "Weekly":
        what_if = [affordability.check(a, r, "Weekly", "Rent") for r in config.WHAT_IF_RENTS]
    return {"result": result, "what_if": what_if,
            "basis": f"Based on {config.N_WEEKS} weeks of bank data and your current savings."}


# --- screens 9–11 ------------------------------------------------------------------

class ProofIn(BaseModel):
    valid_days: Literal[7, 14, 30] = 30
    show_chart: bool = False
    include_note: bool = True
    rent_amount: float = Field(default=230, gt=0, le=100000)
    rent_frequency: Literal["Weekly", "Fortnightly", "Monthly"] = "Weekly"


def _snapshot(sid: str, body: ProofIn, token: str, statement_no: str, issued: date) -> dict:
    a = metrics.analyse(_labels(sid))
    s = metrics.summary(a)
    r = affordability.check(a, body.rent_amount, body.rent_frequency, "Rent")
    note = _note(sid, a.weekly_income)
    rent_weeks = len({data_gen.week_index(t["date"]) for t in a.txns if t["category"] == "rent"})
    return proof.build_snapshot(
        statement_no=statement_no, token=token,
        applicant_display=config.APPLICANT_DISPLAY,
        data_source=config.DATA_SOURCE,
        period=f"{fmt.day_month(config.PERIOD_START)} – {fmt.day_month_year(config.PERIOD_END)} "
               f"({config.N_WEEKS} weeks)",
        issued=issued.isoformat(),
        valid_until=(issued + timedelta(days=body.valid_days)).isoformat(),
        confidence="High",
        rent_weekly=r["weekly_cost"]["display"],
        share=r["share"]["display"], sim_pass_rate=r["sim_pass_rate"]["display"],
        label=r["label"], label_colour=r["colour"],
        dependable=fmt.money(s["dependable"])["display"],
        typical_left=fmt.money(s["typical_left"])["display"],
        rent_paid_weeks=f"{rent_weeks} of {config.N_WEEKS}",
        buffer_weeks=fmt.one_dp(s["buffer_weeks"])["display"],
        note_label=note["label"] if body.include_note and note["include_on_proof"] else None,
        weekly_series=[fmt.whole(v) for v in a.weekly_income] if body.show_chart else None,
    )


def _share_url(token: str) -> str | None:
    # Tolerate "https://" prefixes and trailing slashes in the env value
    domain = os.environ.get("APP_DOMAIN", "").strip().removeprefix("https://").removeprefix("http://").strip("/")
    return f"https://{domain}/p/{token}" if domain else None


def _proof_view(snapshot: dict) -> dict:
    """Snapshot plus display dates."""
    return dict(snapshot,
                issued_display=fmt.day_month_year(date.fromisoformat(snapshot["issued"])),
                valid_until_display=fmt.day_month_year(date.fromisoformat(snapshot["valid_until"])))


@router.post("/proofs/preview")
def preview_proof(body: ProofIn, sid: str = Depends(session_id)):
    token, statement_no = config.DEMO_TOKEN, config.DEMO_STATEMENT_NO
    return {"snapshot": _proof_view(_snapshot(sid, body, token, statement_no, today()))}


@router.post("/proofs")
def create_proof(body: ProofIn, sid: str = Depends(session_id)):
    store = get_store()
    seeded = os.environ.get("DEMO_SEED_TOKENS", "true").lower() == "true"
    if seeded and not store.get_proof(config.DEMO_TOKEN):
        token, statement_no = config.DEMO_TOKEN, config.DEMO_STATEMENT_NO
    else:
        token, statement_no = proof.new_token()
        while store.get_proof(token):
            token, statement_no = proof.new_token()
    snap = _snapshot(sid, body, token, statement_no, today())
    store.insert_proof({"token": token, "session_id": sid, "statement_no": statement_no,
                        "snapshot": snap, "signature": proof.sign(snap),
                        "valid_until": snap["valid_until"]})
    return {"token": token, "statement_no": statement_no, "url": _share_url(token)}


def _opened_display(p: dict) -> str | None:
    return _sydney_time(p.get("last_opened_at"))


@router.get("/proofs/current")
def current_proof(sid: str = Depends(session_id)):
    p = get_store().latest_proof(sid)
    if not p:
        raise HTTPException(404, "No proof yet")
    snap = p["snapshot"]
    n = p["open_count"]
    return {
        "token": p["token"], "statement_no": p["statement_no"], "url": _share_url(p["token"]),
        "valid_until": fmt.day_month_year(date.fromisoformat(str(p["valid_until"]))),
        "revoked": p["revoked"],
        "opened": {"count": n, "text": {0: "Not yet", 1: "Once", 2: "Twice"}.get(n, f"{n} times"),
                   "last": _opened_display(p)},
        "answers": f"Rent of {snap['rent_weekly']}/week",
    }


@router.post("/proofs/{token}/revoke")
def revoke_proof(token: str, sid: str = Depends(session_id)):
    store = get_store()
    p = store.get_proof(token)
    if not p or p["session_id"] != sid:
        raise HTTPException(404, "Proof not found")
    store.update_proof(token, revoked=True)
    return {"ok": True}


@router.get("/proofs/{token}")
def public_proof(token: str, request: Request):
    """Public landlord view. No session needed."""
    store = get_store()
    p = store.get_proof(token.upper())
    if not p:
        raise HTTPException(404, "Proof not found")
    state = proof.state(p, today())
    store.update_proof(p["token"], open_count=p["open_count"] + 1,
                       last_opened_at=datetime.now(SYDNEY).isoformat())
    body = {"state": state, "checked": fmt.day_month_year(today())}
    if state in ("verified", "expired"):
        body["snapshot"] = _proof_view(p["snapshot"])
    return body
