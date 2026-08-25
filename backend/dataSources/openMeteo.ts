// Open-Meteo: free, keyless REST weather + marine forecast API.
export interface WeatherReading {
  windSpeedKmh: number;
  windDirectionDeg: number;
  waveHeightM: number | null;
  swellHeightM: number | null;
  weatherCode: number;
}

export interface ForecastReading {
  date: string;
  windSpeedKmh: number | null;
  waveHeightM: number | null;
  weatherCode: number | null;
}

interface CacheEntry {
  data: WeatherReading;
  fetchedAt: number;
}

interface ForecastCacheEntry {
  data: ForecastReading | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const forecastCache = new Map<string, ForecastCacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;
// Open-Meteo forecasts don't move much within an hour; longer TTL than the
// "current" reading is fine and avoids repeat calls for the same day.
const FORECAST_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_FORECAST_DAYS_AHEAD = 7;

export async function getWeather(lat: number, lon: number): Promise<WeatherReading> {
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const forecastReq = fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`,
    { signal: AbortSignal.timeout(8000) }
  );
  const marineReq = fetch(
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,swell_wave_height&timezone=auto`,
    { signal: AbortSignal.timeout(8000) }
  ).catch(() => null);

  const [forecastRes, marineRes] = await Promise.all([forecastReq, marineReq]);

  if (!forecastRes.ok) throw new Error(`Open-Meteo forecast responded ${forecastRes.status}`);
  const forecast = await forecastRes.json();

  let waveHeightM: number | null = null;
  let swellHeightM: number | null = null;
  if (marineRes && marineRes.ok) {
    const marine = await marineRes.json();
    waveHeightM = marine.current?.wave_height ?? null;
    swellHeightM = marine.current?.swell_wave_height ?? null;
  }

  const data: WeatherReading = {
    windSpeedKmh: forecast.current.wind_speed_10m,
    windDirectionDeg: forecast.current.wind_direction_10m,
    waveHeightM,
    swellHeightM,
    weatherCode: forecast.current.weather_code,
  };

  cache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

// Real multi-day forecast (wind + wave), not the fabricated "tomorrow"
// guessing this replaces — used for genuinely future-dated questions
// ("what about tomorrow?", "safe to go out Friday?"). SST and chlorophyll
// have no equivalent forecast source, so those stay "today's live reading
// only" regardless of how this is used upstream.
export async function getForecastForDay(lat: number, lon: number, daysAhead: number): Promise<ForecastReading | null> {
  const days = Math.min(Math.max(daysAhead, 0), MAX_FORECAST_DAYS_AHEAD);
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${days}`;
  const cached = forecastCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < FORECAST_CACHE_TTL_MS) return cached.data;

  const forecastReq = fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=wind_speed_10m_max,weather_code&timezone=auto&forecast_days=${days + 1}`,
    { signal: AbortSignal.timeout(8000) }
  );
  const marineReq = fetch(
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max&timezone=auto&forecast_days=${days + 1}`,
    { signal: AbortSignal.timeout(8000) }
  ).catch(() => null);

  const [forecastRes, marineRes] = await Promise.all([forecastReq, marineReq]);
  if (!forecastRes.ok) throw new Error(`Open-Meteo daily forecast responded ${forecastRes.status}`);
  const forecast = await forecastRes.json();

  let waveHeightM: number | null = null;
  if (marineRes && marineRes.ok) {
    const marine = await marineRes.json();
    waveHeightM = marine.daily?.wave_height_max?.[days] ?? null;
  }

  const date = forecast.daily?.time?.[days];
  if (!date) {
    forecastCache.set(key, { data: null, fetchedAt: Date.now() });
    return null;
  }

  const data: ForecastReading = {
    date,
    windSpeedKmh: forecast.daily?.wind_speed_10m_max?.[days] ?? null,
    waveHeightM,
    weatherCode: forecast.daily?.weather_code?.[days] ?? null,
  };

  forecastCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}
