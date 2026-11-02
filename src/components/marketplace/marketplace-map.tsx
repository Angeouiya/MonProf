"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, MonitorPlay } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

type MapModule = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;
type MarkerInstance = import("maplibre-gl").Marker;

const ABIDJAN_CENTER: [number, number] = [-4.025, 5.35];
const MAP_STYLE = process.env.NEXT_PUBLIC_MARKETPLACE_MAP_STYLE_URL?.trim()
  || "https://tiles.openfreemap.org/styles/positron";

export function MarketplaceMap({
  format,
  areaLabel,
}: {
  format: "HOME" | "ONLINE";
  areaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const moduleRef = useRef<MapModule | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    if (format !== "HOME" || !containerRef.current) return;
    let disposed = false;
    let map: MapInstance | null = null;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    void import("maplibre-gl").then((mapLibre) => {
      if (disposed || !containerRef.current) return;
      moduleRef.current = mapLibre;
      mapLibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      if (!window.WebGLRenderingContext) {
        setUnavailable(true);
        return;
      }
      map = new mapLibre.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: ABIDJAN_CENTER,
        zoom: 11,
        pitch: 0,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapLibre.AttributionControl({ compact: true }), "top-left");
      map.once("load", () => {
        if (loadTimeout) clearTimeout(loadTimeout);
        if (!disposed) setReady(true);
      });
      loadTimeout = setTimeout(() => { if (!disposed) setUnavailable(true); }, 12_000);
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
      moduleRef.current = null;
    };
  }, [format]);

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("La localisation n’est pas disponible sur cet appareil. Choisissez votre commune et votre quartier.");
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const coordinates: [number, number] = [position.coords.longitude, position.coords.latitude];
        const map = mapRef.current;
        const mapLibre = moduleRef.current;
        if (!map || !mapLibre) return;
        markerRef.current?.remove();
        markerRef.current = new mapLibre.Marker({ color: "#092A55" })
          .setLngLat(coordinates)
          .addTo(map);
        map.flyTo({ center: coordinates, zoom: 14, essential: true });
        setLocationMessage("Votre position est visible uniquement sur cet écran. Indiquez aussi le quartier du cours.");
      },
      () => {
        setLocating(false);
        setLocationMessage("Position non autorisée ou indisponible. Vous pouvez saisir le lieu du cours manuellement.");
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );
  }

  if (format === "ONLINE") {
    return (
      <div className="relative flex h-full min-h-[310px] items-center justify-center overflow-hidden bg-[#EAF0F4] px-6 text-center text-[#092A55]">
        <div aria-hidden="true" className="absolute -left-20 top-10 h-64 w-64 rounded-full border-[40px] border-white/60" />
        <div aria-hidden="true" className="absolute -right-12 bottom-0 h-64 w-64 rounded-full border-[40px] border-white/60" />
        <div className="relative max-w-sm">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm"><MonitorPlay className="h-8 w-8" /></span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">Le cours vient à vous</h2>
          <p className="mt-2 text-sm leading-6 text-[#526174]">En ligne, aucun déplacement. Choisissez votre besoin et un professeur disponible à l’heure souhaitée.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[310px] overflow-hidden bg-[#EAF0EA]" aria-label="Carte interactive du secteur d’Abidjan">
      <div className="absolute inset-0"><div ref={containerRef} className="h-full w-full [&_.maplibregl-ctrl-top-left]:!top-14 [&_.maplibregl-ctrl-attrib]:!bg-white/95 [&_.maplibregl-ctrl-attrib]:!text-[11px]" /></div>
      {!ready && !unavailable && <div className="absolute inset-0 flex items-center justify-center bg-[#EAF0EA] text-sm text-[#526174]">Chargement de la carte…</div>}
      {unavailable && <div className="absolute inset-0 flex items-center justify-center bg-[#EAF0EA] px-8 text-center text-sm leading-6 text-[#526174]">Carte indisponible. Vous pouvez rechercher un professeur avec la commune et le quartier.</div>}
      <div className="absolute left-4 top-4 right-4 flex items-start justify-between gap-3 sm:left-6 sm:right-6">
        <div className="inline-flex max-w-[70%] items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#12243A] shadow-[0_8px_24px_rgba(9,42,85,0.12)]">
          <MapPin className="h-4 w-4 shrink-0 text-[#092A55]" /><span className="truncate">{areaLabel}</span>
        </div>
        <button type="button" onClick={locate} disabled={locating || unavailable || !ready} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-[#092A55] shadow-[0_8px_24px_rgba(9,42,85,0.12)] disabled:opacity-60" aria-label="Afficher ma position sur la carte">
          <LocateFixed className="h-4 w-4" />{locating ? "Localisation…" : "Ma position"}
        </button>
      </div>
      {locationMessage && <p className="absolute bottom-3 left-3 right-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[#12243A] shadow-sm" role="status">{locationMessage}</p>}
    </div>
  );
}
