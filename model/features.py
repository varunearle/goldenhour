"""
Builds one row per collision from the official STATS19 2015 files, using only
information an emergency call handler can know at the time of the call.

Every code below is taken from the DfT "Road Accident Safety Data Guide"
(Road-Accident-Safety-Data-Guide.xls, shipped with the data).

Each variable is categorical. Its first level is the reference level of the
logistic regression; the model reports every other level relative to it.
"""
import numpy as np
import pandas as pd

# (variable, label shown in the app, [(level id, level label), ...]); the first level is the reference.
VARIABLES = [
    ("hour", "Time of day", [("day", "10:00 to 15:59"), ("night", "00:00 to 05:59"), ("morning", "06:00 to 09:59"),
                             ("evening", "16:00 to 19:59"), ("late", "20:00 to 23:59")]),
    ("weekend", "Day", [("no", "Monday to Friday"), ("yes", "Saturday or Sunday")]),
    ("speed", "Speed limit", [("30", "30 mph"), ("20", "20 mph or less"), ("40", "40 mph"), ("50", "50 mph"),
                              ("60", "60 mph"), ("70", "70 mph")]),
    ("road", "Road type", [("single", "Single carriageway"), ("dual", "Dual carriageway"), ("roundabout", "Roundabout"),
                           ("oneway", "One way street"), ("slip", "Slip road"), ("unknown", "Unknown")]),
    ("junction", "Junction", [("no", "Not at a junction"), ("yes", "At or within 20 m of a junction")]),
    ("light", "Light", [("daylight", "Daylight"), ("dark_lit", "Dark, street lights on"),
                        ("dark_unlit", "Dark, no lights or lights off"), ("dark_unknown", "Dark, lighting unknown")]),
    ("weather", "Weather", [("fine", "Fine"), ("rain", "Raining"), ("snow", "Snowing"), ("fog", "Fog or mist"),
                            ("other", "Other or unknown")]),
    ("wind", "High winds", [("no", "No"), ("yes", "Yes")]),
    ("surface", "Road surface", [("dry", "Dry"), ("wet", "Wet or damp"), ("ice", "Snow, frost or ice"),
                                 ("flood", "Flooded"), ("unknown", "Unknown")]),
    ("area", "Area", [("urban", "Urban"), ("rural", "Rural")]),
    ("vehicles", "Vehicles involved", [("2", "2"), ("1", "1 (single vehicle)"), ("3", "3 or more")]),
    ("casualties", "People hurt", [("1", "1"), ("2", "2"), ("3", "3 or more")]),
    ("pedestrian", "Pedestrian hit", [("no", "No"), ("yes", "Yes")]),
    ("motorcycle", "Motorcycle involved", [("no", "No"), ("yes", "Yes")]),
    ("cycle", "Bicycle involved", [("no", "No"), ("yes", "Yes")]),
    ("hgv", "Goods vehicle over 3.5 t involved", [("no", "No"), ("yes", "Yes")]),
    ("bus", "Bus or coach involved", [("no", "No"), ("yes", "Yes")]),
    ("overturned", "Vehicle overturned", [("no", "No"), ("yes", "Yes")]),
    ("offroad", "Vehicle left the road", [("no", "No"), ("yes", "Yes")]),
]
LEVELS = {v: [l[0] for l in levels] for v, _, levels in VARIABLES}

MOTORCYCLE = {2, 3, 4, 5, 23, 97}   # Vehicle Type sheet
HGV = {20, 21}                       # goods over 3.5 t
BUS = {10, 11}                       # minibus, bus or coach
OVERTURNED = {2, 4, 5}               # Skidding and Overturning sheet
LEFT_ROAD = set(range(1, 9))         # Veh Leaving Carriageway 1..8


def hour_band(t: str) -> str:
    h = int(t.split(":")[0])
    if h < 6:
        return "night"
    if h < 10:
        return "morning"
    if h < 16:
        return "day"
    if h < 20:
        return "evening"
    return "late"


