import React, { useEffect, useRef, useState } from "react";
import { loadMappls } from "@/lib/mappls";

// Severity colour map
const sevColor = {
  Low:      "#138808", // India green
  Medium:   "#e08e00",
  High:     "#d35400",
  Critical: "#c0392b",
};

/**
 * Event-cause glyphs. Each is a self-contained SVG fragment drawn inside an 18×18
 * viewBox using `currentColor`-style fills/strokes that we substitute with the
 * severity colour at render time. Designed to be unmistakable at 24px.
 */
const causeGlyph = {
  // Wrench (vehicle breakdown)
  vehicle_breakdown: `
    <path d='M11.5 2.5 a3.5 3.5 0 0 0-3 5.3 L2.5 13.8 l1.7 1.7 L10 9.7 a3.5 3.5 0 0 0 5-4.2 l-2 2 l-1.5-1.5 l2-2 a3.5 3.5 0 0 0-2-1.5 Z' fill='COLOR'/>`,
  // Warning triangle with bang (accident)
  accident: `
    <path d='M9 1.5 L16.8 16 L1.2 16 Z' fill='COLOR'/>
    <rect x='8.2' y='6' width='1.6' height='5.4' fill='white'/>
    <rect x='8.2' y='12.6' width='1.6' height='1.6' fill='white'/>`,
  // Tree
  tree_fall: `
    <path d='M9 1.5 L4 7 L6 7 L3 11.5 L7 11.5 L7 13 L11 13 L11 11.5 L15 11.5 L12 7 L14 7 Z' fill='COLOR'/>
    <rect x='8' y='13' width='2' height='4' fill='COLOR'/>`,
  // Person (public event)
  public_event: `
    <circle cx='9' cy='5' r='2.4' fill='COLOR'/>
    <path d='M3.5 16 C3.5 11.5 14.5 11.5 14.5 16 Z' fill='COLOR'/>`,
  // Droplet (water logging)
  water_logging: `
    <path d='M9 1.5 C9 1.5 3 9.5 3 13 a6 6 0 0 0 12 0 C15 9.5 9 1.5 9 1.5 Z' fill='COLOR'/>`,
  // Road bump (pot holes)
  pot_holes: `
    <path d='M1.5 14 Q9 4 16.5 14 Z' fill='COLOR'/>
    <circle cx='6.5' cy='10' r='1' fill='white'/>
    <circle cx='11.5' cy='10' r='1' fill='white'/>`,
  // 3 stacked traffic lanes (congestion)
  congestion: `
    <rect x='2' y='4' width='14' height='2.4' rx='1' fill='COLOR'/>
    <rect x='2' y='7.8' width='14' height='2.4' rx='1' fill='COLOR'/>
    <rect x='2' y='11.6' width='14' height='2.4' rx='1' fill='COLOR'/>`,
  // Hazard cone (construction)
  construction: `
    <path d='M9 1.5 L14.5 15 L3.5 15 Z' fill='COLOR'/>
    <rect x='4.4' y='10.5' width='9.2' height='1.4' fill='white'/>
    <rect x='5.6' y='6.8' width='6.8' height='1.4' fill='white'/>`,
  // Road slab
  road_conditions: `
    <path d='M3 2 L15 2 L13 16 L5 16 Z' fill='COLOR'/>
    <rect x='8.4' y='3.5' width='1.2' height='3' fill='white'/>
    <rect x='8.4' y='8' width='1.2' height='3' fill='white'/>
    <rect x='8.4' y='12.5' width='1.2' height='3' fill='white'/>`,
  // Star (VIP)
  vip_movement: `
    <path d='M9 1.5 L11.3 6.7 L17 7.3 L12.7 11.1 L14 16.5 L9 13.6 L4 16.5 L5.3 11.1 L1 7.3 L6.7 6.7 Z' fill='COLOR'/>`,
  // Flag (procession)
  procession: `
    <rect x='3.6' y='1.5' width='1.6' height='15' fill='COLOR'/>
    <path d='M5.2 2 L15 2 L12 6 L15 10 L5.2 10 Z' fill='COLOR'/>`,
  // Fist / raised flag (protest)
  protest: `
    <rect x='3.6' y='1.5' width='1.6' height='15' fill='COLOR'/>
    <path d='M5.2 2 L15 2 L12 6 L15 10 L5.2 10 Z' fill='COLOR'/>
    <circle cx='10' cy='13.5' r='1.4' fill='COLOR'/>`,
  // Debris (triangle + chunks)
  debris: `
    <path d='M2 15 L7 6 L12 15 Z' fill='COLOR'/>
    <rect x='12' y='11' width='4' height='4' fill='COLOR'/>`,
  // Cloud (fog)
  fog_low_visibility: `
    <path d='M3 11.5 a3 3 0 0 1 3-3 a4 4 0 0 1 7.5 0 a2.8 2.8 0 0 1 1 5.4 H4 a2 2 0 0 1-1-2.4 Z' fill='COLOR'/>
    <rect x='3' y='14.6' width='12' height='1.2' fill='COLOR'/>`,
  // Megaphone (rally)
  political_rally: `
    <path d='M2 7 L10 4 L10 14 L2 11 Z' fill='COLOR'/>
    <rect x='10.5' y='7.5' width='3' height='3' fill='COLOR'/>
    <path d='M14 5 L16 4 M14 9 L16 9 M14 13 L16 14' stroke='COLOR' stroke-width='1.6' stroke-linecap='round'/>`,
  // Flask (test/demo)
  test_demo: `
    <rect x='6.5' y='1.5' width='5' height='1.4' fill='COLOR'/>
    <path d='M7 2.9 L7 7.5 L3.5 15 L14.5 15 L11 7.5 L11 2.9 Z' fill='COLOR'/>
    <circle cx='8' cy='12' r='0.8' fill='white'/>
    <circle cx='10.5' cy='13' r='0.6' fill='white'/>`,
  // Info circle (others)
  others: `
    <circle cx='9' cy='9' r='7.4' fill='COLOR'/>
    <rect x='8.2' y='7' width='1.6' height='6' fill='white'/>
    <rect x='8.2' y='4.5' width='1.6' height='1.6' fill='white'/>`,
};

