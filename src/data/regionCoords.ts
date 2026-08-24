// Mirrors backend/regions.ts — kept in sync manually since it's just 5 static
// offshore points matching the region selector strings in App.tsx.
export interface RegionCoords {
  lat: number;
  lon: number;
}

export const REGION_COORDS: Record<string, RegionCoords> = {
  'South Kerala Coast': { lat: 8.5, lon: 76.7 },
  'Vizhinjam Coast': { lat: 8.3, lon: 76.6 },
  'Kochi Offshore': { lat: 9.8, lon: 76.1 },
  'Malabar Coast': { lat: 11.3, lon: 75.5 },
  'Bay of Bengal': { lat: 15.0, lon: 85.0 },
};

const DEFAULT_COORDS = REGION_COORDS['South Kerala Coast'];

export function resolveRegionCoords(name: string): RegionCoords {
  return REGION_COORDS[name] ?? DEFAULT_COORDS;
}
