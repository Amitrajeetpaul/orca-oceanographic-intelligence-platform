export interface RegionCoords {
  lat: number;
  lon: number;
}

// Offshore points (avoid coastal/land pixels in the satellite grid), all
// verified against the live INCOIS WMS grid. Keys match the region selector
// strings exactly (App.tsx's REGIONS array) — covers India's full coastline.
const REGIONS: Record<string, RegionCoords> = {
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

const DEFAULT_REGION = REGIONS['South Kerala Coast'];

export function resolveRegion(name: string): RegionCoords {
  return REGIONS[name] ?? DEFAULT_REGION;
}

export function getAllRegions(): { name: string; coords: RegionCoords }[] {
  return Object.entries(REGIONS).map(([name, coords]) => ({ name, coords }));
}

// A bare state name ("Tamil Nadu", "Kerala") geocodes via Nominatim to that
// state's administrative centroid — usually an INLAND point with no real
// SST/chlorophyll data (land pixel). Matching it to one of our own
// pre-verified offshore points instead gives a real, usable coastal
// location for that state rather than nonsense land coordinates. Order
// matters — checked longest/most-specific name first so "Andhra Pradesh"
// doesn't accidentally match a substring of something else first.
const STATE_TO_REGION: [string, string][] = [
  ['andaman', 'Andaman & Nicobar Islands'],
  ['nicobar', 'Andaman & Nicobar Islands'],
  ['lakshadweep', 'Lakshadweep Islands'],
  ['andhra pradesh', 'South Andhra Pradesh'],
  ['tamil nadu', 'South Tamil Nadu'],
  ['west bengal', 'West Bengal Coast'],
  ['odisha', 'Odisha Coast'],
  ['orissa', 'Odisha Coast'],
  ['karnataka', 'Karnataka Coast'],
  ['maharashtra', 'Maharashtra Coast'],
  ['gujarat', 'Gujarat Coast'],
  ['goa', 'Goa Coast'],
  ['kerala', 'South Kerala Coast'],
];

export function matchStateToRegion(placeName: string): { name: string; coords: RegionCoords } | null {
  const normalized = placeName.trim().toLowerCase();
  for (const [stateFragment, regionName] of STATE_TO_REGION) {
    if (normalized === stateFragment || normalized.includes(stateFragment)) {
      return { name: regionName, coords: REGIONS[regionName] };
    }
  }
  return null;
}