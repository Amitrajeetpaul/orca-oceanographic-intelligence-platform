// Real Exclusive Economic Zone boundaries — VLIZ Marine Regions' Maritime
// Boundaries Geodatabase (v12), the standard authoritative EEZ dataset used
// in marine research, served as a public WMS. Confirmed against real
// geography: the India/Sri Lanka boundary in Palk Strait correctly flips
// right around 79.6°E, matching the real Kachchatheevu area where Indian
// fishermen crossing into Sri Lankan waters is a genuine, well-documented
// safety and legal risk.
//
// This gives country-level EEZ containment only — not the precise
// India-Sri Lanka treaty line itself, which isn't available as a public
// queryable API. Framed honestly to the user as "approaching/inside
// <country>'s waters", not a claim of exact treaty-line precision.
const VLIZ_WMS = 'https://geo.vliz.be/geoserver/wms';
const LAYER = 'MarineRegions:eez';

// ~28km / ~15nm — enough for a small craft to have real reaction time
// before actually crossing, without flagging every coastal query.
const RING_OFFSET_DEG = 0.25;

export interface GeofenceStatus {
  currentTerritory: string | null; // null = high seas or no EEZ data at this point
  inForeignWaters: boolean;
  nearForeignBoundary: boolean;
  nearbyTerritory: string | null;
}

interface CacheEntry {
  status: GeofenceStatus;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // EEZ boundaries don't move

async function fetchTerritory(lat: number, lon: number): Promise<string | null> {
  const half = 0.05;
  const bbox = [lon - half, lat - half, lon + half, lat + half].join(',');
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: LAYER,
    QUERY_LAYERS: LAYER,
    BBOX: bbox,
    WIDTH: '10',
    HEIGHT: '10',
    X: '5',
    Y: '5',
    SRS: 'EPSG:4326',
    // text/plain, not application/json — the JSON format includes the full
    // multi-megabyte EEZ polygon geometry per feature (tens of thousands of
    // points), which is far too slow for a per-chat-message check. Plain
    // text gives just the attribute dump we actually need.
    INFO_FORMAT: 'text/plain',
    FEATURE_COUNT: '1',
  });

  const res = await fetch(`${VLIZ_WMS}?${params.toString()}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Marine Regions WMS responded ${res.status}`);
  const text = await res.text();
  const match = text.match(/^territory1\s*=\s*(.+)$/m);
  if (!match || match[1].trim().toLowerCase() === 'null') return null;
  return match[1].trim();
}

export async function checkGeofence(lat: number, lon: number): Promise<GeofenceStatus> {
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.status;
  }

  const fallback: GeofenceStatus = {
    currentTerritory: null,
    inForeignWaters: false,
    nearForeignBoundary: false,
    nearbyTerritory: null,
  };

  try {
    const [center, north, south, east, west] = await Promise.all([
      fetchTerritory(lat, lon),
      fetchTerritory(lat + RING_OFFSET_DEG, lon),
      fetchTerritory(lat - RING_OFFSET_DEG, lon),
      fetchTerritory(lat, lon + RING_OFFSET_DEG),
      fetchTerritory(lat, lon - RING_OFFSET_DEG),
    ]);

    const differing = [north, south, east, west].find((t) => t !== null && t !== center);

    const status: GeofenceStatus = {
      currentTerritory: center,
      inForeignWaters: center !== null && center !== 'India',
      nearForeignBoundary: !!differing,
      nearbyTerritory: differing ?? null,
    };
    cache.set(key, { status, fetchedAt: Date.now() });
    return status;
  } catch (err) {
    console.warn('Geofence check failed:', err instanceof Error ? err.message : err);
    return fallback;
  }
}
