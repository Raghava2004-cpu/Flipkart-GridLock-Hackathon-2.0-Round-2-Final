"""
Text Geocoding & Ambient Compiler.
Builds an in-memory localized geocoder from the dataset's historical
police_station + lat/lon profile. No external API calls.
"""
from __future__ import annotations
import math
import re
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "traffic.csv"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


class LocalGeocoder:
    """Maps free-text Bangalore address strings to (lat, lon) using dataset profile."""

    def __init__(self):
        self.stations: Dict[str, Tuple[float, float]] = {}
        self.station_list: List[str] = []
        # Additional Bangalore landmarks for richer geocoding
        self.aliases: Dict[str, Tuple[float, float]] = {}

    def fit(self) -> None:
        df = pd.read_csv(DATA_PATH, usecols=["latitude", "longitude", "police_station"])
        df = df.dropna(subset=["latitude", "longitude", "police_station"])
        agg = df.groupby("police_station")[["latitude", "longitude"]].mean()
        for st, row in agg.iterrows():
            self.stations[st] = (float(row["latitude"]), float(row["longitude"]))
        self.station_list = sorted(self.stations.keys())

        # Common Bangalore landmark aliases not exactly matching station names
        self.aliases = {
            "jalahalli cross": (13.0480, 77.5223),
            "jalahalli": (13.0480, 77.5223),
            "peenya": (13.0290, 77.5180),
            "tumkur road": (13.0345, 77.5050),
            "yeshwanthpur": (13.0286, 77.5540),
            "majestic": (12.9774, 77.5722),
            "mg road": (12.9756, 77.6049),
            "brigade road": (12.9719, 77.6068),
            "indiranagar": (12.9784, 77.6408),
            "koramangala": (12.9352, 77.6245),
            "btm layout": (12.9166, 77.6101),
            "jp nagar": (12.9081, 77.5831),
            "marathahalli": (12.9580, 77.6975),
            "silk board": (12.9176, 77.6232),
            "kr puram": (13.0050, 77.6960),
            "hebbal": (13.0358, 77.5970),
            "yelahanka": (13.1007, 77.5963),
            "banashankari": (12.9249, 77.5460),
            "rajajinagar": (12.9897, 77.5547),
            "malleshwaram": (13.0029, 77.5680),
            "vijayanagar": (12.9719, 77.5371),
            "whitefield": (12.9698, 77.7500),
            "electronic city": (12.8390, 77.6770),
            "sarjapur road": (12.8965, 77.6970),
            "bellandur": (12.9258, 77.6760),
            "bommanahalli": (12.9050, 77.6203),
            "shivajinagar": (12.9856, 77.6051),
            "cubbon park": (12.9763, 77.5929),
            "jayanagar": (12.9250, 77.5938),
            "hsr layout": (12.9116, 77.6383),
            "madiwala": (12.9249, 77.6147),
            "btm": (12.9166, 77.6101),
            "domlur": (12.9606, 77.6383),
            "ulsoor": (12.9810, 77.6213),
            "halasur": (12.9810, 77.6213),
            "frazer town": (12.9974, 77.6094),
            "richmond town": (12.9621, 77.6020),
            "vidhana soudha": (12.9794, 77.5912),
            "town hall": (12.9650, 77.5811),
            "kempegowda": (12.9774, 77.5722),
            "mysore road": (12.9405, 77.5350),
            "hosur road": (12.9116, 77.6383),
            "bannerghatta road": (12.8910, 77.6010),
            "outer ring road": (12.9580, 77.6975),
            "old airport road": (12.9580, 77.6975),
        }

    def geocode(self, text: str) -> Tuple[float, float, str, str]:
        """
        Returns (lat, lon, matched_alias_or_station, source).
        Strategy: lowercase token match against aliases, then station list.
        """
        t = re.sub(r"[^a-z0-9 ]", " ", (text or "").lower())
        t = re.sub(r"\s+", " ", t).strip()
        # Direct alias hit
        best_hit: Tuple[str, Tuple[float, float], str] | None = None
        # Score by length of match (prefer longer alias)
        for key, coord in sorted(self.aliases.items(), key=lambda x: -len(x[0])):
            if key in t:
                best_hit = (key, coord, "alias")
                break
        if best_hit is None:
            for st in sorted(self.station_list, key=lambda x: -len(x)):
                if st.lower() in t and self.stations.get(st):
                    best_hit = (st, self.stations[st], "station")
                    break
        if best_hit is None:
            # Fallback: city centroid (Cubbon Park area)
            return (12.9716, 77.5946, "Bangalore Centroid", "fallback")
        return (best_hit[1][0], best_hit[1][1], best_hit[0], best_hit[2])

    def nearest_station(self, lat: float, lon: float) -> Tuple[str, float, Tuple[float, float]]:
        best, best_d, best_coord = None, 1e9, (lat, lon)
        for st, (slat, slon) in self.stations.items():
            d = haversine_km(lat, lon, slat, slon)
            if d < best_d:
                best, best_d, best_coord = st, d, (slat, slon)
        return best or "Unknown", best_d, best_coord


def compile_ambient(weather_text: str, tod_text: str) -> Dict:
    """Parse weather/time-of-day text into structured flags."""
    w = (weather_text or "").lower()
    if "heavy" in w or "downpour" in w or "storm" in w:
        weather = "heavy_rain"
    elif "rain" in w or "shower" in w or "wet" in w:
        weather = "rain"
    elif "fog" in w or "mist" in w or "haze" in w or "low visibility" in w:
        weather = "fog"
    else:
        weather = "clear"

    t = (tod_text or "").lower()
    if "morning" in t or "am peak" in t:
        tod = "morning_peak"
        peak = 1
    elif "evening" in t or "pm peak" in t or "commute" in t:
        tod = "evening_peak"
        peak = 1
    elif "night" in t or "late" in t:
        tod = "night"
        peak = 0
    else:
        tod = "midday_offpeak"
        peak = 0
    return {"weather": weather, "time_of_day": tod, "peak_hour": peak}