def build(folder):
    a = pd.read_csv(f"{folder}/Accidents_2015.csv", low_memory=False)
    v = pd.read_csv(f"{folder}/Vehicles_2015.csv", low_memory=False)
    c = pd.read_csv(f"{folder}/Casualties_2015.csv")

    n0 = len(a)
    a = a[a["Time"].notna()].copy()          # 18 collisions have no recorded time
    dropped_no_time = n0 - len(a)

    vt = v.groupby("Accident_Index")
    flags = pd.DataFrame({
        "motorcycle": vt["Vehicle_Type"].apply(lambda s: bool(set(s) & MOTORCYCLE)),
        "cycle": vt["Vehicle_Type"].apply(lambda s: 1 in set(s)),
        "hgv": vt["Vehicle_Type"].apply(lambda s: bool(set(s) & HGV)),
        "bus": vt["Vehicle_Type"].apply(lambda s: bool(set(s) & BUS)),
        "overturned": vt["Skidding_and_Overturning"].apply(lambda s: bool(set(s) & OVERTURNED)),
        "offroad": vt["Vehicle_Leaving_Carriageway"].apply(lambda s: bool(set(s) & LEFT_ROAD)),
    })
    ped = c.groupby("Accident_Index")["Casualty_Class"].apply(lambda s: 3 in set(s)).rename("pedestrian")
    a = a.join(flags, on="Accident_Index").join(ped, on="Accident_Index")
    for col in ["motorcycle", "cycle", "hgv", "bus", "overturned", "offroad", "pedestrian"]:
        a[col] = a[col].fillna(False).astype(bool)

    yn = lambda b: np.where(b, "yes", "no")
    speed = a["Speed_limit"].clip(lower=20).astype(int).astype(str)   # 0 and 10 mph (3 rows) grouped with 20
    road = a["Road_Type"].map({1: "roundabout", 2: "oneway", 3: "dual", 6: "single", 7: "slip", 9: "unknown",
                               12: "oneway"}).fillna("unknown")
    light = a["Light_Conditions"].map({1: "daylight", 4: "dark_lit", 5: "dark_unlit", 6: "dark_unlit",
                                       7: "dark_unknown"}).fillna("dark_unknown")
    weather = a["Weather_Conditions"].map({1: "fine", 4: "fine", 2: "rain", 5: "rain", 3: "snow", 6: "snow",
                                           7: "fog", 8: "other", 9: "other"}).fillna("other")
    surface = a["Road_Surface_Conditions"].map({1: "dry", 2: "wet", 3: "ice", 4: "ice", 5: "flood",
                                                6: "unknown", 7: "unknown"}).fillna("unknown")

    out = pd.DataFrame({
        "id": a["Accident_Index"],
        "date": pd.to_datetime(a["Date"], format="%d/%m/%Y"),
        "time": a["Time"],
        "district": a["Local_Authority_(District)"],
        "easting": a["Location_Easting_OSGR"],
        "northing": a["Location_Northing_OSGR"],
        "severity": a["Accident_Severity"],          # 1 fatal, 2 serious, 3 slight
        "hour": a["Time"].map(hour_band),
        "weekend": yn(a["Day_of_Week"].isin([1, 7])),
        "speed": speed,
        "road": road,
        "junction": yn(a["Junction_Detail"] > 0),
        "light": light,
        "weather": weather,
        "wind": yn(a["Weather_Conditions"].isin([4, 5, 6])),
        "surface": surface,
        "area": np.where(a["Urban_or_Rural_Area"] == 2, "rural", "urban"),
        "vehicles": np.where(a["Number_of_Vehicles"] >= 3, "3", a["Number_of_Vehicles"].astype(str)),
        "casualties": np.where(a["Number_of_Casualties"] >= 3, "3", a["Number_of_Casualties"].astype(str)),
        "pedestrian": yn(a["pedestrian"]),
        "motorcycle": yn(a["motorcycle"]),
        "cycle": yn(a["cycle"]),
        "hgv": yn(a["hgv"]),
        "bus": yn(a["bus"]),
        "overturned": yn(a["overturned"]),
        "offroad": yn(a["offroad"]),
    })
    out["ksi"] = (out["severity"] <= 2).astype(int)   # killed or seriously injured
    for var, levels in LEVELS.items():
        bad = set(out[var]) - set(levels)
        assert not bad, (var, bad)
    return out.reset_index(drop=True), dropped_no_time


def design(df):
    """One-hot design matrix with the reference level of each variable left out."""
    cols, names = [], []
    for var, _, levels in VARIABLES:
        for lid, _ in levels[1:]:
            cols.append((df[var] == lid).astype(float).values)
            names.append(f"{var}={lid}")
    return np.column_stack(cols), names
