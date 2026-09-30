import json


def test_requires_session():
    from fastapi.testclient import TestClient

    from index import app
    assert TestClient(app).get("/api/health").status_code == 401


def test_demo_flow(client):
    assert client.post("/api/consent", json={"consent_days": 90}).status_code == 200
    banks = client.get("/api/institutions").json()["institutions"]
    assert len(banks) == 8
    assert [b["name"] for b in client.get("/api/institutions?q=bank").json()["institutions"]] == \
        ["Commonwealth Bank", "Macquarie Bank", "Bendigo Bank", "Bank of Queensland"]
    detail = client.get("/api/institutions/nab").json()
    assert detail["institution"]["name"] == "NAB" and detail["consent_days"] == 90
    assert [a["masked_number"] for a in detail["accounts"]] == ["•• 4821", "•• 0937"]
    assert client.get("/api/institutions/not-a-bank").status_code == 404
    conn = client.post("/api/connect", json={"institution_id": "nab"}).json()
    assert conn["transaction_count"] == 612 and len(conn["accounts"]) == 2
    assert conn["institution"]["name"] == "NAB" and conn["accounts"][0]["institution"] == "NAB"
    assert client.post("/api/connect", json={"institution_id": "not-a-bank"}).status_code == 422

    streams = client.get("/api/streams").json()
    assert streams["needs_check"] == 3
    assert [s["typical"]["display"] for s in streams["outgoing"]] == ["$210", "$200", "$130", "$45", "$30", "$26"]

    items = client.get("/api/confirmations").json()["items"]
    assert items[0]["description"] == "FROM T NGUYEN"
    saved = client.post(f"/api/confirmations/{items[0]['txn_id']}", json={"category": "one_off_personal"})
    assert saved.status_code == 200
    assert client.get("/api/streams").json()["needs_check"] == 2

    h = client.get("/api/health").json()
    assert (h["status"], h["dependable"]["display"], h["typical_left"]["display"],
            h["lowest_left"]["display"], h["buffer_weeks"]["display"], h["safe_to_spend"]["display"]) == \
        ("Watch", "$790", "$537", "$102", "3.7", "$393")

    t = client.get("/api/trends").json()
    assert [d["amount"]["display"] for d in t["drops"]] == ["$420", "$450", "$480"]
    assert t["note"]["label"] == "Exam period: reduced shifts (June 2026)."

    r = client.post("/api/affordability", json={"type": "Rent", "amount": 230, "frequency": "Weekly"}).json()
    assert r["result"]["label"] == "Likely affordable"
    assert [w["label"] for w in r["what_if"]] == ["Possible, some risk", "Unlikely"]


def test_proof_lifecycle_and_privacy(client):
    created = client.post("/api/proofs", json={"valid_days": 30, "show_chart": False, "include_note": True}).json()
    token = created["token"]
    assert token == "7KQ4-M2X9" and created["statement_no"] == "ES-7KQ4M2X9"

    public = client.get(f"/api/proofs/{token}").json()
    assert public["state"] == "verified"
    snap = public["snapshot"]
    assert snap["share"] == "29%" and snap["sim_pass_rate"] == "94%" and snap["rent_paid_weeks"] == "26 of 26"
    assert snap["note_label"] == "Exam period: reduced shifts (June 2026)."
    assert "weekly_series" not in snap

    blob = json.dumps(snap).upper()
    for banned in ("4821", "0937", "VISA", "REMITTANCE", "QUICKDROP", "BEAN", "STUDIO MOSS", "WISE", "NGUYEN"):
        assert banned not in blob

    cur = client.get("/api/proofs/current").json()
    assert cur["opened"]["count"] == 1 and cur["answers"] == "Rent of $230/week"

    assert client.post(f"/api/proofs/{token}/revoke").status_code == 200
    assert client.get(f"/api/proofs/{token}").json()["state"] == "revoked"


def test_tampered_snapshot_in_store(client):
    from earnsure.db import get_store
    token = client.post("/api/proofs", json={}).json()["token"]
    store = get_store()
    p = store.get_proof(token)
    store.update_proof(token, snapshot=dict(p["snapshot"], dependable="$990"))
    assert client.get(f"/api/proofs/{token}").json()["state"] == "invalid"


def test_chart_only_when_opted_in(client):
    token = client.post("/api/proofs", json={"show_chart": True, "include_note": False}).json()["token"]
    snap = client.get(f"/api/proofs/{token}").json()["snapshot"]
    assert len(snap["weekly_series"]) == 26 and "note_label" not in snap


def test_manual_resync(client):
    import re
    assert client.get("/api/health").json()["sync"] == {"frequency": "Weekly", "last": None}
    r = client.post("/api/sync").json()
    assert r["transaction_count"] == 612 and r["new_transactions"] == 0 and r["frequency"] == "Weekly"
    assert re.fullmatch(r"\d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (am|pm)", r["last_synced"])
    assert client.get("/api/health").json()["sync"]["last"] == r["last_synced"]
    # Figures don't change on a demo resync
    assert client.get("/api/health").json()["dependable"]["display"] == "$790"
