import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TCIE } from "@/constants/testIds";
import {
  MapPin, User, Clock, Warning, Crane, FirstAid,
  CheckCircle, ListBullets, ShieldCheck, Path, Buildings,
} from "@phosphor-icons/react";

// Light-mode severity chips
const sevClass = {
  Low:      "bg-[var(--india-green-50)] text-[var(--india-green)] border-[var(--india-green)]/40",
  Medium:   "bg-[#fff4e0] text-[#a36100] border-[#e08e00]/40",
  High:     "bg-[#fde6dc] text-[#a3431b] border-[#d35400]/45",
  Critical: "bg-[#fae0dc] text-[#8e2a1d] border-[var(--sev-critical)]/55",
};

function Row({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[var(--text-muted)] flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </span>
      <span className={`font-semibold ${color || "text-[var(--text-primary)]"}`}>{value}</span>
    </div>
  );
}

function IncidentCard({ inc, onResolve, resolving }) {
  const [confirm, setConfirm] = useState(false);
  const isCompound = inc.is_compound;
  const shortId = inc.id.slice(0, 4).toUpperCase();
  const diversion = (inc.diversion_path || []).filter((s, i, arr) => arr.indexOf(s) === i);
  const diversionText = diversion.length >= 2 ? diversion.join("  →  ") : null;

  return (
    <div
      data-testid={TCIE.queueCard(inc.id)}
      className={`bg-white border border-[var(--border)] rounded-md p-3 border-l-[3px] shadow-sm hover:shadow-md transition-shadow ${
        isCompound ? "border-l-[var(--sev-critical)] alert-pulse" : "border-l-[var(--navy)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              data-testid={`incident-id-${inc.id}`}
              className={`font-mono text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm border ${
                isCompound
                  ? "bg-[var(--sev-critical)]/10 text-[var(--sev-critical)] border-[var(--sev-critical)]/40"
                  : "bg-[var(--navy-50)] text-[var(--navy)] border-[var(--navy)]/30"
              }`}
            >
              #{shortId}
            </span>
            <div className="eyebrow truncate">
              {inc.event_cause.replace(/_/g, " ")}
            </div>
          </div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] truncate" title={inc.address_text}>
            {inc.address_text}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            <MapPin size={11} className="inline mr-1" />
            {inc.matched_location}
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] tracking-widest rounded-sm border shrink-0 px-2 py-0.5 font-semibold ${sevClass[inc.severity] || ""}`}
        >
          {(inc.severity || "").toUpperCase()}
        </Badge>
      </div>

      {/* Nearest police station — prominent row */}
      <div className="bg-[var(--navy-50)] border border-[var(--navy)]/20 rounded-md px-3 py-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 eyebrow text-[var(--navy)]">
          <Buildings size={12} weight="fill" /> Nearest Police Station
        </div>
        <div className="text-[13px] text-[var(--text-primary)] font-semibold truncate ml-2">
          {inc.nearest_station}
          <span className="text-[var(--text-muted)] font-normal ml-1.5">· {inc.nearest_station_distance_km} km</span>
        </div>
      </div>

      {isCompound && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--sev-critical)]">
          <Warning size={12} weight="fill" /> 0.5km compound · 1.35× multiplier
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-[var(--border)]/70 mt-1">
        <Row icon={Clock} label="ETA" value={`${inc.predicted_minutes}m`} />
        <Row icon={User} label="Officers" value={inc.officers} />
        <Row
          icon={ShieldCheck}
          label="Barricades"
          value={inc.barricades_count ?? 0}
        />
        <Row icon={Crane} label="Cranes" value={inc.cranes} />
        <Row icon={FirstAid} label="Ambulance" value={inc.ambulances} />
        <Row icon={Warning} label="RL Bias" value={`${inc.rl_bias}×`} color="text-[var(--saffron)]" />
      </div>

      {/* Diversion plan */}
      {diversionText && (
        <div className="mt-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md p-2.5">
          <div className="flex items-center gap-1.5 eyebrow text-[var(--saffron)] mb-1">
            <Path size={12} weight="fill" /> Recommended Diversion
          </div>
          <div className="font-mono text-[11px] text-[var(--text-primary)] leading-snug break-words">
            {diversionText}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-[10px] font-mono text-[var(--text-muted)]">
        <div className="bg-[var(--surface-2)] border border-[var(--border)]/60 px-2 py-1 rounded-sm">
          weather · <span className="text-[var(--text-primary)] font-semibold">{inc.weather}</span>
        </div>
        <div className="bg-[var(--surface-2)] border border-[var(--border)]/60 px-2 py-1 rounded-sm">
          tod · <span className="text-[var(--text-primary)] font-semibold">{inc.time_of_day.replace("_", " ")}</span>
        </div>
        <div className="bg-[var(--surface-2)] border border-[var(--border)]/60 px-2 py-1 rounded-sm">
          priority · <span className="text-[var(--text-primary)] font-semibold">{inc.priority}</span>
        </div>
        <div className="bg-[var(--surface-2)] border border-[var(--border)]/60 px-2 py-1 rounded-sm">
          closure · <span className="text-[var(--text-primary)] font-semibold">{inc.requires_road_closure ? "Yes" : "No"}</span>
        </div>
      </div>

      <div className="mt-3">
        {!confirm ? (
          <Button
            data-testid={TCIE.markResolvedBtn(inc.id)}
            onClick={() => setConfirm(true)}
            variant="outline"
            className="w-full h-8 gov-btn border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--navy-50)] hover:text-[var(--navy)] hover:border-[var(--navy)]"
          >
            <CheckCircle size={13} className="mr-1.5" /> Mark Resolved · Feed RL
          </Button>
        ) : (
          <div className="flex gap-1.5">
            <Button
              onClick={() => setConfirm(false)}
              variant="outline"
              className="flex-1 h-8 gov-btn border-[var(--border)] bg-white text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              disabled={resolving}
              onClick={() => onResolve(inc.id)}
              className="flex-1 h-8 gov-btn bg-[var(--india-green)] hover:bg-[#0e6e07] text-white"
            >
              {resolving ? "Sending…" : "Confirm"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IncidentQueue({ incidents, onResolve, resolving }) {
  return (
    <section className="h-full gov-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <h2 className="font-serif text-[15px] font-semibold text-[var(--navy)] tracking-tight flex items-center gap-2">
          <ListBullets size={14} weight="bold" /> Active Incident Queue
        </h2>
        <span className="text-[11px] font-mono text-[var(--text-muted)]">{incidents.length} live</span>
      </div>
      <div
        data-testid="incident-queue"
        className="flex-1 overflow-y-auto thin-scroll grid grid-cols-1 lg:grid-cols-2 gap-2.5 content-start p-3"
      >
        {incidents.length === 0 ? (
          <div className="lg:col-span-2 text-[12px] text-[var(--text-muted)] uppercase tracking-[0.2em] text-center py-10 border border-dashed border-[var(--border)] rounded-md bg-[var(--surface-2)]/50">
            no active incidents
          </div>
        ) : (
          incidents.map((i) => (
            <IncidentCard key={i.id} inc={i} onResolve={onResolve} resolving={resolving} />
          ))
        )}
      </div>
    </section>
  );
}
