"""
Collision severity model.

Target: the collision killed or seriously injured someone (KSI: STATS19 severity 1 or 2).
Split by time: train on January to September 2015, test on October to December 2015.

Models compared on the same test months:
  1. Base rate                (every call gets the training KSI rate)
  2. Simple rule              (high risk if 60/70 mph, pedestrian hit, or motorcycle involved)
  3. Logistic regression      (the model used in the app; unregularised maximum likelihood)
  4. Gradient boosted trees   (sklearn HistGradientBoosting, as a stronger black-box reference)

Usage: python train.py <folder with Accidents_2015.csv, Vehicles_2015.csv, Casualties_2015.csv>
Writes ../app/src/data/model.json and ../app/src/data/testset.json
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import statsmodels.api as sm
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from features import LEVELS, VARIABLES, build, design

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "app" / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)

df, dropped = build(SRC)
train = df[df.date.dt.month <= 9].reset_index(drop=True)
test = df[df.date.dt.month >= 10].reset_index(drop=True)
Xtr, names = design(train)
Xte, _ = design(test)
ytr, yte = train.ksi.values, test.ksi.values

# ---------------------------------------------------------------- logistic regression
logit = sm.Logit(ytr, sm.add_constant(Xtr)).fit(disp=0, maxiter=200)
assert logit.mle_retvals["converged"]
beta = logit.params
ci = logit.conf_int(0.05)
p_lr = logit.predict(sm.add_constant(Xte))

# ---------------------------------------------------------------- comparisons
gbm = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=31,
                                     early_stopping=True, validation_fraction=0.15, random_state=0)
gbm.fit(Xtr, ytr)
p_gbm = gbm.predict_proba(Xte)[:, 1]
base = ytr.mean()
p_base = np.full(len(yte), base)
rule = ((test.speed.isin(["60", "70"])) | (test.pedestrian == "yes") | (test.motorcycle == "yes")).values


def metrics(p):
    return {
        "auc": round(float(roc_auc_score(yte, p)), 3),
        "ap": round(float(average_precision_score(yte, p)), 3),
        "brier": round(float(brier_score_loss(yte, p)), 4),
    }


# ---------------------------------------------------------------- priority bands
# Thresholds chosen on TRAINING predictions: P1 = riskiest 10% of calls, P2 = next 25%, P3 = the rest.
p_tr = logit.predict(sm.add_constant(Xtr))


def cut(q):
    """Cut-off just below the training quantile: halfway to the next lower distinct prediction.
    Answers are categorical, so many calls share an identical probability; a cut-off placed exactly on
    one would make banding depend on the last bit of floating-point rounding."""
    v = float(np.quantile(p_tr, q))
    lower = p_tr[p_tr < v - 1e-12]
    return (v + float(lower.max())) / 2


t1 = cut(0.90)
t2 = cut(0.65)


def band(p):
    return np.where(p >= t1, 1, np.where(p >= t2, 2, 3))


b_te = band(p_lr)
bands = []
for k in (1, 2, 3):
    m = b_te == k
    bands.append({"band": k, "calls": int(m.sum()), "share_calls": round(float(m.mean()), 3),
                  "ksi": int(yte[m].sum()), "ksi_rate": round(float(yte[m].mean()), 3),
                  "share_ksi": round(float(yte[m].sum() / yte.sum()), 3)})

# rule as a yes/no flag
rule_stats = {"flagged_share": round(float(rule.mean()), 3),
              "share_ksi": round(float(yte[rule].sum() / yte.sum()), 3),
              "ksi_rate_flagged": round(float(yte[rule].mean()), 3)}
# logistic regression flagging the same number of calls as the rule, for a fair comparison
k = int(rule.sum())
top = np.argsort(-p_lr)[:k]
lr_same = {"flagged_share": rule_stats["flagged_share"], "share_ksi": round(float(yte[top].sum() / yte.sum()), 3),
           "ksi_rate_flagged": round(float(yte[top].mean()), 3)}

# calibration: ten equal-size groups of test calls by predicted risk
order = np.argsort(p_lr)
calib = []
for g in np.array_split(order, 10):
    calib.append({"predicted": round(float(p_lr[g].mean()), 4), "observed": round(float(yte[g].mean()), 4),
                  "n": int(len(g))})

# ---------------------------------------------------------------- export
coefs = []
for i, n in enumerate(names):
    var, lid = n.split("=")
    coefs.append({"var": var, "level": lid, "beta": float(beta[i + 1]),
                  "or": round(float(np.exp(beta[i + 1])), 3),
                  "or_low": round(float(np.exp(ci[i + 1, 0])), 3), "or_high": round(float(np.exp(ci[i + 1, 1])), 3),
                  "p": float(logit.pvalues[i + 1])})

sha = {f: hashlib.sha256((SRC / f).read_bytes()).hexdigest() for f in
       ["Accidents_2015.csv", "Vehicles_2015.csv", "Casualties_2015.csv"]}

model = {
    "variables": [{"id": v, "label": lab, "levels": [{"id": a, "label": b} for a, b in lv]} for v, lab, lv in VARIABLES],
    "intercept": float(beta[0]),
    "coefficients": coefs,
    "thresholds": {"p1": t1, "p2": t2},   # full precision: the app must band exactly as here
    "base_rate_train": round(float(base), 4),
    "data": {
        "source": "STATS19 road safety data 2015, Department for Transport (Great Britain)",
        "licence": "Open Government Licence v3.0",
        "collisions": int(len(df) + dropped), "used": int(len(df)), "dropped_no_time": int(dropped),
        "killed": 1730, "serious": 22144, "casualties": 186189,
        "fatal_collisions": int((df.severity == 1).sum()), "serious_collisions": int((df.severity == 2).sum()),
        "train": {"collisions": int(len(train)), "ksi": int(ytr.sum()), "months": "January to September 2015"},
        "test": {"collisions": int(len(test)), "ksi": int(yte.sum()), "months": "October to December 2015"},
        "sha256": sha,
    },
    "evaluation": {
        "base_rate": metrics(p_base),
        "logistic": metrics(p_lr),
        "gbm": metrics(p_gbm),
        "rule": rule_stats,
        "logistic_same_flag_rate": lr_same,
        "bands": bands,
        "calibration": calib,
    },
    "fit": {"method": "Logistic regression, maximum likelihood (statsmodels Logit)",
            "parameters": len(beta), "converged": True,
            "log_likelihood": round(float(logit.llf), 1), "pseudo_r2": round(float(logit.prsquared), 4)},
}

# The test months, one row per collision: a code string (one digit per variable, the index of its
# level) plus the outcome. Used by the app to recompute the evaluation and to find similar real collisions.
codes = np.column_stack([test[v].map({l: i for i, l in enumerate(LEVELS[v])}).values for v, _, _ in VARIABLES])
# last character: outcome (0 slight, 1 serious, 2 fatal)
outcome = test.severity.map({3: 0, 2: 1, 1: 2}).values
rows = ["".join(str(x) for x in r) + str(o) for r, o in zip(codes, outcome)]
testset = {"variables": [v for v, _, _ in VARIABLES], "format": "one digit per variable (level index), then outcome 0 slight / 1 serious / 2 fatal",
           "rows": rows}
# reference probabilities for the browser test: every 97th test row
sample = list(range(0, len(test), 97))
model["check"] = [{"row": i, "p": float(p_lr[i])} for i in sample]

(OUT / "model.json").write_text(json.dumps(model, indent=1, allow_nan=False))
(OUT / "testset.json").write_text(json.dumps(testset, separators=(",", ":"), allow_nan=False))

print(json.dumps({k: model["evaluation"][k] for k in ["base_rate", "logistic", "gbm", "rule", "logistic_same_flag_rate", "bands"]}, indent=1))
print("thresholds", model["thresholds"], "train base", base, "fit", model["fit"])
print("train", len(train), int(ytr.sum()), "test", len(test), int(yte.sum()))
for c_ in sorted(coefs, key=lambda c: -abs(c["beta"]))[:12]:
    print(f"{c_['var']:>11}={c_['level']:<12} OR {c_['or']:.2f} [{c_['or_low']:.2f}, {c_['or_high']:.2f}] p={c_['p']:.1e}")
