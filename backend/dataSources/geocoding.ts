// Free, keyless place-name geocoding via OpenStreetMap's Nominatim, so users
// can ask about any place ("Marina Beach", "Kovalam", "Chennai") without it
// needing to match one of the fixed region-dropdown options.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy requires a descriptive User-Agent identifying the app.
const USER_AGENT = 'ORCA-Ocean-Intelligence-Platform/1.0 (SIH26176 hackathon project)';

export interface GeocodedPlace {
  lat: number;
  lon: number;
  displayName: string;
}

interface CacheEntry {
  result: GeocodedPlace | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // place coordinates don't change

export async function geocodePlace(placeName: string): Promise<GeocodedPlace | null> {
  const key = placeName.trim().toLowerCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const params = new URLSearchParams({
      q: `${placeName}, India`,
      format: 'json',
      limit: '3',
      countrycodes: 'in',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);

    const candidates: Array<{ lat: string; lon: string; display_name: string; importance: number }> = await res.json();
    if (candidates.length === 0) {
      cache.set(key, { result: null, fetchedAt: Date.now() });
      return null;
    }

    const best = candidates.reduce((a, b) => (b.importance > a.importance ? b : a));
    const result: GeocodedPlace = {
      lat: parseFloat(best.lat),
      lon: parseFloat(best.lon),
      displayName: best.display_name.split(',')[0],
    };
    cache.set(key, { result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.warn('Geocoding failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
