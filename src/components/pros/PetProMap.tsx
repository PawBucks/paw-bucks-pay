import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import type { DirectoryPro } from "@/lib/petPros";
export function PetProMap({ pros, onSelect }: { pros: DirectoryPro[]; onSelect: (pro: DirectoryPro) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const currentPros = useRef(pros); currentPros.current = pros;
  const select = useRef(onSelect); select.current = onSelect;
  useEffect(() => {
    let disposed = false;
    supabase.functions.invoke("pet-pro-map-token").then(({ data, error }) => {
      if (disposed) return;
      if (error || !data?.token || !container.current) { setError("Map unavailable. All listings remain available in the list."); return; }
      const m = new mapboxgl.Map({ container: container.current, accessToken: data.token, style: "mapbox://styles/mapbox/light-v11", center: [-118.45, 34], zoom: 10 });
      map.current = m; m.addControl(new mapboxgl.NavigationControl());
      m.on("load", () => {
        if (disposed) return;
        m.addSource("pros", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 45 });
        const css = getComputedStyle(document.documentElement);
        const color = (name: string) => `hsl(${css.getPropertyValue(name).trim().split(/\s+/).join(",")})`;
        m.addLayer({ id: "clusters", type: "circle", source: "pros", filter: ["has", "point_count"], paint: { "circle-color": color("--primary"), "circle-radius": 20 } });
        m.addLayer({ id: "cluster-count", type: "symbol", source: "pros", filter: ["has", "point_count"], layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 }, paint: { "text-color": color("--primary-foreground") } });
        m.addLayer({ id: "pro-point", type: "circle", source: "pros", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["match", ["get", "network"], "pawbucks", color("--primary"), color("--muted-foreground")], "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": color("--background") } });
        m.on("click", "pro-point", (e) => { const id = e.features?.[0]?.properties?.id; const p = currentPros.current.find((p) => p.id === id); if (p) select.current(p); });
        m.on("click", "clusters", (e) => { const feature = e.features?.[0]; const id = feature?.properties?.cluster_id; const source = m.getSource("pros") as mapboxgl.GeoJSONSource; if (typeof id !== "number" || feature?.geometry.type !== "Point") return; const center = feature.geometry.coordinates as [number, number]; source.getClusterExpansionZoom(id, (err, zoom) => { if (!err && typeof zoom === "number") m.easeTo({ center, zoom }); }); });
        setReady(true);
      });
      m.on("error", (event) => { console.error("Pet Pro map:", event.error?.message); setError("Map unavailable. All listings remain available in the list."); });
    });
    return () => { disposed = true; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const m = map.current; if (!ready || !m) return;
    const points = pros.filter((p) => p.latitude != null && p.longitude != null);
    const source = m.getSource("pros") as mapboxgl.GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features: points.map((p) => ({ type: "Feature", properties: { id: p.id, network: p.network }, geometry: { type: "Point", coordinates: [Number(p.longitude), Number(p.latitude)] } })) });
    if (points.length) { const bounds = new mapboxgl.LngLatBounds(); points.forEach((p) => bounds.extend([Number(p.longitude), Number(p.latitude)])); m.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 }); }
  }, [pros, ready]);
  return <div className="relative h-[480px] lg:h-[640px] w-full border border-border rounded-md overflow-hidden"><div ref={container} className="h-full w-full" />{error && <p role="alert" className="absolute inset-x-4 top-4 bg-card p-3 text-sm border border-border">{error}</p>}{!error && !ready && <p className="absolute inset-x-4 top-4 bg-card p-3 text-sm">Loading map…</p>}</div>;
}
