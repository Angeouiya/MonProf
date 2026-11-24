import { normalizeLocationName } from "@/lib/ivory-coast-locations";

// Repères de commune, PAS positions GPS de professeurs. Coordonnées de lieux
// publics mises en cache depuis OpenStreetMap/Nominatim (2026-11-04).
// Ne pas les utiliser pour estimer un trajet, une distance ou un temps d'arrivée.
const COMMUNE_CENTERS: Record<string, readonly [number, number]> = {
  abobo: [-4.0202247, 5.4263155],
  adjame: [-4.0222008, 5.3531211],
  attecoube: [-4.034076, 5.3481717],
  cocody: [-3.994934, 5.357367],
  koumassi: [-3.9585801, 5.2927045],
  marcory: [-3.985395, 5.303612],
  plateau: [-4.0243927, 5.3279819],
  "le plateau": [-4.0243927, 5.3279819],
  "port-bouet": [-3.958626, 5.256881],
  treichville: [-4.0081051, 5.306008],
  yopougon: [-4.075756, 5.335194],
  bingerville: [-3.8885591, 5.3577727],
  anyama: [-4.0512414, 5.4960537],
  songon: [-4.20612, 5.3349397],
  angre: [-3.9888107, 5.4040496],
  riviera: [-3.955456, 5.3390178],
  "deux plateaux": [-3.991954, 5.3696652],
};

export function marketplaceCommuneCenter(commune: string | null | undefined): [number, number] | null {
  const key = normalizeLocationName(commune);
  const center = COMMUNE_CENTERS[key];
  return center ? [center[0], center[1]] : null;
}

export type MarketplaceZoneCandidate = {
  teacherId: string;
  name: string;
  commune: string | null;
};

export function groupMarketplaceCandidatesByCommune<T extends MarketplaceZoneCandidate>(candidates: T[]) {
  const groups = new Map<string, { commune: string; center: [number, number]; teachers: T[] }>();
  let withoutMapPosition = 0;
  for (const teacher of candidates) {
    const center = marketplaceCommuneCenter(teacher.commune);
    if (!center) {
      withoutMapPosition += 1;
      continue;
    }
    const key = normalizeLocationName(teacher.commune);
    const group = groups.get(key);
    if (group) group.teachers.push(teacher);
    else groups.set(key, { commune: teacher.commune!.trim(), center, teachers: [teacher] });
  }
  return { groups: Array.from(groups.values()), withoutMapPosition };
}
