import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchMeta, fetchActive, fetchStats, fetchModelStatus, fetchStations,
  createIncident, resolveIncident, clearAll,
} from "@/lib/api";
import IncidentForm from "@/components/IncidentForm";
import IncidentQueue from "@/components/IncidentQueue";
import KpiStrip from "@/components/KpiStrip";
import MapplsMap from "@/components/MapplsMap";
import HeaderBar from "@/components/HeaderBar";
import AnalyticsView from "@/pages/AnalyticsView";

const REFRESH_MS = 5000;

export default function CommandCenter() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("live");

  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: fetchMeta });
  const { data: stations = [] } = useQuery({ queryKey: ["stations"], queryFn: fetchStations });
  const { data: active = [] } = useQuery({
    queryKey: ["active"], queryFn: fetchActive, refetchInterval: REFRESH_MS,
  });
  const { data: stats } = useQuery({
    queryKey: ["stats"], queryFn: fetchStats, refetchInterval: REFRESH_MS,
  });
  // Model status is still fetched (Analytics tab uses it) but no longer rendered here.
  useQuery({ queryKey: ["model"], queryFn: fetchModelStatus, refetchInterval: REFRESH_MS });

  const createMut = useMutation({
    mutationFn: createIncident,
    onSuccess: (d) => {
      qc.setQueryData(["active"], (prev = []) => {
        const filtered = prev.filter((p) => p.id !== d.id);
        const next = filtered.map((p) =>
          d.compound_with?.includes(p.id) ? { ...p, is_compound: true } : p,
        );
        return [d, ...next];
      });
      qc.invalidateQueries({ queryKey: ["active"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["model"] });
      if (d.is_compound) {
        toast.error(`Compound alert · ${d.matched_location}`, {
          description: `0.5 km proximity hit — 1.35× multiplier applied. Officers escalated to ${d.officers}.`,
        });
      } else {
        toast.success(`Incident dispatched · ${d.nearest_station}`, {
          description: `ETA ${d.predicted_minutes} min · ${d.officers} officers · ${d.barricades_count} barricades`,
        });
      }
    },
    onError: (e) => toast.error("Dispatch failed", { description: e?.message || "Unknown error" }),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, actual }) => resolveIncident(id, actual),
    onSuccess: (d) => {
      qc.setQueryData(["active"], (prev = []) => prev.filter((p) => p.id !== d.id));
      qc.invalidateQueries({ queryKey: ["active"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["model"] });
      toast.success("Incident resolved · RL feedback ingested", {
        description: `Predicted ${d.predicted_minutes}m → actual ${d.actual_minutes}m  (reward ${d.rl_reward})`,
      });
    },
  });

  const clearMut = useMutation({
    mutationFn: clearAll,
    onSuccess: () => {
      qc.invalidateQueries();
      toast.message("All incidents cleared");
    },
  });

  const compoundCount = useMemo(
    () => active.filter((i) => i.is_compound).length,
    [active],
  );

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-[var(--bg)]">
      <HeaderBar
        stats={stats}
        compoundCount={compoundCount}
        onClearAll={() => clearMut.mutate()}
        tab={tab}
        onTabChange={setTab}
      />
      {tab === "live" ? (
        <div
          className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0"
          style={{ gridTemplateRows: "minmax(0, 1.55fr) minmax(0, 1fr)" }}
        >
          {/* TOP-LEFT — Map (now taller, ~60% of viewport) */}
          <main className="col-span-8 row-span-1 relative rounded-md overflow-hidden gov-card min-h-0">
            <MapplsMap incidents={active} stations={stations} />
          </main>

          {/* TOP-RIGHT — Incident form (auto-fills the taller row → Predict button very prominent) */}
          <aside className="col-span-4 row-span-1 min-h-0">
            <IncidentForm
              meta={meta}
              onSubmit={(payload) => createMut.mutate(payload)}
              loading={createMut.isPending}
            />
          </aside>

          {/* BOTTOM-LEFT — Active Queue */}
          <section className="col-span-8 row-span-1 overflow-hidden min-h-0">
            <IncidentQueue
              incidents={active}
              onResolve={(id, actual) => resolveMut.mutate({ id, actual })}
              resolving={resolveMut.isPending}
            />
          </section>

          {/* BOTTOM-RIGHT — KPIs only (RL feedback loop removed per request) */}
          <aside className="col-span-4 row-span-1 min-h-0">
            <KpiStrip stats={stats} compoundCount={compoundCount} />
          </aside>
        </div>
      ) : (
        <AnalyticsView />
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-white px-5 py-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>
          © {new Date().getFullYear()} Bengaluru City Police · Traffic Management Centre &nbsp;|&nbsp;
          Government of Karnataka
        </span>
        <span className="font-mono">
          TCIE v2.0 · powered by Mappls · ensemble ML + RL
        </span>
      </footer>
    </div>
  );
}
