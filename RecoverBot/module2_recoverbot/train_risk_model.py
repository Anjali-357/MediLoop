"""
module2_recoverbot/train_risk_model.py
Run this once to generate risk_model.pkl.
Usage: python -m module2_recoverbot.train_risk_model
"""
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# ── Synthetic training data ───────────────────────────────────────────────────
# Features (in order):
#   pain_score (0-10), fever_present (0/1), swelling (0/1),
#   medication_adherent (0/1), days_since_discharge (1-14),
#   age (years), diagnosis_severity (1-3: low/medium/high)
#
# Labels: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL

rng = np.random.default_rng(42)

def _generate(n: int, pain_range, fever_p, swell_p, adhere_p, days_range, age_range, sev_range, label):
    rows = []
    for _ in range(n):
        rows.append([
            rng.integers(*pain_range),
            int(rng.random() < fever_p),
            int(rng.random() < swell_p),
            int(rng.random() < adhere_p),
            rng.integers(*days_range),
            rng.integers(*age_range),
            rng.integers(*sev_range),
            label,
        ])
    return rows

data = (
    _generate(400, (0, 4),  0.05, 0.05, 0.95, (1,15), (18,80), (1,2), 0) +  # LOW
    _generate(300, (3, 6),  0.2,  0.3,  0.7,  (1,15), (18,80), (1,3), 1) +  # MEDIUM
    _generate(200, (6, 9),  0.5,  0.5,  0.4,  (1,15), (18,80), (2,4), 2) +  # HIGH
    _generate(100, (8, 11), 0.8,  0.7,  0.1,  (1,15), (18,80), (2,4), 3)    # CRITICAL
)

arr = np.array(data)
X, y = arr[:, :7], arr[:, 7]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42)
clf.fit(X_train, y_train)

print(classification_report(y_test, clf.predict(X_test),
                            target_names=["LOW", "MEDIUM", "HIGH", "CRITICAL"]))

MODEL_PATH = "module2_recoverbot/risk_model.pkl"
with open(MODEL_PATH, "wb") as f:
    pickle.dump(clf, f)

print(f"✅  Model saved to {MODEL_PATH}")
