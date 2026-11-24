"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, MonitorPlay } from "lucide-react";
import { groupMarketplaceCandidatesByCommune, marketplaceCommuneCenter, type MarketplaceZoneCandidate } from "@/lib/marketplace-map-zones";
import "maplibre-gl/dist/maplibre-gl.css";

type MapModule = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;
type MarkerInstance = import("maplibre-gl").Marker;
type PopupInstance = import("maplibre-gl").Popup;

const ABIDJAN_CENTER: [number, number] = [-4.025, 5.35];
const EMPTY_CANDIDATES: MarketplaceZoneCandidate[] = [];
const MAP_STYLE = process.env.NEXT_PUBLIC_MARKETPLACE_MAP_STYLE_URL?.trim()
  || "https://tiles.openfreemap.org/styles/positron";

export function MarketplaceMap({
  format,
  areaLabel,
  commune,
  candidates = EMPTY_CANDIDATES,
  selectedTeacherId,
  onSelectTeacher,
}: {
  format: "HOME" | "ONLINE";
  areaLabel: string;
  commune?: string;
  candidates?: MarketplaceZoneCandidate[];
  selectedTeacherId?: string | null;
  onSelectTeacher?: (teacherId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const zoneMarkersRef = useRef<{ marker: MarkerInstance; element: HTMLButtonElement; teacherIds: string[] }[]>([]);
  const popupRef = useRef<PopupInstance | null>(null);
  const moduleRef = useRef<MapModule | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const { groups, withoutMapPosition } = groupMarketplaceCandidatesByCommune(candidates);

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
        if (!disposed) { setUnavailable(false); setReady(true); }
      });
      loadTimeout = setTimeout(() => { if (!disposed) setUnavailable(true); }, 12_000);
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      markerRef.current?.remove();
      markerRef.current = null;
      zoneMarkersRef.current.forEach(({ marker }) => marker.remove());
      zoneMarkersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      map?.remove();
      mapRef.current = null;
      moduleRef.current = null;
    };
  }, [format]);

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = moduleRef.current;
    if (!ready || !map || !mapLibre || format !== "HOME") return;
    zoneMarkersRef.current.forEach(({ marker }) => marker.remove());
    zoneMarkersRef.current = [];
    popupRef.current?.remove();
    popupRef.current = null;
    const { groups: nextGroups } = groupMarketplaceCandidatesByCommune(candidates);
    for (const group of nextGroups) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "flex min-h-12 min-w-12 flex-col items-center rounded-2xl border-2 border-white bg-[#092A55] px-2 py-1 text-white shadow-[0_6px_20px_rgba(9,42,85,0.3)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D49E35]";
      element.dataset.mapZone = group.commune;
      element.setAttribute("aria-label", `${group.teachers.length} professeur${group.teachers.length > 1 ? "s" : ""} dans la zone de ${group.commune}. ${group.teachers.length > 1 ? "Afficher les profils." : "Sélectionner le profil."}`);
      element.title = `Zone de ${group.commune} · position approximative, non GPS`;
      const count = document.createElement("span");
      count.className = "text-base font-bold leading-5 tabular-nums";
      count.textContent = String(group.teachers.length);
      const label = document.createElement("span");
      label.className = "max-w-24 truncate text-[10px] font-semibold leading-3";
      label.textContent = group.commune;
      element.append(count, label);
      const teacherIds = group.teachers.map((teacher) => teacher.teacherId);
      element.addEventListener("click", () => {
        popupRef.current?.remove();
        if (group.teachers.length === 1) {
          onSelectTeacher?.(teacherIds[0]);
          return;
        }
        const panel = document.createElement("div");
        panel.className = "max-h-48 min-w-40 overflow-y-auto p-1 text-[#12243A]";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", `Professeurs de la zone de ${group.commune}`);
        panel.addEventListener("keydown", (event) => {
          if (event.key === "Escape") popupRef.current?.remove();
        });
        const title = document.createElement("p");
        title.className = "mb-2 pr-5 text-xs font-semibold";
        title.textContent = `${group.commune} · zone approximative`;
        panel.append(title);
        group.teachers.forEach((teacher) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "block min-h-9 w-full rounded-lg px-2 py-1 text-left text-xs font-medium hover:bg-[#EDF3F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#092A55]";
          option.textContent = teacher.name;
          option.addEventListener("click", () => {
            onSelectTeacher?.(teacher.teacherId);
            popupRef.current?.remove();
            popupRef.current = null;
          });
          panel.append(option);
        });
        popupRef.current = new mapLibre.Popup({ closeButton: true, offset: 18, maxWidth: "240px" })
          .setLngLat(group.center).setDOMContent(panel).addTo(map);
        popupRef.current.on("close", () => { if (element.isConnected) element.focus(); });
        panel.querySelector("button")?.focus();
      });
      const marker = new mapLibre.Marker({ element, anchor: "bottom" }).setLngLat(group.center).addTo(map);
      zoneMarkersRef.current.push({ marker, element, teacherIds });
    }
    if (nextGroups.length === 1) {
      map.flyTo({ center: nextGroups[0].center, zoom: 12, essential: true });
    } else if (nextGroups.length > 1) {
      const bounds = new mapLibre.LngLatBounds(nextGroups[0].center, nextGroups[0].center);
      nextGroups.slice(1).forEach((group) => bounds.extend(group.center));
      map.fitBounds(bounds, { padding: 70, maxZoom: 12, duration: 450 });
    } else {
      const center = marketplaceCommuneCenter(commune);
      if (center) map.flyTo({ center, zoom: 12, essential: true });
    }
    return () => {
      zoneMarkersRef.current.forEach(({ marker }) => marker.remove());
      zoneMarkersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, [candidates, commune, format, onSelectTeacher, ready]);

  useEffect(() => {
    zoneMarkersRef.current.forEach(({ element, teacherIds }) => {
      const selected = Boolean(selectedTeacherId && teacherIds.includes(selectedTeacherId));
      element.classList.toggle("bg-[#D49E35]", selected);
      element.classList.toggle("text-[#092A55]", selected);
      element.classList.toggle("bg-[#092A55]", !selected);
      element.classList.toggle("text-white", !selected);
      element.setAttribute("aria-pressed", String(selected));
    });
  }, [selectedTeacherId, candidates]);

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
    <div className="relative h-full min-h-[310px] overflow-hidden bg-[#EAF0EA]" role="region" aria-label="Carte des zones de professeurs à Abidjan">
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
      {ready && !locationMessage && candidates.length > 0 && <p className="absolute bottom-3 left-3 right-3 w-fit max-w-[calc(100%-1.5rem)] rounded-xl bg-white/95 px-3 py-2 text-xs font-medium leading-5 text-[#33485E] shadow-sm" role="status">
        {groups.length ? `${candidates.length - withoutMapPosition} profil${candidates.length - withoutMapPosition > 1 ? "s" : ""} sur la carte · repères de commune approximatifs, pas de position en direct.` : "Ces profils sont disponibles dans la liste; leur commune n’est pas encore repérée sur cette carte."}
        {withoutMapPosition > 0 && groups.length > 0 ? ` ${withoutMapPosition} autre${withoutMapPosition > 1 ? "s" : ""} profil${withoutMapPosition > 1 ? "s" : ""} dans la liste.` : ""}
      </p>}
      {locationMessage && <p className="absolute bottom-3 left-3 right-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[#12243A] shadow-sm" role="status">{locationMessage}</p>}
    </div>
  );
}
