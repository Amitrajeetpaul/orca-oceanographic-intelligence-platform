// GDACS (Global Disaster Alert and Coordination System) — run by the EU
// Joint Research Centre with UN OCHA, sourced from NOAA/JTWC tropical
// cyclone tracking. Free, keyless, and internationally recognized (used
// by humanitarian orgs worldwide) — the real cyclone-tracking source this
// app was missing entirely before.
const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP?eventtypes=TC';

// North Indian Ocean basin (Arabian Sea + Bay of Bengal + approach paths) —
// the only basin relevant to India's coast. GDACS tracks cyclones globally,
// so this filters out Pacific/Atlantic storms that would otherwise show up.
const BASIN_BBOX = { minLat: -5, maxLat: 30, minLon: 40, maxLon: 100 };

export interface CycloneAlert {
  name: string;
  lat: number;
  lon: number;
  alertLevel: 'Green' | 'Orange' | 'Red';
  severityText: string;
  fromDate: string;
  toDate: string;
  reportUrl: string;
}

interface CacheEntry {
  data: CycloneAlert[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
// Cyclone tracks are updated a few times a day by the source agencies;
// no need to hammer the API more often than that.
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function getActiveCyclonesNearIndia(): Promise<CycloneAlert[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  try {
    const res = await fetch(GDACS_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`GDACS responded ${res.status}`);
    const data = await res.json();

    const cyclones: CycloneAlert[] = (data.features ?? [])
      .filter((f: any) => f.properties?.eventtype === 'TC')
      .map((f: any) => {
        const [lon, lat] = f.geometry.coordinates;
        return {
          name: f.properties.name,
          lat,
          lon,
          alertLevel: f.properties.alertlevel,
          severityText: f.properties.severitydata?.severitytext ?? 'Unknown severity',
          fromDate: f.properties.fromdate,
          toDate: f.properties.todate,
          reportUrl: f.properties.url?.report ?? '',
        };
      })
      .filter((c: CycloneAlert) => c.lat >= BASIN_BBOX.minLat && c.lat <= BASIN_BBOX.maxLat && c.lon >= BASIN_BBOX.minLon && c.lon <= BASIN_BBOX.maxLon);

    cache = { data: cyclones, fetchedAt: Date.now() };
    return cyclones;
  } catch (err) {
    console.warn('GDACS cyclone fetch failed:', err instanceof Error ? err.message : err);
    return cache?.data ?? [];
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A cyclone's real-world impact (wind, swell, rain bands) extends far
// beyond its center point — 500km is a reasonable "you should know about
// this" radius for small-craft safety planning, not a claim of a precise
// hazard boundary.
const PROXIMITY_KM = 500;

export interface NearbyCyclone {
  cyclone: CycloneAlert;
  distanceKm: number;
}

export function findNearbyCycloneFromList(lat: number, lon: number, cyclones: CycloneAlert[]): NearbyCyclone | null {
  let nearest: NearbyCyclone | null = null;
  for (const cyclone of cyclones) {
    const distanceKm = haversineKm(lat, lon, cyclone.lat, cyclone.lon);
    if (distanceKm <= PROXIMITY_KM && (!nearest || distanceKm < nearest.distanceKm)) {
      nearest = { cyclone, distanceKm };
    }
  }
  return nearest;
}

export async function findNearbyCyclone(lat: number, lon: number): Promise<NearbyCyclone | null> {
  const cyclones = await getActiveCyclonesNearIndia();
  return findNearbyCycloneFromList(lat, lon, cyclones);
}
