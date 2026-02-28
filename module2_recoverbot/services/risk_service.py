"""
module2_recoverbot/services/risk_service.py
sklearn RandomForestClassifier risk scoring service.
"""
from __future__ import annotations
import os
import pickle
import pathlib
import numpy as np
from typing import Tuple

_MODEL_PATH = pathlib.Path(__file__).parent.parent / "risk_model.pkl"

_LABEL_MAP = {0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"}


def _load_model():
    if not _MODEL_PATH.exists():
        raise FileNotFoundError(
            f"risk_model.pkl not found at {_MODEL_PATH}. "
            "Run: python -m module2_recoverbot.train_risk_model"
        )
    with open(_MODEL_PATH, "rb") as f:
        return pickle.load(f)


_clf = None  # lazy load


def score_risk(
    pain_score: float,
    fever_present: bool,
    swelling: bool,
    medication_adherent: bool,
    days_since_discharge: int,
    age: int,
    diagnosis_severity: int,       # 1=low, 2=medium, 3=high
) -> Tuple[float, str]:
    """
    Returns (risk_score: float 0-1, risk_label: str).
    """
    global _clf
    if _clf is None:
        _clf = _load_model()

    features = np.array([[
        pain_score,
        int(fever_present),
        int(swelling),
        int(medication_adherent),
        days_since_discharge,
        age,
        diagnosis_severity,
    ]])

    proba = _clf.predict_proba(features)[0]
    label_idx = int(np.argmax(proba))
    risk_score = float(proba[2] + proba[3])   # P(HIGH) + P(CRITICAL)

    return risk_score, _LABEL_MAP[label_idx]
