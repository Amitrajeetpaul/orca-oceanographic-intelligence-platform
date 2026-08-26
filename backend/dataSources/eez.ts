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

interface EEZInfo {
  // Specific territory name (e.g. "Andaman and Nicobar") — for display only.
  territory: string | null;
  // Actual owning country — this is what determines foreign vs. domestic.
  // Overseas territories report their own territory1 (distinct from
  // mainland "India") but the correct sovereign1 either way — comparing
  // territory1 against a hardcoded 'India' incorrectly flagged Andaman &
  // Nicobar Islands as foreign waters (confirmed via raw VLIZ data: that
  // EEZ record has territory1="Andaman and Nicobar", sovereign1="India").
  sovereign: string | null;
}

function parseField(text: string, field: string): string | null {
  const match = text.match(new RegExp(`^${field}\\s*=\\s*(.+)$`, 'm'));
  if (!match || match[1].trim().toLowerCase() === 'null') return null;
  return match[1].trim();
}

async function fetchEEZInfo(lat: number, lon: number): Promise<EEZInfo> {
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
  return { territory: parseField(text, 'territory1'), sovereign: parseField(text, 'sovereign1') };
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
      fetchEEZInfo(lat, lon),
      fetchEEZInfo(lat + RING_OFFSET_DEG, lon),
      fetchEEZInfo(lat - RING_OFFSET_DEG, lon),
      fetchEEZInfo(lat, lon + RING_OFFSET_DEG),
      fetchEEZInfo(lat, lon - RING_OFFSET_DEG),
    ]);

    // A ring point counts as a different, foreign country only when its
    // sovereign differs from the center's AND isn't India — two Indian
    // territories (mainland vs. an island group) bordering each other
    // isn't a real "approaching foreign waters" situation.
    const differing = [north, south, east, west].find((r) => r.sovereign !== null && r.sovereign !== center.sovereign && r.sovereign !== 'India');

    const status: GeofenceStatus = {
      currentTerritory: center.territory ?? center.sovereign,
      inForeignWaters: center.sovereign !== null && center.sovereign !== 'India',
      nearForeignBoundary: !!differing,
      nearbyTerritory: differing ? differing.territory ?? differing.sovereign : null,
    };
    cache.set(key, { status, fetchedAt: Date.now() });
    return status;
  } catch (err) {
    console.warn('Geofence check failed:', err instanceof Error ? err.message : err);
    return fallback;
  }
}
