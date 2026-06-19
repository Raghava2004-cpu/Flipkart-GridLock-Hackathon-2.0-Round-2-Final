import React from "react";
import { Button } from "@/components/ui/button";
import { ShieldStar, Broadcast, Trash, Pulse, ChartLineUp } from "@phosphor-icons/react";

/**
 * Official Government of Karnataka · Bengaluru Traffic Police header.
 * - Tricolour stripe at top
 * - Emblem (police shield-star) on left with department wordmark
 * - LIVE status, KPI quick-glance, RESET on right
 */
export default function HeaderBar({ stats, compoundCount, onClearAll, tab, onTabChange }) {
  const TabBtn = ({ id, label, Icon }) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => onTabChange(id)}
        data-testid={`tab-${id}`}
        className={`gov-btn h-9 px-4 rounded-md border transition-colors flex items-center gap-2 ${
          active
            ? "bg-[var(--navy)] border-[var(--navy)] text-white shadow-sm"
            : "bg-white border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--navy)] hover:border-[var(--navy)]"
        }`}
      >
        <Icon size={14} weight={active ? "fill" : "regular"} />
        {label}
      </button>
    );
  };

  return (
    <header className="bg-white border-b border-[var(--border)]">
      {/* India tricolour ribbon */}
      <div className="tricolor-bar" />

      {/* Govt strip */}
      <div className="bg-[var(--navy)] text-white text-[11px] px-5 py-1 flex items-center justify-between">
        <span className="font-mono tracking-wider">
          भारत सरकार &nbsp;·&nbsp; ಕರ್ನಾಟಕ ಸರ್ಕಾರ &nbsp;·&nbsp; Government of Karnataka
        </span>
        <span className="hidden md:inline font-mono opacity-80">
          Bengaluru City Police &nbsp;|&nbsp; Traffic Management Centre
        </span>
      </div>

      {/* Main row */}
      <div className="px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Emblem */}
          <div className="w-12 h-12 rounded-md bg-gradient-to-b from-[var(--navy)] to-[var(--navy-2)] flex items-center justify-center shadow-sm shrink-0">
            <ShieldStar size={26} weight="fill" color="#ffd166" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="eyebrow text-[var(--text-muted)]">
              Bengaluru Traffic Police &nbsp;·&nbsp; Command Centre
            </span>
            <span className="font-serif text-[19px] font-semibold text-[var(--text-primary)] tracking-tight truncate">
              Congestion Intelligence Engine
              <span className="ml-2 text-[var(--saffron)] font-mono text-[11px] align-middle tracking-widest">
                TCIE
              </span>
            </span>
          </div>

          {/* Tabs */}
          <div className="ml-4 hidden md:flex items-center gap-2">
            <TabBtn id="live" label="Live Ops" Icon={Pulse} />
            <TabBtn id="analytics" label="Analytics" Icon={ChartLineUp} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* LIVE indicator */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--india-green-50)] border border-[var(--india-green)]/30 rounded-full px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--india-green)] opacity-70 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--india-green)]"></span>
            </span>
            <Broadcast size={12} weight="fill" className="text-[var(--india-green)]" />
            <span className="font-semibold text-[var(--india-green)]">LIVE</span>
            <span>· 5s polling</span>
          </div>

          {/* KPI snapshot */}
          <div className="hidden xl:flex items-center gap-4 font-mono text-[12px] text-[var(--text-secondary)]">
            <span>
              Active <b className="text-[var(--navy)] ml-0.5">{stats?.active ?? 0}</b>
            </span>
            <span className={compoundCount > 0 ? "text-[var(--sev-critical)]" : ""}>
              Alerts <b className="ml-0.5">{compoundCount}</b>
            </span>
            <span>
              Resolved <b className="text-[var(--text-primary)] ml-0.5">{stats?.resolved ?? 0}</b>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="gov-btn h-9 px-3 border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--sev-critical)] hover:border-[var(--sev-critical)]"
            data-testid="clear-all-incidents-btn"
          >
            <Trash size={14} className="mr-1.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex items-center gap-2 px-5 pb-2">
        <TabBtn id="live" label="Live Ops" Icon={Pulse} />
        <TabBtn id="analytics" label="Analytics" Icon={ChartLineUp} />
      </div>
    </header>
  );
}
