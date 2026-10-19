"""
Checks the data pipeline. Usage: python test_pipeline.py <data folder>

1. The raw files match the Department for Transport's published 2015 totals.
2. Features use only the levels the model knows, and every collision is kept except those without a time.
3. The exported JSON files are valid, NaN-free and consistent with each other.
"""
import json
import sys
from pathlib import Path

import pandas as pd

from features import LEVELS, build

SRC = Path(sys.argv[1])
APP = Path(__file__).resolve().parent.parent / "app" / "src" / "data"

a = pd.read_csv(SRC / "Accidents_2015.csv", low_memory=False)
c = pd.read_csv(SRC / "Casualties_2015.csv")
# Reported Road Casualties Great Britain: Annual Report 2015 (DfT): 1,730 killed, 22,144 seriously injured, 186,189 casualties
assert len(a) == 140056 and a.Accident_Index.is_unique
assert (c.Casualty_Severity == 1).sum() == 1730
assert (c.Casualty_Severity == 2).sum() == 22144
assert len(c) == 186189 == a.Number_of_Casualties.sum()
print("ok   raw files match the published 2015 totals")

df, dropped = build(SRC)
assert dropped == 18 and len(df) == 140056 - 18
for v, levels in LEVELS.items():
    assert set(df[v]) <= set(levels), v
assert df.ksi.sum() == ((a.Accident_Severity <= 2) & a.Time.notna()).sum()
print("ok   features: all levels known,", len(df), "collisions,", int(df.ksi.sum()), "fatal or serious")

for name in ["model.json", "testset.json", "birmingham.json"]:
    text = (APP / name).read_text()
    assert "NaN" not in text and "Infinity" not in text, name
    json.loads(text)
m = json.loads((APP / "model.json").read_text())
t = json.loads((APP / "testset.json").read_text())
b = json.loads((APP / "birmingham.json").read_text())
assert len(t["rows"]) == m["data"]["test"]["collisions"]
assert sum(r[-1] in "12" for r in t["rows"]) == m["data"]["test"]["ksi"]
assert all(len(r) == len(LEVELS) + 1 for r in t["rows"])
assert m["data"]["train"]["collisions"] + m["data"]["test"]["collisions"] == len(df)
assert len(b["collisions"]) == b["collisions_used"] == b["collisions_in_district"] - len(b["excluded_bad_coordinates"])
assert sum(1 for x in b["collisions"] if x["sev"] <= 2) == b["ksi"]
assert m["thresholds"]["p1"] > m["thresholds"]["p2"]
print("ok   exported files valid and consistent")
