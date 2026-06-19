"""
Traffic Congestion Intelligence Engine — Backend (FastAPI).
- Trains weighted ensemble (RF + GBM + Ridge) on the Bangalore dataset.
- Heuristic Optimization Matrix for officers/barricades.
- Spatial-Temporal Interaction Grid (0.5km Haversine proximity -> compound multiplier 1.35x).
- Network Penalty Matrix (Dijkstra over 54 police-station graph) for diversion.
- Resolution-Lag RL feedback loop on Mark-Resolved.
"""
from __future__ import annotations
import logging
import math
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from starlette.middleware.cors import CORSMiddleware

from engine.ml_engine import (
    TrafficPredictor, recommend_resources,
    EVENT_CAUSES, WEATHER_OPTIONS, PRIORITY_OPTIONS, TIME_OF_DAY,
)
from engine.geocode import LocalGeocoder, haversine_km, compile_ambient
from engine.graph_engine import CityNetwork
from engine.rl_engine import RLFeedback

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("tcie")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Traffic Congestion Intelligence Engine")
api = APIRouter(prefix="/api")

# ---------- ML / Engine singletons ----------
predictor = TrafficPredictor()
geocoder = LocalGeocoder()
network = CityNetwork()
rl = RLFeedback()

PROXIMITY_KM = 0.5
COMPOUND_MULTIPLIER = 1.35


@app.on_event("startup")
async def startup_event() -> None:
    logger.info("Loading geocoder…")
    geocoder.fit()
    logger.info("Training weighted ensemble predictor…")
    predictor.fit()
    logger.info("Building city network graph…")
    network.fit(geocoder.stations)
    logger.info("TCIE ready. stations=%d mae=%.2f", len(geocoder.stations), predictor.mae)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    client.close()


# ---------- Pydantic models ----------
class IncidentCreate(BaseModel):
    address_text: str = Field(..., min_length=2, max_length=200)
    event_cause: str
    priority: str = "High"  # High | Low
    weather: str = "clear"  # clear | rain | heavy_rain | fog
    time_of_day: str = "midday_offpeak"
    requires_road_closure: bool = False
    is_weekend: int = 0


class ResolveBody(BaseModel):
    actual_minutes: Optional[float] = None  # If absent, use elapsed from created_at


