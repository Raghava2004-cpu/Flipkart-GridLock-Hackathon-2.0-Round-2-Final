"""
Network Penalty Matrix Engine — builds a graph over the 54 police stations
and computes diversion routes via Dijkstra. Edge weights are inflated when
incidents are active (10x penalty).
"""
from __future__ import annotations
from typing import Dict, List, Tuple

import networkx as nx

from .geocode import haversine_km


class CityNetwork:
    def __init__(self):
        self.G: nx.Graph = nx.Graph()
        self.station_coords: Dict[str, Tuple[float, float]] = {}
        # Maps (u,v) -> penalty multiplier (>=1.0)
        self.penalties: Dict[Tuple[str, str], float] = {}

    def fit(self, station_coords: Dict[str, Tuple[float, float]]) -> None:
        self.station_coords = dict(station_coords)
        names = list(self.station_coords.keys())
        # Build k-nearest neighbour graph (k=4) so the network is sparse
        # but connected — each station to its 4 closest peers
        K = 4
        edges = []
        for u in names:
            ulat, ulon = self.station_coords[u]
            dists = []
            for v in names:
                if v == u:
                    continue
                vlat, vlon = self.station_coords[v]
                dists.append((haversine_km(ulat, ulon, vlat, vlon), v))
            dists.sort()
            for d, v in dists[:K]:
                edges.append((u, v, d))
        self.G.clear()
        for u, v, w in edges:
            if self.G.has_edge(u, v):
                # Keep min weight if duplicate
                if w < self.G[u][v]["base"]:
                    self.G[u][v]["base"] = w
                continue
            self.G.add_edge(u, v, base=w)
        # Ensure connectivity by linking components
        comps = list(nx.connected_components(self.G))
        while len(comps) > 1:
            a = next(iter(comps[0]))
            b = next(iter(comps[1]))
            alat, alon = self.station_coords[a]
            blat, blon = self.station_coords[b]
            self.G.add_edge(a, b, base=haversine_km(alat, alon, blat, blon))
            comps = list(nx.connected_components(self.G))

    def set_penalty(self, u: str, v: str, multiplier: float) -> None:
        key = tuple(sorted((u, v)))
        self.penalties[key] = max(self.penalties.get(key, 1.0), multiplier)

    def clear_penalty(self, u: str, v: str) -> None:
        key = tuple(sorted((u, v)))
        self.penalties.pop(key, None)

    def clear_all_penalties(self) -> None:
        self.penalties.clear()

    def _weight(self, u: str, v: str, data: dict) -> float:
        key = tuple(sorted((u, v)))
        return data.get("base", 1.0) * self.penalties.get(key, 1.0)

    def shortest_path(self, src: str, dst: str) -> Tuple[List[str], float]:
        if src not in self.G or dst not in self.G:
            return [], 0.0
        try:
            path = nx.dijkstra_path(self.G, src, dst, weight=self._weight)
            cost = nx.dijkstra_path_length(self.G, src, dst, weight=self._weight)
            return path, float(cost)
        except nx.NetworkXNoPath:
            return [], 0.0

    def diversion_plan(self, blocked_station: str, src: str | None = None,
                       dst: str | None = None) -> Dict:
        """
        Penalize all edges adjacent to blocked_station by 10x and recompute
        a 'normal' vs 'diverted' route for visualization.
        """
        # Choose src/dst as two nearest neighbours of the blocked station if not given
        if blocked_station not in self.G:
            return {"normal": [], "diverted": [], "blocked": blocked_station}
        neighbours = list(self.G.neighbors(blocked_station))
        if not neighbours:
            return {"normal": [], "diverted": [], "blocked": blocked_station}
        src = src or neighbours[0]
        dst = dst or (neighbours[1] if len(neighbours) > 1 else neighbours[0])

        # Normal path (no penalty)
        saved = dict(self.penalties)
        self.penalties.clear()
        normal, normal_cost = self.shortest_path(src, dst)
        # Apply 10x penalty to all edges touching the blocked station
        for n in self.G.neighbors(blocked_station):
            self.set_penalty(blocked_station, n, 10.0)
        diverted, diverted_cost = self.shortest_path(src, dst)
        # Restore previous global penalty map
        self.penalties = saved
        return {
            "blocked": blocked_station,
            "src": src,
            "dst": dst,
            "normal": normal,
            "normal_cost_km": round(normal_cost, 2),
            "diverted": diverted,
            "diverted_cost_km": round(diverted_cost, 2),
        }
