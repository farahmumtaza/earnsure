"""Open-banking placeholder (TD §8.1). No network calls.

The institution list uses real Australian bank names and logos so the connect
step looks familiar in the demo. Logos are the banks' trademarks, used here only
to identify them in a non-commercial prototype. Nothing is sent to any bank:
every "connection" returns the same dummy dataset (TD §6).
"""

import os
import time
from typing import Protocol

from .. import config, data_gen

DEMO_INSTITUTIONS = [
    {"id": "cba", "name": "Commonwealth Bank", "initials": "CB"},
    {"id": "westpac", "name": "Westpac", "initials": "WP"},
    {"id": "anz", "name": "ANZ", "initials": "AZ"},
    {"id": "nab", "name": "NAB", "initials": "NB"},
    {"id": "macquarie", "name": "Macquarie Bank", "initials": "MQ"},
    {"id": "ing", "name": "ING", "initials": "IN"},
    {"id": "bendigo", "name": "Bendigo Bank", "initials": "BB"},
    {"id": "boq", "name": "Bank of Queensland", "initials": "BQ"},
]
# Logos are the banks' own site icons, served by the web app from web/public/banks/
for _bank in DEMO_INSTITUTIONS:
    _bank["logo"] = f"/banks/{_bank['id']}.png"


class BankDataProvider(Protocol):
    def list_institutions(self, query: str) -> list[dict]: ...
    def institution(self, institution_id: str | None) -> dict | None: ...
    def list_accounts(self, session_id: str, institution_id: str) -> list[dict]: ...
    def connect(self, session_id: str, consent_days: int, institution_id: str | None) -> dict: ...
    def fetch_transactions(self, session_id: str) -> list[dict]: ...
    def sync(self, session_id: str) -> dict: ...


class DummyBankProvider:
    delay_seconds = 1.5

    def list_institutions(self, query: str) -> list[dict]:
        q = query.strip().lower()
        return [b for b in DEMO_INSTITUTIONS if q in b["name"].lower()]

    def institution(self, institution_id: str | None) -> dict | None:
        return next((b for b in DEMO_INSTITUTIONS if b["id"] == institution_id), None)

    def list_accounts(self, session_id: str, institution_id: str) -> list[dict]:
        """Accounts the customer can choose to share on the bank's authorisation step."""
        return [{k: a[k] for k in ("account_id", "name", "masked_number")} for a in config.ACCOUNTS]

    def connect(self, session_id: str, consent_days: int, institution_id: str | None = None) -> dict:
        bank = self.institution(institution_id) or DEMO_INSTITUTIONS[0]
        time.sleep(self.delay_seconds)
        txns = self.fetch_transactions(session_id)
        return {
            "institution": bank,
            "accounts": [{k: a[k] for k in ("account_id", "name", "masked_number")}
                         | {"status": "Connected", "institution": bank["name"]}
                         for a in config.ACCOUNTS],
            "transaction_count": len(txns),
            "period": f"{config.PERIOD_START.day} {config.PERIOD_START:%b} – "
                      f"{config.PERIOD_END.day} {config.PERIOD_END:%b %Y}",
        }

    def fetch_transactions(self, session_id: str) -> list[dict]:
        return data_gen.build()

    def sync(self, session_id: str) -> dict:
        """Re-fetch the accounts' transactions. A real CDR provider would pull
        anything new since the last sync; the demo data never changes."""
        time.sleep(self.delay_seconds)
        return {"transaction_count": len(self.fetch_transactions(session_id)), "new_transactions": 0}


def get_bank_provider() -> BankDataProvider:
    name = os.environ.get("BANK_PROVIDER", "dummy")
    if name != "dummy":
        raise ValueError(f"Unsupported BANK_PROVIDER: {name}")
    return DummyBankProvider()