class Incident(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    address_text: str
    event_cause: str
    priority: str
    weather: str
    time_of_day: str
    requires_road_closure: bool
    is_weekend: int

    lat: float
    lon: float
    matched_location: str
    nearest_station: str
    nearest_station_distance_km: float
    nearest_station_lat: float
    nearest_station_lon: float

    predicted_minutes_raw: float
    predicted_minutes: float  # after RL bias + compound multiplier
    rl_bias: float
    is_compound: bool
    compound_with: List[str] = []

    officers: int
    barricades_meters: int
    cranes: int
    ambulances: int

    severity: str  # Low | Medium | High | Critical
    status: str  # active | resolved
    created_at: str
    resolved_at: Optional[str] = None
    actual_minutes: Optional[float] = None
    rl_reward: Optional[float] = None

    # Computed enrichments (added on read)
    barricades_count: Optional[int] = 0
    diversion_path: List[str] = []


# ---------- Helpers ----------
def _severity(minutes: float, priority: str, compound: bool) -> str:
    score = minutes + (40 if priority.lower() == "high" else 0) + (60 if compound else 0)
    if score >= 220:
        return "Critical"
    if score >= 140:
        return "High"
    if score >= 70:
        return "Medium"
    return "Low"


async def _list_active() -> List[dict]:
    cur = db.incidents.find({"status": "active"}, {"_id": 0})
    docs = await cur.to_list(500)
    return [_enrich(d) for d in docs]


async def _list_all(limit: int = 500) -> List[dict]:
    cur = db.incidents.find({}, {"_id": 0}).sort("created_at", -1)
    docs = await cur.to_list(limit)
    return [_enrich(d) for d in docs]


def _enrich(d: dict) -> dict:
    """Add derived fields used by the UI (barricade count, diversion path)."""
    try:
        meters = int(d.get("barricades_meters") or 0)
        # 2.5 m per standard police barricade
        d["barricades_count"] = max(1, math.ceil(meters / 2.5)) if meters > 0 else 0
    except Exception:
        d["barricades_count"] = 0
    try:
        st = d.get("nearest_station")
        if st and st in network.G:
            plan = network.diversion_plan(st)
            d["diversion_path"] = plan.get("diverted", []) or []
        else:
            d["diversion_path"] = []
    except Exception:
        d["diversion_path"] = []
    return d


# ---------- Routes ----------
@api.get("/")
async def root():
    return {"service": "Traffic Congestion Intelligence Engine", "status": "ok"}


@api.get("/meta")
async def meta():
    return {
        "event_causes": EVENT_CAUSES,
        "weather_options": WEATHER_OPTIONS,
        "priority_options": PRIORITY_OPTIONS,
        "time_of_day": TIME_OF_DAY,
        "proximity_km": PROXIMITY_KM,
        "compound_multiplier": COMPOUND_MULTIPLIER,
        "mappls_key": os.environ.get("MAPPLS_KEY", ""),  # not used; frontend has its own
    }


@api.get("/police-stations")
async def police_stations():
    return [
        {"name": s, "lat": lat, "lon": lon}
        for s, (lat, lon) in geocoder.stations.items()
    ]


@api.get("/model-status")
async def model_status():
    return {
        "ensemble_weights": {
            "random_forest": round(predictor.weights[0], 3),
            "gradient_boost": round(predictor.weights[1], 3),
            "ridge": round(predictor.weights[2], 3),
        },
        "holdout_mae_minutes": round(predictor.mae, 2),
        "holdout_r2": round(predictor.r2, 3),
        "n_train": predictor.n_train,
        "n_stations": len(geocoder.stations),
        "rl": rl.status(),
    }


@api.post("/geocode")
async def geocode(payload: dict):
    text = (payload or {}).get("text", "")
    lat, lon, hit, src = geocoder.geocode(text)
    st, d, (slat, slon) = geocoder.nearest_station(lat, lon)
    return {
        "lat": lat, "lon": lon, "matched": hit, "source": src,
        "nearest_station": st, "nearest_station_distance_km": round(d, 2),
        "nearest_station_lat": slat, "nearest_station_lon": slon,
    }


@api.post("/incidents", response_model=Incident)
async def create_incident(body: IncidentCreate):
    # 1. Geocode
    lat, lon, matched, _src = geocoder.geocode(body.address_text)
    nearest_st, nearest_d, (st_lat, st_lon) = geocoder.nearest_station(lat, lon)

    # 2. Compound proximity check vs active incidents
    active = await _list_active()
    compound_with: List[str] = []
    for a in active:
        d = haversine_km(lat, lon, a["lat"], a["lon"])
        if d <= PROXIMITY_KM:
            compound_with.append(a["id"])
    is_compound = len(compound_with) > 0

    # 3. Ambient flags
    amb = compile_ambient(body.weather, body.time_of_day)

    # 4. Base prediction
    preds = predictor.predict_duration(
        cause=body.event_cause,
        priority=body.priority,
        tod=body.time_of_day,
        station=nearest_st,
        requires_closure=body.requires_road_closure,
        peak_hour=amb["peak_hour"],
        is_weekend=body.is_weekend,
        weather=body.weather,
        compound=int(is_compound),
    )
    rl.record_prediction()
    base_minutes = preds["ensemble"]

    # 5. Apply RL bias + compound multiplier
    bias = rl.get_bias(nearest_st, body.event_cause)
    adjusted = base_minutes * bias
    if is_compound:
        adjusted *= COMPOUND_MULTIPLIER
    adjusted = max(2.0, min(720.0, adjusted))

    # 6. Resource recommendation
    res = recommend_resources(
        cause=body.event_cause, priority=body.priority,
        requires_closure=body.requires_road_closure, predicted_minutes=adjusted,
        compound=is_compound, weather=body.weather, peak_hour=amb["peak_hour"],
    )

    # 7. Bump existing nearby incidents to compound (they share the cluster)
    if compound_with:
        await db.incidents.update_many(
            {"id": {"$in": compound_with}},
            {"$set": {"is_compound": True}, "$addToSet": {"compound_with": "__pending__"}},
        )

    # 8. Persist
    now = datetime.now(timezone.utc).isoformat()
    doc = Incident(
        id=str(uuid.uuid4()),
        address_text=body.address_text,
        event_cause=body.event_cause,
        priority=body.priority,
        weather=body.weather,
        time_of_day=body.time_of_day,
        requires_road_closure=body.requires_road_closure,
        is_weekend=body.is_weekend,
        lat=lat, lon=lon, matched_location=matched,
        nearest_station=nearest_st,
        nearest_station_distance_km=round(nearest_d, 2),
        nearest_station_lat=st_lat,
        nearest_station_lon=st_lon,
        predicted_minutes_raw=round(base_minutes, 1),
        predicted_minutes=round(adjusted, 1),
        rl_bias=round(bias, 3),
        is_compound=is_compound,
        compound_with=compound_with,
        officers=res["officers"],
        barricades_meters=res["barricades_meters"],
        cranes=res["cranes"],
        ambulances=res["ambulances"],
        severity=_severity(adjusted, body.priority, is_compound),
        status="active",
        created_at=now,
    )
    await db.incidents.insert_one(doc.model_dump())
    # Update reverse linkage for nearby incidents
    if compound_with:
        await db.incidents.update_many(
            {"id": {"$in": compound_with}},
            {"$set": {"is_compound": True}, "$addToSet": {"compound_with": doc.id}},
        )
        # Pull the placeholder
        await db.incidents.update_many(
            {"id": {"$in": compound_with}},
            {"$pull": {"compound_with": "__pending__"}},
        )

    # Apply diversion penalty on the network for this station
    for n in list(network.G.neighbors(nearest_st)) if nearest_st in network.G else []:
        network.set_penalty(nearest_st, n, 10.0)

    return Incident(**_enrich(doc.model_dump()))


@api.get("/incidents/active", response_model=List[Incident])
async def list_active():
    docs = await _list_active()
    return [Incident(**d) for d in docs]


@api.get("/incidents", response_model=List[Incident])
async def list_all(limit: int = 200):
    docs = await _list_all(limit)
    return [Incident(**d) for d in docs]


@api.post("/incidents/{incident_id}/resolve", response_model=Incident)
async def resolve_incident(incident_id: str, body: ResolveBody):
    doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Incident not found")
    if doc.get("status") == "resolved":
        return Incident(**doc)

    now = datetime.now(timezone.utc)
    if body.actual_minutes is not None:
        actual_min = float(body.actual_minutes)
    else:
        try:
            created = datetime.fromisoformat(doc["created_at"])
        except Exception:
            created = now
        actual_min = max(0.5, (now - created).total_seconds() / 60.0)

    # RL update
    event = rl.update(
        station=doc["nearest_station"], cause=doc["event_cause"],
        predicted=float(doc["predicted_minutes"]), actual=actual_min,
        officers_used=int(doc["officers"]), barricades_used=int(doc["barricades_meters"]),
    )

    update = {
        "status": "resolved",
        "resolved_at": now.isoformat(),
        "actual_minutes": round(actual_min, 1),
        "rl_reward": event["reward"],
    }
    await db.incidents.update_one({"id": incident_id}, {"$set": update})

    # Clear diversion penalty if no other active incident hits the same station
    remaining = await db.incidents.count_documents({
        "status": "active", "nearest_station": doc["nearest_station"],
    })
    if remaining == 0 and doc["nearest_station"] in network.G:
        for n in list(network.G.neighbors(doc["nearest_station"])):
            network.clear_penalty(doc["nearest_station"], n)

    doc.update(update)
    return Incident(**doc)


@api.get("/incidents/{incident_id}/diversion")
async def diversion_for(incident_id: str):
    doc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Incident not found")
    plan = network.diversion_plan(doc["nearest_station"])
    # Enrich with coordinates
    def coords_for(names: List[str]):
        return [
            {"name": n, "lat": geocoder.stations[n][0], "lon": geocoder.stations[n][1]}
            for n in names if n in geocoder.stations
        ]
    return {
        **plan,
        "incident_id": incident_id,
        "incident_lat": doc["lat"],
        "incident_lon": doc["lon"],
        "normal_coords": coords_for(plan.get("normal", [])),
        "diverted_coords": coords_for(plan.get("diverted", [])),
    }


@api.get("/diversions/active")
async def diversions_active():
    """Returns diversion plans for every active incident (used by the map)."""
    docs = await _list_active()
    out = []
    def coords_for(names: List[str]):
        return [
            {"name": n, "lat": geocoder.stations[n][0], "lon": geocoder.stations[n][1]}
            for n in names if n in geocoder.stations
        ]
    for d in docs:
        plan = network.diversion_plan(d["nearest_station"])
        out.append({
            "incident_id": d["id"],
            "short_id": d["id"][:4].upper(),
            "incident_lat": d["lat"],
            "incident_lon": d["lon"],
            "is_compound": d.get("is_compound", False),
            **plan,
            "normal_coords": coords_for(plan.get("normal", [])),
            "diverted_coords": coords_for(plan.get("diverted", [])),
        })
    return out


@api.get("/analytics/summary")
async def analytics_summary():
    """Aggregated history for the analytics tab — resolved trend, cause distribution,
    per-station load + RL bias forecast."""
    # All docs (active + resolved)
    docs = await db.incidents.find({}, {"_id": 0}).to_list(2000)

    # Cause distribution (count + avg duration)
    cause_agg: Dict[str, Dict[str, float]] = {}
    for d in docs:
        c = d.get("event_cause", "others")
        rec = cause_agg.setdefault(c, {"count": 0, "sum_pred": 0.0, "sum_actual": 0.0, "n_resolved": 0})
        rec["count"] += 1
        rec["sum_pred"] += float(d.get("predicted_minutes") or 0)
        if d.get("status") == "resolved" and d.get("actual_minutes") is not None:
            rec["sum_actual"] += float(d["actual_minutes"])
            rec["n_resolved"] += 1
    cause_distribution = [
        {
            "cause": c,
            "count": v["count"],
            "avg_predicted_min": round(v["sum_pred"] / max(1, v["count"]), 1),
            "avg_actual_min": round(v["sum_actual"] / v["n_resolved"], 1) if v["n_resolved"] else None,
        }
        for c, v in sorted(cause_agg.items(), key=lambda kv: -kv[1]["count"])
    ]

    # Resolved trend — bucket by minute since the earliest event in the session
    resolved = [d for d in docs if d.get("status") == "resolved" and d.get("resolved_at")]
    resolved_trend = []
    for d in sorted(resolved, key=lambda x: x.get("resolved_at", "")):
        resolved_trend.append({
            "id_short": d["id"][:4].upper(),
            "cause": d["event_cause"],
            "station": d["nearest_station"],
            "predicted_min": d.get("predicted_minutes"),
            "actual_min": d.get("actual_minutes"),
            "error_min": round(float(d["actual_minutes"]) - float(d["predicted_minutes"]), 1),
            "resolved_at": d["resolved_at"],
        })

    # Per-station load (current active + lifetime resolved) and station RL bias
    stn: Dict[str, Dict[str, float]] = {}
    for d in docs:
        s = d.get("nearest_station", "Unknown")
        rec = stn.setdefault(s, {"active": 0, "resolved": 0, "officers": 0, "compound": 0})
        if d.get("status") == "active":
            rec["active"] += 1
            rec["officers"] += int(d.get("officers", 0))
        else:
            rec["resolved"] += 1
        if d.get("is_compound"):
            rec["compound"] += 1
    # Pull RL biases for each station (max across causes)
    station_bias: Dict[str, float] = {}
    for (s, c), v in rl.bias_cs.items():
        station_bias[s] = max(station_bias.get(s, 1.0), v)
    station_load = [
        {
            "station": s,
            "active": v["active"],
            "resolved": v["resolved"],
            "officers_active": v["officers"],
            "compound_total": v["compound"],
            "rl_risk_bias": round(station_bias.get(s, 1.0), 3),
        }
        for s, v in sorted(stn.items(), key=lambda kv: -(kv[1]["active"] + kv[1]["resolved"] / 4))
    ][:15]

    return {
        "cause_distribution": cause_distribution,
        "resolved_trend": resolved_trend,
        "station_load": station_load,
        "totals": {
            "all_incidents": len(docs),
            "resolved": len(resolved),
            "active": len([d for d in docs if d.get("status") == "active"]),
            "compound": len([d for d in docs if d.get("is_compound")]),
        },
    }


@api.get("/stats")
async def stats():
    active = await db.incidents.count_documents({"status": "active"})
    compound = await db.incidents.count_documents({"status": "active", "is_compound": True})
    resolved = await db.incidents.count_documents({"status": "resolved"})
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": None,
            "avg_pred": {"$avg": "$predicted_minutes"},
            "sum_officers": {"$sum": "$officers"},
            "sum_barricades": {"$sum": "$barricades_meters"},
        }},
    ]
    agg = await db.incidents.aggregate(pipeline).to_list(1)
    a = agg[0] if agg else {}
    return {
        "active": active,
        "compound_alerts": compound,
        "resolved": resolved,
        "avg_predicted_minutes": round(a.get("avg_pred") or 0.0, 1),
        "officers_deployed": int(a.get("sum_officers") or 0),
        "barricades_meters": int(a.get("sum_barricades") or 0),
    }


@api.post("/incidents/clear-all")
async def clear_all():
    await db.incidents.delete_many({})
    network.clear_all_penalties()
    return {"ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
