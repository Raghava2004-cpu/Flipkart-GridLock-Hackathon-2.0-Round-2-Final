"""
Resolution Lag Reinforcement Loop.
Maintains a per-(station, cause) bias adjustment + per-cause bias.
Reward = -|t_actual - t_predicted|. If actual >> predicted, bias is increased
so subsequent predictions for that key are inflated; resources scale up too.
"""
from __future__ import annotations
import math
from collections import defaultdict, deque
from typing import Deque, Dict, List, Tuple


class RLFeedback:
    """Lightweight RL-style bias tracker (online Q-update flavour)."""

    def __init__(self, alpha: float = 0.25, clip: float = 1.5):
        self.alpha = alpha
        self.clip = clip  # bias multiplier bounded to [1/clip, clip]
        # bias multipliers for prediction (default = 1.0)
        self.bias_cs: Dict[Tuple[str, str], float] = defaultdict(lambda: 1.0)
        self.bias_c: Dict[str, float] = defaultdict(lambda: 1.0)
        self.events: Deque[Dict] = deque(maxlen=200)
        self.total_updates = 0
        self.total_predictions = 0
        self.sum_abs_error = 0.0
        self.last_reward = 0.0

    def get_bias(self, station: str, cause: str) -> float:
        b_cs = self.bias_cs.get((station, cause), 1.0)
        b_c = self.bias_c.get(cause, 1.0)
        # combine multiplicatively but average to keep tame
        return float(min(self.clip, max(1.0 / self.clip, math.sqrt(b_cs * b_c))))

    def record_prediction(self) -> None:
        self.total_predictions += 1

    def update(self, *, station: str, cause: str, predicted: float,
               actual: float, officers_used: int, barricades_used: int) -> Dict:
        err = actual - predicted
        reward = -abs(err)
        # if actual > predicted -> ratio > 1 -> increase bias; clipped
        ratio = max(0.1, min(5.0, actual / max(1.0, predicted)))
        # exponential moving update toward ratio
        new_cs = (1 - self.alpha) * self.bias_cs.get((station, cause), 1.0) + self.alpha * ratio
        new_c = (1 - self.alpha) * self.bias_c.get(cause, 1.0) + self.alpha * ratio
        # clip
        new_cs = min(self.clip, max(1.0 / self.clip, new_cs))
        new_c = min(self.clip, max(1.0 / self.clip, new_c))
        self.bias_cs[(station, cause)] = new_cs
        self.bias_c[cause] = new_c
        self.total_updates += 1
        self.sum_abs_error += abs(err)
        self.last_reward = reward
        event = {
            "station": station,
            "cause": cause,
            "predicted_min": round(predicted, 1),
            "actual_min": round(actual, 1),
            "error_min": round(err, 1),
            "reward": round(reward, 1),
            "new_bias_station_cause": round(new_cs, 3),
            "new_bias_cause": round(new_c, 3),
        }
        self.events.appendleft(event)
        return event

    def status(self) -> Dict:
        avg_err = (self.sum_abs_error / self.total_updates) if self.total_updates else 0.0
        # Top 5 biased keys
        top = sorted(
            [{"key": f"{k[0]} :: {k[1]}", "bias": round(v, 3)} for k, v in self.bias_cs.items()],
            key=lambda x: -x["bias"],
        )[:5]
        return {
            "total_predictions": self.total_predictions,
            "total_updates": self.total_updates,
            "avg_abs_error_min": round(avg_err, 2),
            "last_reward": round(self.last_reward, 2),
            "top_biases": top,
            "recent_events": list(self.events)[:25],
        }
