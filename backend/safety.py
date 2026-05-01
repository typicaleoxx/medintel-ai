# this file is the ai safety layer for medintel
# it validates ai responses before they reach the client
# blocks unsafe medical advice, invented data, and out of scope content

import re
from dataclasses import dataclass


@dataclass
class SafetyResult:
    safe: bool
    reason: str = ""


# phrases that indicate the ai invented data not grounded in the context
_HALLUCINATION_SIGNALS = [
    r"\bbased on general medical knowledge\b",
    r"\btypically in cases like this\b",
    r"\bpatients with this condition often\b",
    r"\bstudies show\b",
    r"\bmedical literature suggests\b",
    r"\bcommonly prescribed\b",
    r"\bin most cases\b",
]

# phrases that indicate the ai is prescribing or diagnosing beyond the records
_PRESCRIPTION_SIGNALS = [
    r"\byou should take\b",
    r"\bi recommend taking\b",
    r"\bi would prescribe\b",
    r"\btry taking\b",
    r"\byou can take\s+\d",        # "you can take 400mg" style
    r"\bdose of\s+\d",
    r"\bmg\s+(twice|three times|once)\b",
]

# phrases indicating unqualified certainty that AI cannot have
_CERTAINTY_SIGNALS = [
    r"\byou definitely have\b",
    r"\bthis is definitely\b",
    r"\byou will definitely\b",
    r"\bguaranteed\b",
    r"\b100%\s+(safe|effective|certain)\b",
]

# emergency situations where the ai should always refer to professional care
_EMERGENCY_PATTERNS = [
    r"\bchest pain\b",
    r"\bdifficulty breathing\b",
    r"\bcan't breathe\b",
    r"\bshortness of breath\b",
    r"\bseizure\b",
    r"\bunconscious\b",
    r"\bsuicid\b",
    r"\bself.harm\b",
    r"\boverdose\b",
]

_EMERGENCY_DISCLAIMER = (
    "\n\n⚠ If you are experiencing a medical emergency, "
    "call emergency services (911) or go to the nearest emergency room immediately."
)


def check_chat_response(text: str) -> SafetyResult:
    """
    validates a patient chat response before delivery.
    returns SafetyResult(safe=False) if the response contains unsafe content.
    """
    lower = text.lower()

    for pattern in _HALLUCINATION_SIGNALS:
        if re.search(pattern, lower):
            return SafetyResult(
                safe=False,
                reason=f"response appears to draw on general medical knowledge outside patient records: matched '{pattern}'"
            )

    for pattern in _PRESCRIPTION_SIGNALS:
        if re.search(pattern, lower):
            return SafetyResult(
                safe=False,
                reason=f"response contains a medication recommendation not grounded in records: matched '{pattern}'"
            )

    for pattern in _CERTAINTY_SIGNALS:
        if re.search(pattern, lower):
            return SafetyResult(
                safe=False,
                reason=f"response expresses unqualified medical certainty: matched '{pattern}'"
            )

    return SafetyResult(safe=True)


def append_emergency_disclaimer_if_needed(text: str) -> str:
    """
    appends an emergency services reminder if the response discusses emergency symptoms.
    the disclaimer is only added once even if multiple patterns match.
    """
    lower = text.lower()
    for pattern in _EMERGENCY_PATTERNS:
        if re.search(pattern, lower):
            # do not double-append if the text already contains an emergency note
            if "emergency" not in lower or "911" not in text:
                return text + _EMERGENCY_DISCLAIMER
            break
    return text


def validate_soap_fields(data: dict) -> SafetyResult:
    """
    checks that a generated soap report does not contain red-flag content.
    catches cases where the ai invented data that contradicts the inputs.
    """
    patient_fields = [
        data.get("what_you_have", ""),
        data.get("what_this_means", ""),
        " ".join(data.get("key_takeaways", [])),
    ]
    combined = " ".join(patient_fields).lower()

    for pattern in _PRESCRIPTION_SIGNALS:
        if re.search(pattern, combined):
            return SafetyResult(
                safe=False,
                reason=f"patient-facing fields contain a medication dosage recommendation: matched '{pattern}'"
            )

    return SafetyResult(safe=True)
