import React from "react";
import { TCIE } from "@/constants/testIds";
import { Pulse, Warning, Clock, UsersFour } from "@phosphor-icons/react";

function Block({ label, value, sub, color, accent, icon: Icon, testId }) {
  return (
    <div
      data-testid={testId}
      className="gov-card p-3 flex flex-col gap-1 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <Icon size={14} className={accent || color} weight="fill" />
      </div>
      <div className={`font-serif text-[28px] font-bold tracking-tight leading-none ${color}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function KpiStrip({ stats, compoundCount }) {
  const s = stats || {};
  return (
    <section className="grid grid-cols-2 gap-3">
      <Block
        testId={TCIE.kpiActive}
        label="Active Incidents"
        value={s.active ?? 0}
        sub={`${s.resolved ?? 0} resolved · session`}
        color="text-[var(--navy)]"
        accent="text-[var(--navy)]"
        icon={Pulse}
      />
      <Block
        testId={TCIE.kpiCompound}
        label="Compound Alerts"
        value={compoundCount ?? 0}
        sub="0.5 km proximity hits"
        color={compoundCount > 0 ? "text-[var(--sev-critical)]" : "text-[var(--text-primary)]"}
        accent={compoundCount > 0 ? "text-[var(--sev-critical)]" : "text-[var(--text-muted)]"}
        icon={Warning}
      />
      <Block
        testId={TCIE.kpiAvgDuration}
        label="Avg ETA (min)"
        value={s.avg_predicted_minutes ?? 0}
        sub="across active queue"
        color="text-[var(--saffron)]"
        accent="text-[var(--saffron)]"
        icon={Clock}
      />
      <Block
        testId={TCIE.kpiOfficers}
        label="Officers Deployed"
        value={s.officers_deployed ?? 0}
        sub={`${s.barricades_meters ?? 0} m barricades coverage`}
        color="text-[var(--navy)]"
        accent="text-[var(--navy)]"
        icon={UsersFour}
      />
    </section>
  );
}
