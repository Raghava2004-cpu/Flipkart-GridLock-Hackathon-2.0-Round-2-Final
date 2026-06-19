import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { TCIE } from "@/constants/testIds";
import { CloudRain, MapPinLine, WarningOctagon, PaperPlaneTilt } from "@phosphor-icons/react";

const labelCls = "eyebrow";
const inputCls =
  "bg-white border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] h-10 rounded-md focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]";

const CAUSE_LABELS = {
  vehicle_breakdown: "Vehicle Breakdown",
  tree_fall: "Tree Fall",
  accident: "Accident",
  public_event: "Public Event",
  water_logging: "Water Logging",
  pot_holes: "Pot Holes",
  congestion: "Congestion",
  construction: "Construction",
  road_conditions: "Road Conditions",
  vip_movement: "VIP Movement",
  procession: "Procession",
  protest: "Protest",
  debris: "Debris",
  fog_low_visibility: "Fog / Low Visibility",
  political_rally: "Political Rally",
  test_demo: "Test / Demo",
  others: "Others",
};

const TOD_LABELS = {
  morning_peak: "Morning Peak (07-10)",
  midday_offpeak: "Midday Off-peak",
  evening_peak: "Evening Peak (17-21)",
  night: "Night (21-06)",
};

const WEATHER_LABELS = {
  clear: "Clear",
  rain: "Light Rain",
  heavy_rain: "Heavy Rain",
  fog: "Fog / Mist",
};

export default function IncidentForm({ meta, onSubmit, loading }) {
  const [address, setAddress] = useState("");
  const [cause, setCause] = useState("vehicle_breakdown");
  const [priority, setPriority] = useState("High");
  const [weather, setWeather] = useState("clear");
  const [tod, setTod] = useState("midday_offpeak");
  const [closure, setClosure] = useState(false);
  const [weekend, setWeekend] = useState(false);

  const causes = meta?.event_causes ?? Object.keys(CAUSE_LABELS);
  const weathers = meta?.weather_options ?? Object.keys(WEATHER_LABELS);
  const tods = meta?.time_of_day ?? Object.keys(TOD_LABELS);

  const submit = (e) => {
    e.preventDefault();
    if (!address.trim()) return;
    onSubmit({
      address_text: address.trim(),
      event_cause: cause,
      priority,
      weather,
      time_of_day: tod,
      requires_road_closure: closure,
      is_weekend: weekend ? 1 : 0,
    });
  };

  return (
    <section className="gov-card overflow-hidden">
      {/* Header band */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--navy-50)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WarningOctagon size={16} weight="fill" className="text-[var(--saffron)]" />
          <h2 className="font-serif text-[15px] font-semibold text-[var(--navy)] tracking-tight">
            New Incident · Dispatch
          </h2>
        </div>
        <span className="eyebrow text-[var(--navy)]/70">Form · TCIE-01</span>
      </div>

      <form onSubmit={submit} data-testid={TCIE.form} className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <Label className={labelCls}>Location / Address</Label>
          <div className="relative">
            <MapPinLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              data-testid={TCIE.addressInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Jalahalli Cross Junction, Peenya"
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Event Cause</Label>
            <Select value={cause} onValueChange={setCause}>
              <SelectTrigger data-testid={TCIE.causeDropdown} className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-[var(--border)] text-[var(--text-primary)]">
                {causes.map((c) => (
                  <SelectItem key={c} value={c} className="text-sm">
                    {CAUSE_LABELS[c] || c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Priority</Label>
            <div
              data-testid={TCIE.priorityToggle}
              className="flex bg-[var(--surface-2)] border border-[var(--border)] rounded-md overflow-hidden h-10"
            >
              {["High", "Low"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 text-[12px] font-semibold tracking-wide transition-colors ${
                    priority === p
                      ? p === "High"
                        ? "bg-[var(--sev-critical)] text-white"
                        : "bg-[var(--navy)] text-white"
                      : "text-[var(--text-secondary)] hover:bg-white"
                  }`}
                  data-testid={`priority-${p.toLowerCase()}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>
              <CloudRain size={12} className="inline mr-1" /> Weather
            </Label>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger data-testid={TCIE.weatherDropdown} className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-[var(--border)] text-[var(--text-primary)]">
                {weathers.map((w) => (
                  <SelectItem key={w} value={w} className="text-sm">
                    {WEATHER_LABELS[w] || w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Time of Day</Label>
            <Select value={tod} onValueChange={setTod}>
              <SelectTrigger data-testid={TCIE.todDropdown} className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-[var(--border)] text-[var(--text-primary)]">
                {tods.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm">
                    {TOD_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <label className="flex items-center justify-between bg-white border border-[var(--border)] rounded-md px-3 py-2.5 cursor-pointer hover:border-[var(--navy)] transition-colors">
            <span className={labelCls}>Road Closure</span>
            <Switch
              data-testid={TCIE.closureSwitch}
              checked={closure}
              onCheckedChange={setClosure}
            />
          </label>
          <label className="flex items-center justify-between bg-white border border-[var(--border)] rounded-md px-3 py-2.5 cursor-pointer hover:border-[var(--navy)] transition-colors">
            <span className={labelCls}>Weekend</span>
            <Switch
              data-testid={TCIE.weekendSwitch}
              checked={weekend}
              onCheckedChange={setWeekend}
            />
          </label>
        </div>

        <Button
          type="submit"
          disabled={loading || !address.trim()}
          data-testid={TCIE.submitBtn}
          className="w-full h-11 mt-1 bg-[var(--navy)] hover:bg-[var(--navy-2)] text-white gov-btn rounded-md disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
        >
          <PaperPlaneTilt size={16} weight="fill" />
          {loading ? "Dispatching…" : "Predict & Dispatch"}
        </Button>
      </form>
    </section>
  );
}
