"""AI placeholder (TD §8.2): deterministic templates behind an interface.

A future LlmExplanationProvider must only receive finished figures (no names,
account numbers or descriptions), reject output containing any number not in
the input, and fall back to this template.
"""

import os
import re
from datetime import date
from typing import Protocol

NOTE_REASONS = [
    (r"exam", "Exam period"),
    (r"sick|ill|hospital", "Illness"),
    (r"holiday|break", "Break"),
]


class ExplanationProvider(Protocol):
    def health_explanation(self, figures: dict) -> dict: ...
    def proof_note_label(self, note: str, period: date) -> str: ...


class TemplateExplanationProvider:
    def health_explanation(self, f: dict) -> dict:
        """f holds display strings: status, dependable, regular, buffer, next_status_threshold."""
        status = f["status"]
        if status == "Stable":
            headline = "Your income covers your costs. Your savings give you a solid cushion."
            body = (f"Your dependable income ({f['dependable']}/week) is above your regular costs "
                    f"({f['regular']}). Your savings cover {f['buffer']} weeks of costs.")
        elif status == "Tight":
            headline = "Money is tight right now. Your savings are low."
            body = (f"In a typical week your income does not cover your regular costs ({f['regular']}). "
                    f"Your savings cover {f['buffer']} weeks of costs.")
        else:
            headline = "Your income covers your costs. Your savings are a bit thin."
            body = (f"Your dependable income ({f['dependable']}/week) is well above your regular costs "
                    f"({f['regular']}). Your savings cover {f['buffer']} weeks of costs. "
                    f"Reaching {f['next_status_threshold']} weeks would move you to Stable.")
        return {"headline": headline, "body": body, "source": "template"}

    def proof_note_label(self, note: str, period: date) -> str:
        reason = next((label for pat, label in NOTE_REASONS if re.search(pat, note, re.IGNORECASE)),
                      "Personal circumstances")
        return f"{reason}: reduced shifts ({period:%B %Y})."


def get_explanation_provider() -> ExplanationProvider:
    name = os.environ.get("EXPLANATION_PROVIDER", "template")
    if name != "template":
        raise ValueError(f"Unsupported EXPLANATION_PROVIDER: {name}")
    return TemplateExplanationProvider()
