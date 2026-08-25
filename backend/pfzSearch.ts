import { getGridValue, derivePfzPotential } from './dataSources/incoisWms';

export interface PfzCandidate {
  lat: number;
  lon: number;
  distanceNm: number;
  bearingDeg: number;
  bearingLabel: string;
  potential: 'High' | 'Moderate' | 'Low';
  sst: number | null;
  chl: number | null;
}

const EARTH_RADIUS_NM = 3440.065;

function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceNm: number): { lat: number; lon: number } {
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const angDist = distanceNm / EARTH_RADIUS_NM;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1), Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2));

  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function bearingLabel(bearingDeg: number): string {
  return COMPASS_LABELS[Math.round(bearingDeg / 45) % 8];
}

// 8 compass directions at 8nm out — a real search over live INCOIS SST/
// chlorophyll grid points around the origin, not a single-point lookup.
// Kept modest (not multiple distance rings) since each grid point itself
// already fans out into several fallback requests internally.
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const SEARCH_DISTANCE_NM = 8;

// Finds the best-looking nearby potential fishing zone for "route me to
// the nearest good fishing spot"-style questions, where the destination
// isn't a real named place we can geocode — it's something we have to
// derive from live ocean-color/thermal data, the same signals INCOIS's
// own PFZ advisory method uses.
export async function findNearestPfz(originLat: number, originLon: number): Promise<PfzCandidate | null> {
  const candidatePoints = BEARINGS.map((bearingDeg) => ({
    bearingDeg,
    ...destinationPoint(originLat, originLon, bearingDeg, SEARCH_DISTANCE_NM),
  }));

  const results = await Promise.all(
    candidatePoints.map(async (c) => {
      const [sst, chl] = await Promise.all([
        getGridValue('sst', c.lat, c.lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
        getGridValue('chl', c.lat, c.lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
      ]);
      const candidate: PfzCandidate = {
        lat: c.lat,
        lon: c.lon,
        distanceNm: SEARCH_DISTANCE_NM,
        bearingDeg: c.bearingDeg,
        bearingLabel: bearingLabel(c.bearingDeg),
        potential: derivePfzPotential(sst.value, chl.value),
        sst: sst.value,
        chl: chl.value,
      };
      return candidate;
    })
  );

  const rank: Record<'High' | 'Moderate' | 'Low', number> = { High: 2, Moderate: 1, Low: 0 };
  const withData = results.filter((r) => r.sst !== null || r.chl !== null);
  if (withData.length === 0) return null;

  withData.sort((a, b) => rank[b.potential] - rank[a.potential] || (b.chl ?? 0) - (a.chl ?? 0));
  return withData[0];
}
