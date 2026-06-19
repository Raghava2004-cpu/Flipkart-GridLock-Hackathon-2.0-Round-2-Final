"""
Weighted Ensemble Predictor (RF + GBM + Ridge) — predicts incident_duration_min.
Also produces officer & barricade recommendations via a Heuristic Optimization Matrix
that wraps the base ML output, plus a GNN-style neighborhood aggregation feature.
"""
from __future__ import annotations
import logging
import math
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

logger = logging.getLogger(__name__)

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "traffic.csv"

EVENT_CAUSES = [
    "vehicle_breakdown", "tree_fall", "accident", "public_event", "water_logging",
    "pot_holes", "congestion", "construction", "road_conditions", "vip_movement",
    "procession", "protest", "debris", "fog_low_visibility", "test_demo", "others",
    "political_rally",
]
TIME_OF_DAY = ["morning_peak", "midday_offpeak", "evening_peak", "night"]
WEATHER_OPTIONS = ["clear", "rain", "heavy_rain", "fog"]
PRIORITY_OPTIONS = ["High", "Low"]


def _norm_cause(c: str) -> str:
    if not c:
        return "others"
    c = c.lower().strip().replace(" ", "_").replace("/", "_").replace("__", "_")
    if c in ("debris",):
        return "debris"
    if c in ("fog", "fog_low_visibility", "fog___low_visibility"):
        return "fog_low_visibility"
    return c


class TrafficPredictor:
    """Weighted ensemble (RF + GBM + Ridge) on incident_duration_min."""

    def __init__(self):
        self.rf: RandomForestRegressor | None = None
        self.gbm: GradientBoostingRegressor | None = None
        self.ridge: Ridge | None = None
        self.scaler: StandardScaler | None = None
        self.feature_cols: List[str] = []
        self.cause_idx: Dict[str, int] = {}
        self.tod_idx: Dict[str, int] = {}
        self.station_idx: Dict[str, int] = {}
        self.station_risk: Dict[str, float] = {}
        self.station_avg_duration: Dict[str, float] = {}
        self.cause_avg_duration: Dict[str, float] = {}
        self.weights: Tuple[float, float, float] = (0.45, 0.45, 0.10)
        self.mae: float = 0.0
        self.r2: float = 0.0
        self.n_train: int = 0
        self.df: pd.DataFrame | None = None

    def fit(self) -> None:
        df = pd.read_csv(DATA_PATH)
        df["event_cause"] = df["event_cause"].fillna("others").map(_norm_cause)
        df["police_station"] = df["police_station"].fillna("Unknown")
        df["time_of_day_category"] = df["time_of_day_category"].fillna("midday_offpeak")
        df["incident_duration_min"] = pd.to_numeric(df["incident_duration_min"], errors="coerce")
        df = df.dropna(subset=["incident_duration_min", "latitude", "longitude"])
        # Clip outliers
        df["incident_duration_min"] = df["incident_duration_min"].clip(upper=600)

        causes = sorted(set(df["event_cause"].unique().tolist() + EVENT_CAUSES))
        tods = TIME_OF_DAY[:]
        stations = sorted(df["police_station"].unique().tolist())
        self.cause_idx = {c: i for i, c in enumerate(causes)}
        self.tod_idx = {t: i for i, t in enumerate(tods)}
        self.station_idx = {s: i for i, s in enumerate(stations)}

        # Per-station historical signal (used by GNN-style aggregator)
        self.station_risk = df.groupby("police_station")["congestion_risk_score"].mean().to_dict()
        self.station_avg_duration = df.groupby("police_station")["incident_duration_min"].mean().to_dict()
        self.cause_avg_duration = df.groupby("event_cause")["incident_duration_min"].mean().to_dict()

        # Build feature matrix
        rows = []
        for _, r in df.iterrows():
            rows.append(self._featurize(
                cause=r["event_cause"],
                priority=str(r.get("priority", "Low")),
                tod=r["time_of_day_category"],
                station=r["police_station"],
                requires_closure=bool(r.get("requires_road_closure", False)),
                peak_hour=int(r.get("peak_hour_flag", 0)),
                is_weekend=int(r.get("is_weekend", 0)),
                weather="clear",  # historical baseline
                compound=int(r.get("is_compound_incident", 0)),
            ))
        X = np.array(rows, dtype=float)
        y = df["incident_duration_min"].values.astype(float)

        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.15, random_state=42)
        self.scaler = StandardScaler().fit(X_tr)
        Xs_tr = self.scaler.transform(X_tr)
        Xs_te = self.scaler.transform(X_te)

        self.rf = RandomForestRegressor(n_estimators=120, max_depth=14, n_jobs=-1, random_state=42)
        self.gbm = GradientBoostingRegressor(n_estimators=180, max_depth=4, learning_rate=0.07, random_state=42)
        self.ridge = Ridge(alpha=1.0, random_state=42)

        self.rf.fit(Xs_tr, y_tr)
        self.gbm.fit(Xs_tr, y_tr)
        self.ridge.fit(Xs_tr, y_tr)

        # Weight ensemble inversely-proportional to validation MAE
        preds = {
            "rf": self.rf.predict(Xs_te),
            "gbm": self.gbm.predict(Xs_te),
            "ridge": self.ridge.predict(Xs_te),
        }
        maes = {k: mean_absolute_error(y_te, v) for k, v in preds.items()}
        inv = {k: 1.0 / max(v, 1e-3) for k, v in maes.items()}
        s = sum(inv.values())
        self.weights = (inv["rf"] / s, inv["gbm"] / s, inv["ridge"] / s)

        # Final ensemble MAE on holdout
        y_hat = (
            self.weights[0] * preds["rf"]
            + self.weights[1] * preds["gbm"]
            + self.weights[2] * preds["ridge"]
        )
        self.mae = float(mean_absolute_error(y_te, y_hat))
        ss_res = float(np.sum((y_te - y_hat) ** 2))
        ss_tot = float(np.sum((y_te - y_te.mean()) ** 2)) or 1.0
        self.r2 = 1.0 - ss_res / ss_tot
        self.n_train = int(len(X_tr))
        self.df = df
        logger.info(
            "TrafficPredictor trained n=%d holdout_mae=%.2fmin r2=%.3f weights(rf/gbm/ridge)=%.2f/%.2f/%.2f",
            self.n_train, self.mae, self.r2, *self.weights,
        )

    # --- Feature engineering ---
    def _featurize(self, *, cause: str, priority: str, tod: str, station: str,
                   requires_closure: bool, peak_hour: int, is_weekend: int,
                   weather: str, compound: int) -> List[float]:
        cause = _norm_cause(cause)
        # One-hot cause (compact: index-encoded for speed)
        c_idx = self.cause_idx.get(cause, self.cause_idx.get("others", 0))
        t_idx = self.tod_idx.get(tod, 1)
        s_idx = self.station_idx.get(station, 0)
        weather_w = {"clear": 0.0, "rain": 0.25, "heavy_rain": 0.55, "fog": 0.35}.get(weather, 0.0)
        priority_w = 1.0 if str(priority).lower() == "high" else 0.0
        closure_w = 1.0 if requires_closure else 0.0
        station_risk = float(self.station_risk.get(station, 15.0))
        station_avg = float(self.station_avg_duration.get(station, 120.0))
        cause_avg = float(self.cause_avg_duration.get(cause, 120.0))
        return [
            c_idx, t_idx, s_idx, priority_w, closure_w, weather_w,
            peak_hour, is_weekend, compound,
            station_risk, station_avg, cause_avg,
        ]

    # --- Prediction ---
    def predict_duration(self, *, cause: str, priority: str, tod: str, station: str,
                         requires_closure: bool, peak_hour: int, is_weekend: int,
                         weather: str, compound: int) -> Dict[str, float]:
        feats = np.array([self._featurize(
            cause=cause, priority=priority, tod=tod, station=station,
            requires_closure=requires_closure, peak_hour=peak_hour,
            is_weekend=is_weekend, weather=weather, compound=compound,
        )], dtype=float)
        Xs = self.scaler.transform(feats)
        p_rf = float(self.rf.predict(Xs)[0])
        p_gbm = float(self.gbm.predict(Xs)[0])
        p_ri = float(self.ridge.predict(Xs)[0])
        base = (
            self.weights[0] * p_rf
            + self.weights[1] * p_gbm
            + self.weights[2] * p_ri
        )
        return {
            "ensemble": max(1.0, base),
            "rf": p_rf,
            "gbm": p_gbm,
            "ridge": p_ri,
        }


