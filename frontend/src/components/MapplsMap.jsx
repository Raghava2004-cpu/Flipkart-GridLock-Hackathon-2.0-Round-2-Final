import React, { useEffect, useRef, useState } from "react";
import { loadMappls } from "@/lib/mappls";

// Severity colour map
const sevColor = {
  Low:      "#138808", // India green
  Medium:   "#e08e00",
  High:     "#d35400",
  Critical: "#c0392b",
};

// Compact glyph paths (drawn inside an 18×18 box) per event cause.
// Kept stroke-only / mono-fill so they stay legible at small sizes.
const causeGlyph = {
  vehicle_breakdown:
    "M2 12 L2 9 L4 8 L5 5 L13 5 L14 8 L16 9 L16 12 L14 12 A2 2 0 1 1 10 12 L8 12 A2 2 0 1 1 4 12 Z",
  accident:
    "M9 1 L17 17 L1 17 Z M9 7 L9 12 M9 14 L9 15", // warning triangle + bang
  tree_fall:
    "M9 2 L4 8 L6 8 L2 13 L7 13 L7 17 L11 17 L11 13 L16 13 L12 8 L14 8 Z",
  public_event:
    "M9 4 A2 2 0 1 1 9 8 A2 2 0 1 1 9 4 M5 16 C5 12 13 12 13 16 Z", // person
  water_logging:
    "M9 2 C9 2 3 10 3 13 A6 6 0 0 0 15 13 C15 10 9 2 9 2 Z", // droplet
  pot_holes:
    "M2 13 Q9 6 16 13 M5 13 L13 13", // road bump
  congestion:
    "M2 6 L16 6 M2 10 L16 10 M2 14 L16 14", // three lanes
  construction:
    "M9 2 L15 14 L3 14 Z M7 11 L11 11", // hazard cone
  road_conditions:
    "M5 2 L7 16 M11 2 L13 16 M3 9 L15 9", // road
  vip_movement:
    "M9 2 L11 7 L16 7 L12 11 L14 16 L9 13 L4 16 L6 11 L2 7 L7 7 Z", // star
  procession:
    "M5 2 L5 17 M5 3 L14 3 L11 7 L14 11 L5 11", // flag
  protest:
    "M5 2 L5 17 M5 3 L14 3 L11 7 L14 11 L5 11", // flag (same)
  debris:
    "M3 14 L8 6 L13 14 Z M9 9 L9 12", // triangle
  fog_low_visibility:
    "M3 11 A3 3 0 0 1 6 8 A4 4 0 0 1 14 8 A3 3 0 0 1 14 14 L5 14 A2 2 0 0 1 3 11 Z", // cloud
  political_rally:
    "M3 9 L10 5 L10 14 Z M11 7 L14 7 M11 9 L14 9 M11 11 L14 11", // megaphone
  test_demo:
    "M7 2 L11 2 M9 2 L9 8 L4 15 L14 15 L9 8", // flask
  others:
    "M9 2 A7 7 0 1 1 9 16 A7 7 0 1 1 9 2 M9 6 L9 11 M9 13 L9 14", // info
};

function eventGlyphSvg(cause) {
  return causeGlyph[cause] || causeGlyph.others;
}

/**
 * Clean professional pin (severity-coloured) with an event-cause glyph
 * inside the white head, plus a navy ID-badge label on top.
 * Compound incidents get a red halo ring.
 */
