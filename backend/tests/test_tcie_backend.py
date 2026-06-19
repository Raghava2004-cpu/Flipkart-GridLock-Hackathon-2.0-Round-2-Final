"""TCIE Backend tests - meta, stations, model, incidents, compound, RL, stats, diversion."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://incident-flow-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module", autouse=True)
def _ready():
    # Wait for backend startup training to finish
    for _ in range(30):
        try:
            r = requests.get(f"{API}/model-status", timeout=10)
            if r.status_code == 200 and r.json().get("n_train", 0) > 0:
                break
        except Exception:
            pass
        time.sleep(2)
    # Clear DB
    requests.post(f"{API}/incidents/clear-all", timeout=15)
    yield
    requests.post(f"{API}/incidents/clear-all", timeout=15)


# ---------- META ----------
class TestMeta:
    def test_meta_options(self):
        r = requests.get(f"{API}/meta", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["event_causes"]) == 17, f"expected 17 causes, got {len(d['event_causes'])}"
        assert len(d["weather_options"]) == 4
        assert len(d["time_of_day"]) == 4
        assert d["proximity_km"] == 0.5
        assert d["compound_multiplier"] == 1.35

    def test_police_stations(self):
        r = requests.get(f"{API}/police-stations", timeout=15)
        assert r.status_code == 200
        stations = r.json()
        assert len(stations) == 54, f"expected 54, got {len(stations)}"
        for s in stations[:5]:
            assert "name" in s and "lat" in s and "lon" in s
            assert 12.7 < s["lat"] < 13.3, f"lat out of Bangalore: {s}"
            assert 77.3 < s["lon"] < 77.9, f"lon out of Bangalore: {s}"

    def test_model_status(self):
        r = requests.get(f"{API}/model-status", timeout=15)
        assert r.status_code == 200
        d = r.json()
        w = d["ensemble_weights"]
        total = w["random_forest"] + w["gradient_boost"] + w["ridge"]
        assert 0.95 < total < 1.05, f"weights sum {total}"
        assert d["holdout_mae_minutes"] > 0
        assert d["holdout_r2"] > 0
        assert "rl" in d


# ---------- INCIDENT CREATION + COMPOUND ----------
class TestIncidents:
    first_id = None
    second_id = None

    def test_clear_first(self):
        r = requests.post(f"{API}/incidents/clear-all", timeout=15)
        assert r.status_code == 200

    def test_create_first_incident(self):
        body = {
            "address_text": "Jalahalli Cross",
            "event_cause": "political_rally",
            "priority": "High",
            "weather": "heavy_rain",
            "time_of_day": "evening_peak",
            "requires_road_closure": True,
            "is_weekend": 0,
        }
        r = requests.post(f"{API}/incidents", json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["predicted_minutes"] > 0
        assert d["officers"] >= 8, f"officers={d['officers']}"
        assert d["barricades_meters"] >= 100, f"barricades={d['barricades_meters']}"
        assert d["nearest_station"] and isinstance(d["nearest_station"], str)
        assert d["is_compound"] is False
        TestIncidents.first_id = d["id"]

    def test_create_second_incident_compound(self):
        body = {
            "address_text": "Jalahalli",
            "event_cause": "tree_fall",
            "priority": "High",
            "weather": "heavy_rain",
            "time_of_day": "evening_peak",
            "requires_road_closure": False,
            "is_weekend": 0,
        }
        r = requests.post(f"{API}/incidents", json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_compound"] is True, "Second incident should be compound"
        assert TestIncidents.first_id in d["compound_with"]
        assert d["severity"] in ("High", "Critical")
        TestIncidents.second_id = d["id"]

    def test_first_incident_now_compound(self):
        r = requests.get(f"{API}/incidents/active", timeout=15)
        assert r.status_code == 200
        active = r.json()
        first = next((i for i in active if i["id"] == TestIncidents.first_id), None)
        assert first is not None
        assert first["is_compound"] is True

    def test_stats(self):
        r = requests.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["active"] >= 2
        assert d["compound_alerts"] >= 2
        assert d["officers_deployed"] > 0

    def test_diversion(self):
        r = requests.get(f"{API}/incidents/{TestIncidents.first_id}/diversion", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "normal" in d and "diverted" in d
        assert isinstance(d.get("normal_coords"), list)
        assert isinstance(d.get("diverted_coords"), list)


# ---------- RL FEEDBACK ----------
class TestRL:
    def test_resolve_and_rl_update(self):
        # find an active incident
        r = requests.get(f"{API}/incidents/active", timeout=15)
        assert r.status_code == 200
        active = r.json()
        assert len(active) >= 1
        target = active[0]
        predicted = target["predicted_minutes"]
        station = target["nearest_station"]
        cause = target["event_cause"]

        # resolve with actual_minutes=240
        r = requests.post(
            f"{API}/incidents/{target['id']}/resolve",
            json={"actual_minutes": 240},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "resolved"
        expected_reward = -abs(240 - predicted)
        assert abs(d["rl_reward"] - expected_reward) < 0.5, f"reward={d['rl_reward']} expected~{expected_reward}"

        # model-status should show updates >=1
        ms = requests.get(f"{API}/model-status", timeout=15).json()
        assert ms["rl"]["total_updates"] >= 1
        # bias for (station, cause)
        biases = ms["rl"].get("biases", {}) or ms["rl"].get("entries", {}) or {}
        # try common key shapes
        found_bias = None
        for k, v in biases.items():
            if station in k and cause in k:
                found_bias = v if isinstance(v, (int, float)) else (v.get("bias") if isinstance(v, dict) else None)
                break
        # Since actual(240) > predicted, bias should be > 1.0
        if found_bias is not None:
            assert found_bias > 1.0, f"bias for ({station},{cause}) should be >1.0, got {found_bias}"


# ---------- CLEAR ALL ----------
class TestClear:
    def test_clear_all_wipes(self):
        # create one incident first
        requests.post(f"{API}/incidents", json={
            "address_text": "MG Road",
            "event_cause": "accident",
            "priority": "High",
        }, timeout=30)
        r = requests.post(f"{API}/incidents/clear-all", timeout=15)
        assert r.status_code == 200
        stats = requests.get(f"{API}/stats", timeout=15).json()
        assert stats["active"] == 0