function eventGlyphSvg(cause, color) {
  const raw = causeGlyph[cause] || causeGlyph.others;
  return raw.replaceAll("COLOR", color);
}

/**
 * Severity-coloured teardrop pin with a large white head containing the
 * event-cause glyph in the severity colour. Compound incidents get a red halo.
 * Pin size: 54×72 so the glyph is unmistakable at default Mappls zoom levels.
 */
function pinSvg(color, label, compound, cause) {
  const halo = compound
    ? `<circle cx='27' cy='26' r='22' fill='none' stroke='#c0392b' stroke-width='2.5' opacity='0.85'/>`
    : "";
  const glyph = eventGlyphSvg(cause, color);
  // Pin head circle is centred at (27, 24) with radius 12. Glyph viewBox 18x18 is
  // scaled to ~22px and translated so its centre aligns to (27, 24).
  return `<svg xmlns='http://www.w3.org/2000/svg' width='54' height='72' viewBox='0 0 54 72'>
    <defs>
      <filter id='shd' x='-30%' y='-20%' width='160%' height='150%'>
        <feDropShadow dx='0' dy='2' stdDeviation='1.8' flood-color='#000' flood-opacity='0.38'/>
      </filter>
    </defs>
    ${halo}
    <g filter='url(#shd)'>
      <path d='M27 4
               C16 4 8 12 8 23
               C8 38 27 66 27 66
               C27 66 46 38 46 23
               C46 12 38 4 27 4 Z'
            fill='${color}' stroke='#ffffff' stroke-width='2.4'/>
      <circle cx='27' cy='24' r='12' fill='#ffffff'/>
      <g transform='translate(15,12) scale(1.33)'>${glyph}</g>
    </g>
    <g>
      <rect x='5' y='-2' rx='3' ry='3' width='44' height='12' fill='#0b3d91' stroke='#ffffff' stroke-width='1'/>
      <text x='27' y='7' text-anchor='middle' font-family='Inter, sans-serif'
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