function pinSvg(color, label, compound, cause) {
  const halo = compound
    ? `<circle cx='22' cy='22' r='18' fill='none' stroke='#c0392b' stroke-width='2' opacity='0.85'/>`
    : "";
  const glyph = eventGlyphSvg(cause);
  // Glyph is drawn in a 18x18 box, translated/scaled into the pin head (radius ~6.5 at cx=22 cy=20).
  // Effective area: 14x14 centered at (22,20) → translate(13,11) scale(0.9)
  return `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='54' viewBox='0 0 44 60'>
    <defs>
      <filter id='shd' x='-30%' y='-20%' width='160%' height='150%'>
        <feDropShadow dx='0' dy='2' stdDeviation='1.6' flood-color='#000' flood-opacity='0.35'/>
      </filter>
    </defs>
    ${halo}
    <g filter='url(#shd)'>
      <path d='M22 4
               C13 4 6 11 6 20
               C6 32 22 54 22 54
               C22 54 38 32 38 20
               C38 11 31 4 22 4 Z'
            fill='${color}' stroke='#ffffff' stroke-width='2'/>
      <circle cx='22' cy='20' r='8.5' fill='#ffffff'/>
      <g transform='translate(13,11) scale(0.95)'>
        <path d='${glyph}' fill='none' stroke='${color}' stroke-width='1.8'
              stroke-linecap='round' stroke-linejoin='round'/>
      </g>
    </g>
    <g>
      <rect x='2' y='-2' rx='3' ry='3' width='40' height='12' fill='#0b3d91' stroke='#ffffff' stroke-width='1'/>
      <text x='22' y='7' text-anchor='middle' font-family='Inter, sans-serif'
            font-size='9' font-weight='700' fill='#ffffff' letter-spacing='1'>#${label}</text>
    </g>
  </svg>`;
}

