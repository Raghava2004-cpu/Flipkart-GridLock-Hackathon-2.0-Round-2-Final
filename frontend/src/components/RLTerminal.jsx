import React, { useEffect, useState } from "react";
import { TCIE } from "@/constants/testIds";
import { Brain, TerminalWindow, ChartLineUp } from "@phosphor-icons/react";

const k = (label, value) => ({ label, value });

/**
 * Light-mode "Ensemble + RL Feedback" panel.
 * Keeps the terminal feedback list but on a navy card so it stays legible
 * and feels like a govt diagnostic console rather than a hacker terminal.
 */
export default function RLTerminal({ modelStatus, pulse }) {
  const rl = modelStatus?.rl || {};
  const w = modelStatus?.ensemble_weights || {};
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1000), 1200);
    return () => clearInterval(t);
  }, []);

  const lines = (rl.recent_events || []).slice(0, 14);

  return (
    <section
      data-testid={TCIE.modelPanel}
      className="flex-1 flex flex-col gap-3 overflow-hidden"
    >
      {/* Ensemble status */}
      <div className="gov-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif text-[14px] font-semibold text-[var(--navy)] tracking-tight flex items-center gap-1.5">
            <Brain size={15} weight="fill" className="text-[var(--navy)]" />
            Prediction Ensemble · GBM + RF + Ridge
          </h3>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            n={modelStatus?.n_train ?? 0}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[
            k("RF", `${(w.random_forest * 100 || 0).toFixed(0)}%`),
            k("GBM", `${(w.gradient_boost * 100 || 0).toFixed(0)}%`),
            k("Ridge", `${(w.ridge * 100 || 0).toFixed(0)}%`),
          ].map((x) => (
            <div key={x.label} className="gov-card-inset px-2 py-1.5">
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {x.label}
              </div>
              <div className="font-mono text-[14px] font-semibold text-[var(--navy)]">{x.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="gov-card-inset px-2 py-1.5">
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Holdout MAE
            </div>
            <div className="font-mono text-[14px] font-semibold text-[var(--saffron)]">
              {modelStatus?.holdout_mae_minutes ?? "—"} min
            </div>
          </div>
          <div className="gov-card-inset px-2 py-1.5">
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)]">
              R² Score
            </div>
            <div className="font-mono text-[14px] font-semibold text-[var(--india-green)]">
              {modelStatus?.holdout_r2 ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* RL diagnostic console — navy card, legible mono */}
      <div
        data-testid={TCIE.rlTerminal}
        className={`flex-1 bg-[#0b1f3a] border border-[var(--navy)] rounded-md p-3 overflow-hidden flex flex-col shadow-sm ${
          pulse ? "rl-flash" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#ffd166] flex items-center gap-1.5">
            <TerminalWindow size={13} weight="fill" /> RL Feedback Loop
          </h3>
          <span className="font-mono text-[10px] text-white/60">
            updates={rl.total_updates ?? 0}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
          <div className="bg-white/5 border border-white/10 rounded-sm px-2 py-1.5">
            <div className="text-[9px] font-mono uppercase text-white/60">Preds</div>
            <div className="font-mono text-[14px] font-semibold text-[#7ee787]">
              {rl.total_predictions ?? 0}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-sm px-2 py-1.5">
            <div className="text-[9px] font-mono uppercase text-white/60">Avg |err|</div>
            <div className="font-mono text-[14px] font-semibold text-[#ffd166]">
              {rl.avg_abs_error_min ?? 0}m
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-sm px-2 py-1.5">
            <div className="text-[9px] font-mono uppercase text-white/60">Reward</div>
            <div className={`font-mono text-[14px] font-semibold ${rl.last_reward < -20 ? "text-[#ff8e80]" : "text-[#7ee787]"}`}>
              {rl.last_reward ?? 0}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll font-mono text-[11px] leading-relaxed text-[#7ee787]/90">
          <div className="text-white/55">
            $ rl-engine --tail --reward=-|Ta-Tp| · alpha=0.25 · clip=1.5
            <span className="ml-1 animate-pulse">▌</span>
          </div>
          {lines.length === 0 && (
            <div className="text-white/40 mt-2">
              # waiting for first resolution to update Q-table…
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
                pred={e.predicted_min}m · actual={e.actual_min}m · Δ={e.error_min}m · R={e.reward}
              </div>
              <div className="pl-7 text-[#8ab4ff]/85">
                → bias[{e.station[0]}·{e.cause.slice(0, 4)}]={e.new_bias_station_cause}
              </div>
            </div>
          ))}
        </div>

        {rl.top_biases && rl.top_biases.length > 0 && false && (
          <div className="border-t border-white/10 mt-2 pt-2">
            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-white/55 mb-1">
              <ChartLineUp size={10} /> top learned biases
            </div>
            {rl.top_biases.slice(0, 3).map((b, i) => (
              <div key={i} className="font-mono text-[10px] text-[#7ee787]/85 truncate">
                · {b.key} → <span className="text-white">{b.bias}×</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
