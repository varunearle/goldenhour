"""
Birmingham (local authority district 300), STATS19 2015.

1. Hotspots: DBSCAN on every injury collision of 2015. A hotspot is a group of at least
   8 collisions where each sits within 100 m of other members of the group.
2. Ambulance standby points: K-Means on the fatal and serious (KSI) collisions of
   January to September; tested on the KSI collisions of October to December, which the
   method has not seen. Compared with:
     - evenly spread points (K-Means on a uniform 250 m grid over the area where collisions occur),
     - random points (random past collision locations, averaged over 1,000 draws).
Distances are straight-line, in kilometres, on the British National Grid (metres).

Usage: python hotspots.py <data folder>
Writes ../app/src/data/birmingham.json
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import ConvexHull, Delaunay
from sklearn.cluster import DBSCAN, KMeans

from features import LEVELS, VARIABLES, build

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "app" / "src" / "data"

df, _ = build(SRC)
raw = pd.read_csv(SRC / "Accidents_2015.csv", low_memory=False).set_index("Accident_Index")
CLASS = {1: "M", 2: "A", 3: "A", 4: "B"}   # 1st/2nd Road Class sheet: 1 Motorway, 2 A(M), 3 A, 4 B, 5 C, 6 Unclassified


def road_name(cls, num):
    if cls in CLASS and num > 0:
        return f"{CLASS[cls]}{int(num)}" + ("(M)" if cls == 2 else "")
    if cls == 5:
        return "C road"
    return None   # 6 Unclassified, or a numbered class with no number recorded


b = df[df.district == 300].copy()
b["road1"] = [road_name(raw.at[i, "1st_Road_Class"], raw.at[i, "1st_Road_Number"]) for i in b.id]
b["road2"] = [road_name(raw.at[i, "2nd_Road_Class"], raw.at[i, "2nd_Road_Number"]) for i in b.id]
n_district = len(b)
inside = b.easting.between(395000, 420000) & b.northing.between(275000, 305000)
excluded = b[~inside].id.tolist()
b = b[inside].reset_index(drop=True)
XY = b[["easting", "northing"]].values.astype(float)

# ---------------------------------------------------------------- hotspots
EPS, MIN = 100, 8
lab = DBSCAN(eps=EPS, min_samples=MIN).fit(XY).labels_
hot = []
for k in range(lab.max() + 1):
    m = lab == k
    pts = XY[m]
    c = pts.mean(axis=0)
    r = float(np.sqrt(((pts - c) ** 2).sum(axis=1)).max())
    roads = pd.Series([x for x in list(b.road1.values[m]) + list(b.road2.values[m]) if isinstance(x, str)]).value_counts()
    label = " / ".join(roads.index[:2]) if len(roads) else "Unclassified roads"
    hot.append({"roads": label, "e": round(float(c[0])), "n": round(float(c[1])), "radius_m": round(r),
                "collisions": int(m.sum()), "ksi": int(b.ksi.values[m].sum()),
                "fatal": int((b.severity.values[m] == 1).sum()),
                "pedestrian": int((b.pedestrian.values[m] == "yes").sum()),
                "night_or_dark": int(((b.light.values[m] != "daylight")).sum())})
hot.sort(key=lambda h: (-h["ksi"], -h["collisions"]))
for i, h in enumerate(hot):
    h["rank"] = i + 1

# ---------------------------------------------------------------- standby points
train = b[b.date.dt.month <= 9]
test = b[b.date.dt.month >= 10]
ksi_tr = train[train.ksi == 1][["easting", "northing"]].values.astype(float)
ksi_te = test[test.ksi == 1][["easting", "northing"]].values.astype(float)
all_tr = train[["easting", "northing"]].values.astype(float)

hull = ConvexHull(XY)
tri = Delaunay(XY[hull.vertices])
gx, gy = np.meshgrid(np.arange(XY[:, 0].min(), XY[:, 0].max(), 250), np.arange(XY[:, 1].min(), XY[:, 1].max(), 250))
grid = np.column_stack([gx.ravel(), gy.ravel()])
grid = grid[tri.find_simplex(grid) >= 0]


def dist_km(points, centres):
    d = np.sqrt(((points[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2)).min(axis=1)
    return d / 1000


def summary(d):
    return {"mean_km": round(float(d.mean()), 2), "median_km": round(float(np.median(d)), 2),
            "within_2km": round(float((d <= 2).mean()), 3), "within_3km": round(float((d <= 3).mean()), 3)}


rng = np.random.default_rng(0)
standby = []
for k in range(3, 9):
    km = KMeans(n_clusters=k, n_init=50, random_state=0).fit(ksi_tr)
    even = KMeans(n_clusters=k, n_init=20, random_state=0).fit(grid)
    rand = [dist_km(ksi_te, all_tr[rng.choice(len(all_tr), k, replace=False)]) for _ in range(1000)]
    rand_summary = {key: round(float(np.mean([summary(d)[key] for d in rand])), 3) for key in summary(rand[0])}
    rand_summary["mean_km"] = round(rand_summary["mean_km"], 2)
    rand_summary["median_km"] = round(rand_summary["median_km"], 2)
    standby.append({
        "k": k,
        "points": [{"e": round(float(e)), "n": round(float(n)),
                    "train_ksi": int((km.labels_ == i).sum())} for i, (e, n) in enumerate(km.cluster_centers_)],
        "even_points": [{"e": round(float(e)), "n": round(float(n))} for e, n in even.cluster_centers_],
        "test": {"kmeans": summary(dist_km(ksi_te, km.cluster_centers_)),
                 "even": summary(dist_km(ksi_te, even.cluster_centers_)),
                 "random": rand_summary},
    })

# ---------------------------------------------------------------- collisions for the map and the replay
code = {v: {l: i for i, l in enumerate(LEVELS[v])} for v, _, _ in VARIABLES}
collisions = []
for r in b.itertuples(index=False):
    collisions.append({
        "id": r.id, "e": int(r.easting), "n": int(r.northing),
        "date": r.date.strftime("%Y-%m-%d"), "time": r.time,
        "sev": int(r.severity), "hot": int(lab[len(collisions)]), "road": r.road1 if isinstance(r.road1, str) else "Unclassified road",
        "x": "".join(str(code[v][getattr(r, v)]) for v, _, _ in VARIABLES),
    })

out = {
    "district": "Birmingham", "district_code": 300, "year": 2015,
    "collisions_in_district": n_district, "excluded_bad_coordinates": excluded,
    "collisions_used": len(b), "ksi": int(b.ksi.sum()), "fatal": int((b.severity == 1).sum()),
    "bounds": {"e_min": int(XY[:, 0].min()), "e_max": int(XY[:, 0].max()),
               "n_min": int(XY[:, 1].min()), "n_max": int(XY[:, 1].max())},
    "hull": [[int(XY[i, 0]), int(XY[i, 1])] for i in hull.vertices],
    "dbscan": {"eps_m": EPS, "min_samples": MIN, "hotspots": hot,
               "collisions_in_hotspots": int((lab >= 0).sum())},
    "standby": {"train_ksi": int(len(ksi_tr)), "test_ksi": int(len(ksi_te)), "options": standby},
    "variables": [v for v, _, _ in VARIABLES],
    "collisions": collisions,
}
(OUT / "birmingham.json").write_text(json.dumps(out, separators=(",", ":"), allow_nan=False))

print("used", len(b), "excluded", excluded, "ksi", out["ksi"], "fatal", out["fatal"])
print("hotspots", len(hot), "in hotspots", out["dbscan"]["collisions_in_hotspots"])
for h in hot[:6]:
    print(h)
print("train KSI", len(ksi_tr), "test KSI", len(ksi_te))
for s in standby:
    print(s["k"], s["test"])