function stationSvg() {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'>
    <circle cx='7' cy='7' r='5' fill='#0b3d91' stroke='white' stroke-width='1.5'/>
    <circle cx='7' cy='7' r='1.5' fill='white'/>
  </svg>`;
}

export default function MapplsMap({ incidents = [], stations = [] }) {
  const containerId = "tcie-mappls-container";
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const stationMarkersRef = useRef([]);
  const ringsRef = useRef([]);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMappls()
      .then((mappls) => {
        if (cancelled) return;
        try {
          mapRef.current = new mappls.Map(containerId, {
            center: [12.9716, 77.5946],
            zoom: 11,
            zoomControl: true,
            location: false,
            search: false,
          });
          mapRef.current.on && mapRef.current.on("load", () => setReady(true));
          setTimeout(() => {
            setReady(true);
            try { window.dispatchEvent(new Event("resize")); } catch {}
            try { mapRef.current.resize && mapRef.current.resize(); } catch {}
          }, 1200);
          let kicks = 0;
          const iv = setInterval(() => {
            try { window.dispatchEvent(new Event("resize")); } catch {}
            try { mapRef.current && mapRef.current.resize && mapRef.current.resize(); } catch {}
            kicks++;
            if (kicks > 6) clearInterval(iv);
          }, 800);
        } catch (e) {
          setError(e.message);
        }
      })
      .catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.mappls) return;
    stationMarkersRef.current.forEach((m) => m.remove && m.remove());
    stationMarkersRef.current = [];
    stations.forEach((s) => {
      try {
        const mk = new window.mappls.Marker({
          map: mapRef.current,
          position: { lat: s.lat, lng: s.lon },
          icon_url: "data:image/svg+xml;utf8," + encodeURIComponent(stationSvg()),
          popupHtml: `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:#0b1f3a"><b>${s.name}</b><br/><span style="color:#6b7589">Police Station · Anchor Node</span></div>`,
          fitbounds: false,
        });
        stationMarkersRef.current.push(mk);
      } catch {}
    });
  }, [ready, stations]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.mappls) return;
    markersRef.current.forEach((m) => m.remove && m.remove());
    markersRef.current = [];
    ringsRef.current.forEach((c) => c.remove && c.remove());
    ringsRef.current = [];

    incidents.forEach((inc) => {
      try {
        const color = sevColor[inc.severity] || "#c0392b";
        const short = inc.id.slice(0, 4).toUpperCase();
        const svg = pinSvg(color, short, inc.is_compound, inc.event_cause);
        const mk = new window.mappls.Marker({
          map: mapRef.current,
          position: { lat: inc.lat, lng: inc.lon },
          icon_url: "data:image/svg+xml;utf8," + encodeURIComponent(svg),
          popupHtml: `
            <div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;min-width:240px;color:#0b1f3a">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-family:'IBM Plex Mono',monospace;font-weight:700;background:${color};color:#fff;padding:2px 6px;border-radius:3px;letter-spacing:1px;font-size:10px">#${short}</span>
                <span style="text-transform:uppercase;font-size:10px;color:${color};letter-spacing:.15em;font-weight:600">${inc.severity} · ${inc.event_cause.replace(/_/g," ")}</span>
              </div>
              <div style="font-weight:600">${inc.address_text}</div>
              <div style="color:#6b7589;margin-top:3px">Nearest PS: <b style="color:#0b3d91">${inc.nearest_station}</b> · ${inc.nearest_station_distance_km} km</div>
              <div style="margin-top:7px;display:grid;grid-template-columns:1fr 1fr;gap:5px;font-family:'IBM Plex Mono',monospace;font-size:11px">
                <div>ETA: <b>${inc.predicted_minutes}m</b></div>
                <div>Officers: <b>${inc.officers}</b></div>
                <div>Barricades: <b>${inc.barricades_count ?? 0}</b></div>
                <div>RL bias: <b>${inc.rl_bias}×</b></div>
              </div>
              ${inc.is_compound ? `<div style="color:#c0392b;margin-top:6px;font-weight:600">⚠ Compound · 1.35× multiplier</div>` : ""}
            </div>
          `,
        });
        markersRef.current.push(mk);
        if (window.mappls.Circle) {
          const circle = new window.mappls.Circle({
            map: mapRef.current,
            center: { lat: inc.lat, lng: inc.lon },
            radius: 500,
            fillColor: inc.is_compound ? "rgba(192,57,43,0.10)" : "rgba(11,61,145,0.06)",
            fillOpacity: 1,
            strokeColor: inc.is_compound ? "#c0392b" : "#0b3d91",
            strokeWeight: inc.is_compound ? 2 : 1,
            strokeOpacity: 0.55,
          });
          ringsRef.current.push(circle);
        }
      } catch {}
    });
  }, [ready, incidents]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div
        id={containerId}
        style={{ width: "100%", height: "100%", background: "#eef1f5" }}
        data-testid="mappls-map"
      />

      <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
        <div className="bg-white/95 backdrop-blur border border-[var(--border)] rounded-md px-3 py-1.5 text-[11px] font-semibold text-[var(--navy)] shadow-sm">
          <span className="eyebrow text-[var(--text-muted)] mr-2">Mappls</span>
          Bengaluru · Tactical View
          <span className="ml-3 text-[var(--text-muted)] font-normal">
            incidents <b className="text-[var(--text-primary)]">{incidents.length}</b> · stations <b className="text-[var(--text-primary)]">{stations.length}</b>
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-10 bg-white/96 backdrop-blur border border-[var(--border)] rounded-md p-2.5 flex flex-col gap-1 text-[11px] shadow-md">
        <span className="eyebrow mb-1">Legend</span>
        {[
          ["Low", "#138808"],
          ["Medium", "#e08e00"],
          ["High", "#d35400"],
          ["Critical", "#c0392b"],
        ].map(([k, c]) => (
          <div key={k} className="flex items-center gap-2 text-[var(--text-secondary)]">
            <svg width="11" height="14" viewBox="0 0 44 60">
              <path d="M22 4 C13 4 6 11 6 20 C6 32 22 54 22 54 C22 54 38 32 38 20 C38 11 31 4 22 4 Z"
                    fill={c} stroke="#fff" strokeWidth="2" />
              <circle cx="22" cy="20" r="6" fill="#fff" />
            </svg>
            {k} incident
          </div>
        ))}
        <div className="flex items-center gap-2 text-[var(--text-secondary)] mt-1">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--navy)] border border-white shadow" /> Police Station
        </div>
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-[var(--sev-critical)]" /> 0.5 km radius
        </div>
      </div>

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90">
          <div className="gov-card border-[var(--sev-critical)]/50 p-4 max-w-md text-center">
            <div className="eyebrow text-[var(--sev-critical)] mb-2">Map error</div>
            <div className="text-sm text-[var(--text-primary)]">{error}</div>
          </div>
        </div>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white">
          <div className="eyebrow text-[var(--navy)] animate-pulse">
            Loading tactical view…
          </div>
        </div>
      )}
    </div>
  );
}
