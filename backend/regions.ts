export interface RegionCoords {
  lat: number;
  lon: number;
}

// Offshore points (avoid coastal/land pixels in the satellite grid). Keys
// match the region selector strings exactly (App.tsx's REGIONS array).
const REGIONS: Record<string, RegionCoords> = {
  'South Kerala Coast': { lat: 8.5, lon: 76.7 },
  'Vizhinjam Coast': { lat: 8.3, lon: 76.6 },
  'Kochi Offshore': { lat: 9.8, lon: 76.1 },
  'Malabar Coast': { lat: 11.3, lon: 75.5 },
  'Bay of Bengal': { lat: 15.0, lon: 85.0 },
};

const DEFAULT_REGION = REGIONS['South Kerala Coast'];

export function resolveRegion(name: string): RegionCoords {
  return REGIONS[name] ?? DEFAULT_REGION;
}

export function getAllRegions(): { name: string; coords: RegionCoords }[] {
  return Object.entries(REGIONS).map(([name, coords]) => ({ name, coords }));
}