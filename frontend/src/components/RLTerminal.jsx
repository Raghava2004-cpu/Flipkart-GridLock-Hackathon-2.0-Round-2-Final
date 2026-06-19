import React, { useEffect, useState } from "react";
import { TCIE } from "@/constants/testIds";
import { TerminalWindow } from "@phosphor-icons/react";

/**
 * Light-mode RL Feedback console.
 * (The Prediction Ensemble breakdown card was removed per user request —
 *  ensemble weights still live in the model API for the Analytics tab.)
 */
export default function RLTerminal({ modelStatus, pulse }) {
  const rl = modelStatus?.rl || {};
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1000), 1200);
    return () => clearInterval(t);
  }, []);

  const lines = (rl.recent_events || []).slice(0, 14);

  return (
    <section
      data-testid={TCIE.modelPanel}
      className="flex-1 flex flex-col overflow-hidden min-h-0"
    >
      <div
        data-testid={TCIE.rlTerminal}
        className={`flex-1 bg-[#0b1f3a] border border-[var(--navy)] rounded-md p-3 overflow-hidden flex flex-col shadow-sm min-h-0 ${
          pulse ? "rl-flash" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffd166] flex items-center gap-1.5">
            <TerminalWindow size={13} weight="fill" /> RL Feedback Loop
          </h3>
          <span className="text-[10px] text-white/60">
            updates {rl.total_updates ?? 0}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2 text-center shrink-0">
          <div className="bg-white/5 border border-white/10 rounded-sm px-2 py-1">
            <div className="text-[9px] uppercase text-white/60 tracking-wider">Preds</div>
            <div className="text-[13px] font-semibold text-[#7ee787] tabular-nums">
              {rl.total_predictions ?? 0}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-sm px-2 py-1">
            <div className="text-[9px] uppercase text-white/60 tracking-wider">Avg |err|</div>
            <div className="text-[13px] font-semibold text-[#ffd166] tabular-nums">
              {rl.avg_abs_error_min ?? 0}m
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-sm px-2 py-1">
            <div className="text-[9px] uppercase text-white/60 tracking-wider">Reward</div>
            <div className={`text-[13px] font-semibold tabular-nums ${rl.last_reward < -20 ? "text-[#ff8e80]" : "text-[#7ee787]"}`}>
              {rl.last_reward ?? 0}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll text-[11px] leading-relaxed text-[#7ee787]/90 min-h-0">
          <div className="text-white/55">
            $ rl-engine --tail · reward = -|Ta − Tp|
            <span className="ml-1 animate-pulse">▌</span>
          </div>
          {lines.length === 0 && (
            <div className="text-white/40 mt-2">
              waiting for first resolution to update Q-table…
            </div>
          )}
          {lines.map((e, i) => (
            <div key={i} className="mt-1.5">
              <span className="text-white/55">
                [{String(rl.total_updates - i).padStart(3, "0")}]
              </span>{" "}
              <span className="text-white">{e.station}</span>{" "}
              <span className="text-white/55">·</span>{" "}
              <span className="text-[#ffd166]">{e.cause}</span>
              <div className="pl-7 text-[#7ee787]/80">
                pred {e.predicted_min}m · actual {e.actual_min}m · Δ {e.error_min}m · R {e.reward}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
