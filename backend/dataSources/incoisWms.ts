// INCOIS's own GeoServer WMS instance — the same live SST/chlorophyll raster
// layers that power their public PFZ web GIS (https://incois.gov.in/geoportal/MFASPFZ/).
// Public, keyless, updated with each satellite pass. No official REST/JSON API
// exists for PFZ zone geometry itself, so we read the raw grids directly.
const WMS_BASE = 'https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms';
const WORKSPACE = 'PFZ-TUNA-SST-CHL';

export type GridLayer = 'sst' | 'chl';

export interface GridReading {
  value: number | null;
  offsetDeg: number;
  degraded: boolean;
}

interface CacheEntry {
  reading: GridReading;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

// Center point first, then a small ring of offsets (in degrees) to fall back
// to the nearest valid pixel when the exact point is land-masked or cloud-gapped.
const SEARCH_OFFSETS: [dLon: number, dLat: number][] = [
  [0, 0],
  [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3],
  [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3],
];

async function fetchPixel(layer: GridLayer, lat: number, lon: number): Promise<number | null> {
  const half = 0.15;
  const bbox = [lon - half, lat - half, lon + half, lat + half].join(',');
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: `${WORKSPACE}:${layer}`,
    QUERY_LAYERS: `${WORKSPACE}:${layer}`,
    BBOX: bbox,
    WIDTH: '10',
    HEIGHT: '10',
    X: '5',
    Y: '5',
    SRS: 'EPSG:4326',
    INFO_FORMAT: 'text/plain',
    FEATURE_COUNT: '1',
  });

  const res = await fetch(`${WMS_BASE}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`INCOIS WMS (${layer}) responded ${res.status}`);
  const text = await res.text();
  const match = text.match(/GRAY_INDEX\s*=\s*(-?[\d.]+|NaN)/i);
  if (!match) return null;
  if (match[1].toLowerCase() === 'nan') return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num) || num === -1) return null;
  return num;
}

// INCOIS's actual PFZ advisory line is only published as a per-sector image
// (no structured feed exists), so "potential" here is a transparent,
// low-cost derivation from the same two live signals INCOIS's own method
// relies on — elevated chlorophyll + an optimal thermal band for pelagic
// aggregation — not a pull of the official advisory itself.
export function derivePfzPotential(sst: number | null, chl: number | null): 'High' | 'Moderate' | 'Low' {
  const optimalTemp = sst !== null && sst >= 27.5 && sst <= 29.5;
  const elevatedChl = chl !== null && chl >= 0.2;
  if (elevatedChl && optimalTemp) return 'High';
  if (elevatedChl || optimalTemp) return 'Moderate';
  return 'Low';
}

export async function getGridValue(layer: GridLayer, lat: number, lon: number): Promise<GridReading> {
  const key = `${layer}:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.reading;
  }

  const results = await Promise.allSettled(
    SEARCH_OFFSETS.map(async ([dLon, dLat]) => ({
      value: await fetchPixel(layer, lat + dLat, lon + dLon),
      offsetDeg: Math.hypot(dLat, dLon),
    }))
  );

  let best: { value: number; offsetDeg: number } | null = null;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.value !== null) {
      if (!best || r.value.offsetDeg < best.offsetDeg) best = { value: r.value.value, offsetDeg: r.value.offsetDeg };
    }
  }

  const reading: GridReading = best
    ? { value: best.value, offsetDeg: best.offsetDeg, degraded: best.offsetDeg > 0 }
    : { value: null, offsetDeg: -1, degraded: true };

  cache.set(key, { reading, fetchedAt: Date.now() });
  return reading;
}