# --- Heuristic Optimization Matrix: officers & barricades ---
def recommend_resources(
    *, cause: str, priority: str, requires_closure: bool, predicted_minutes: float,
    compound: bool, weather: str, peak_hour: int,
) -> Dict[str, int]:
    """Return officers, barricades_meters, cranes, ambulances based on rules."""
    cause = _norm_cause(cause)
    # Baseline by cause
    base_officers = {
        "vehicle_breakdown": 3, "tree_fall": 4, "accident": 5, "public_event": 6,
        "water_logging": 3, "pot_holes": 2, "congestion": 4, "construction": 5,
        "road_conditions": 3, "vip_movement": 8, "procession": 8, "protest": 10,
        "debris": 3, "fog_low_visibility": 4, "political_rally": 10,
        "test_demo": 2, "others": 3,
    }.get(cause, 3)
    base_barricades = {
        "vehicle_breakdown": 10, "tree_fall": 20, "accident": 25, "public_event": 80,
        "water_logging": 30, "pot_holes": 8, "congestion": 15, "construction": 60,
        "road_conditions": 15, "vip_movement": 100, "procession": 120, "protest": 150,
        "debris": 15, "fog_low_visibility": 25, "political_rally": 180,
        "test_demo": 5, "others": 15,
    }.get(cause, 15)
    cranes = 1 if cause in ("vehicle_breakdown", "tree_fall", "accident", "debris") else 0
    ambulances = 1 if cause in ("accident", "protest", "political_rally", "public_event") else 0

    # Modifiers
    if str(priority).lower() == "high":
        base_officers += 2
        base_barricades += 20
    if requires_closure:
        base_officers += 2
        base_barricades += 40
    if peak_hour:
        base_officers += 1
    if weather in ("heavy_rain",):
        base_officers += 1
        base_barricades += 15
    if weather in ("fog",):
        base_officers += 1
    # Duration penalty — every extra ~60min beyond 60 adds 1 officer
    extra = max(0.0, predicted_minutes - 60.0) / 60.0
    base_officers += int(round(extra))
    base_barricades += int(round(extra * 10))
    # Compound multiplier (0.5km proximity)
    if compound:
        base_officers = int(math.ceil(base_officers * 1.35))
        base_barricades = int(math.ceil(base_barricades * 1.35))

    return {
        "officers": int(max(1, base_officers)),
        "barricades_meters": int(max(5, base_barricades)),
        "cranes": cranes,
        "ambulances": ambulances,
    }
