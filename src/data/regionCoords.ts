// Mirrors backend/regions.ts — kept in sync manually. Covers India's full
// coastline, matching the region selector strings in App.tsx.
export interface RegionCoords {
  lat: number;
  lon: number;
}

export const REGION_COORDS: Record<string, RegionCoords> = {
  'Gujarat Coast': { lat: 21.5, lon: 69.0 },
  'Maharashtra Coast': { lat: 18.5, lon: 72.5 },
  'Goa Coast': { lat: 15.3, lon: 73.3 },
  'Karnataka Coast': { lat: 12.9, lon: 74.5 },
  'Malabar Coast': { lat: 11.3, lon: 75.5 },
  'South Kerala Coast': { lat: 8.5, lon: 76.7 },
  'Vizhinjam Coast': { lat: 8.3, lon: 76.6 },
  'Kochi Offshore': { lat: 9.8, lon: 76.1 },
  'South Tamil Nadu': { lat: 8.3, lon: 78.0 },
  'North Tamil Nadu': { lat: 13.1, lon: 80.5 },
  'South Andhra Pradesh': { lat: 14.0, lon: 80.3 },
  'North Andhra Pradesh': { lat: 17.7, lon: 83.5 },
  'Odisha Coast': { lat: 19.8, lon: 86.2 },
  'West Bengal Coast': { lat: 21.6, lon: 88.2 },
  'Lakshadweep Islands': { lat: 10.5, lon: 72.6 },
  'Andaman & Nicobar Islands': { lat: 11.6, lon: 92.7 },
  'Bay of Bengal': { lat: 15.0, lon: 85.0 },
};

const DEFAULT_COORDS = REGION_COORDS['South Kerala Coast'];

export function resolveRegionCoords(name: string): RegionCoords {
  return REGION_COORDS[name] ?? DEFAULT_COORDS;
}

function haversineKm(a: RegionCoords, b: RegionCoords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function findNearestRegion(point: RegionCoords): { name: string; distanceKm: number } {
  let best = { name: '', distanceKm: Infinity };
  for (const [name, coords] of Object.entries(REGION_COORDS)) {
    const distanceKm = haversineKm(point, coords);
    if (distanceKm < best.distanceKm) best = { name, distanceKm };
  }
  return best;
}
