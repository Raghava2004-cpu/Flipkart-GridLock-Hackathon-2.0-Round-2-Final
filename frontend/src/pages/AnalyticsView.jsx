import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAnalytics } from "@/lib/api";
import { ChartBar, ChartLineUp, Buildings, Warning } from "@phosphor-icons/react";

// Cause colours — picked from the light Karnataka palette.
const CAUSE_COLOR = {
  political_rally: "#c0392b", protest: "#c0392b", procession: "#d35400",
  vip_movement: "#e08e00", public_event: "#e08e00", construction: "#e08e00",
  accident: "#d35400", tree_fall: "#e08e00", debris: "#e08e00",
  water_logging: "#0b3d91", fog_low_visibility: "#5b2a8c",
  vehicle_breakdown: "#138808", pot_holes: "#138808", road_conditions: "#138808",
  congestion: "#e08e00", others: "#6b7589", test_demo: "#a7adb8",
};

const Section = ({ title, icon: Icon, color, children, right }) => (
  <section className="gov-card p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-serif text-[15px] font-semibold text-[var(--navy)] tracking-tight flex items-center gap-2">
        <Icon size={15} weight="fill" className={color} /> {title}
      </h3>
      {right}
    </div>
    {children}
  </section>
);

function CauseBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length)
    return <div className="text-[var(--text-muted)] text-sm">No data yet — dispatch incidents to build distribution.</div>;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.cause} className="flex items-center gap-3">
          <div className="w-40 text-[12px] text-[var(--text-secondary)] truncate capitalize">
            {d.cause.replace(/_/g, " ")}
          </div>
          <div className="flex-1 h-6 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm overflow-hidden relative">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${(d.count / max) * 100}%`, background: CAUSE_COLOR[d.cause] || "#0b3d91" }}
            />
            <span className="absolute left-2 top-0 bottom-0 flex items-center font-mono text-[11px] text-white drop-shadow font-semibold">
              {d.count} · {d.avg_predicted_min}m avg
              {d.avg_actual_min != null && (
                <span className="text-[#7ee787] ml-2">→ actual {d.avg_actual_min}m</span>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResolvedTimeline({ data }) {
  if (!data.length)
    return <div className="text-[var(--text-muted)] text-sm">Resolve an incident to see the prediction-vs-actual delta trend.</div>;
  const maxAbs = Math.max(10, ...data.map((d) => Math.abs(d.error_min || 0)));
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-end gap-1.5 h-32 px-1 border-b border-[var(--border)] bg-[var(--surface-2)] rounded-sm p-2">
        {data.map((d) => {
          const pos = d.error_min >= 0;
          const h = Math.min(100, (Math.abs(d.error_min) / maxAbs) * 100);
          return (
            <div key={d.id_short} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className={`w-full rounded-t-sm ${pos ? "bg-[var(--sev-critical)]" : "bg-[var(--india-green)]"} transition-all`}
                style={{ height: `${h}%`, minHeight: 4 }}
                title={`${d.cause} @ ${d.station} · Δ ${d.error_min}m`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[var(--sev-critical)] inline-block rounded-sm" /> under-estimated (actual {`>`} pred)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[var(--india-green)] inline-block rounded-sm" /> accurate / over-estimated</span>
      </div>
      <div className="max-h-44 overflow-y-auto thin-scroll mt-1 border border-[var(--border)] rounded-sm">
        <table className="w-full font-mono text-[11px]">
          <thead className="text-[var(--text-muted)] uppercase tracking-[0.16em] bg-[var(--surface-2)]">
            <tr>
              <th className="text-left py-1.5 px-2">id</th>
              <th className="text-left px-2">cause</th>
              <th className="text-left px-2">station</th>
              <th className="text-right px-2">pred</th>
              <th className="text-right px-2">actual</th>
              <th className="text-right px-2">Δ</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            {data.slice().reverse().map((d) => (
              <tr key={d.id_short} className="border-t border-[var(--border)]">
                <td className="text-[var(--navy)] font-semibold py-1 px-2">#{d.id_short}</td>
                <td className="capitalize px-2">{d.cause.replace(/_/g, " ")}</td>
                <td className="text-[var(--text-secondary)] px-2">{d.station}</td>
                <td className="text-right px-2">{d.predicted_min}m</td>
                <td className="text-right px-2">{d.actual_min}m</td>
                <td className={`text-right px-2 font-semibold ${d.error_min >= 0 ? "text-[var(--sev-critical)]" : "text-[var(--india-green)]"}`}>
                  {d.error_min > 0 ? "+" : ""}{d.error_min}m
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StationForecast({ data }) {
  if (!data.length)
    return <div className="text-[var(--text-muted)] text-sm">RL bias per police-station populates as incidents resolve.</div>;
  const maxLoad = Math.max(1, ...data.map((d) => d.active + d.resolved));
  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto thin-scroll pr-1">
      {data.map((s) => {
        const w = ((s.active + s.resolved) / maxLoad) * 100;
        const biasPct = Math.min(100, Math.max(0, (s.rl_risk_bias - 0.6) / 0.9 * 100));
        return (
          <div key={s.station} className="grid grid-cols-12 items-center gap-2 text-[11px] font-mono">
            <div className="col-span-3 text-[var(--text-secondary)] truncate">{s.station}</div>
            <div className="col-span-5 h-5 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm overflow-hidden relative">
              <div className="absolute left-0 top-0 h-full bg-[var(--navy)]/70" style={{ width: `${w}%` }} />
              <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white font-semibold">
                {s.active} active · {s.resolved} resolved
              </span>
            </div>
            <div className="col-span-2 text-[10px] text-[var(--text-muted)]">{s.officers_active} off · {s.compound_total} cmp</div>
            <div className="col-span-2 h-5 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm overflow-hidden relative">
              <div
                className="h-full"
                style={{
                  width: `${biasPct}%`,
                  background:
                    s.rl_risk_bias > 1.1 ? "#c0392b" :
                    s.rl_risk_bias < 0.9 ? "#138808" : "#e08e00",
                }}
              />
              <span className="absolute inset-0 flex items-center justify-end px-2 text-[10px] text-white font-semibold">
                {s.rl_risk_bias}×
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] mt-2">
        load → navy · rl risk bias → red high, green low (predictive forecast)
      </div>
    </div>
  );
}

export default function AnalyticsView() {
  const { data } = useQuery({
    queryKey: ["analytics"], queryFn: fetchAnalytics, refetchInterval: 5000,
  });
  const totals = data?.totals || {};

  const Kpi = ({ label, value, color, sub }) => (
    <div className="gov-card p-4">
      <div className="eyebrow">{label}</div>
      <div className={`font-serif text-[32px] font-bold tracking-tight leading-none mt-1 ${color || "text-[var(--text-primary)]"}`}>
        {value ?? 0}
      </div>
      {sub && <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="flex-1 p-4 overflow-y-auto thin-scroll" data-testid="analytics-view">
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Kpi label="Lifetime Incidents" value={totals.all_incidents} color="text-[var(--navy)]" />
        <Kpi label="Resolved" value={totals.resolved} color="text-[var(--india-green)]" sub="RL fed" />
        <Kpi label="Active Now" value={totals.active} color="text-[var(--saffron)]" />
        <Kpi label="Compound Episodes" value={totals.compound} color="text-[var(--sev-critical)]" sub="0.5 km proximity" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Section title="Cause Distribution" icon={ChartBar} color="text-[var(--saffron)]">
          <CauseBars data={data?.cause_distribution || []} />
        </Section>
        <Section title="Resolved · Prediction Error Trend" icon={ChartLineUp} color="text-[var(--india-green)]">
          <ResolvedTimeline data={data?.resolved_trend || []} />
        </Section>
      </div>

      <Section
        title="Per-Station Load & RL Risk Forecast"
        icon={Buildings}
        color="text-[var(--navy)]"
        right={
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Warning size={12} className="text-[var(--sev-critical)]" /> bias {`>`} 1.0 = under-estimated history
          </div>
        }
      >
        <StationForecast data={data?.station_load || []} />
      </Section>
    </div>
  );
}
