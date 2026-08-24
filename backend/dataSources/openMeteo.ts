// Open-Meteo: free, keyless REST weather + marine forecast API.
export interface WeatherReading {
  windSpeedKmh: number;
  windDirectionDeg: number;
  waveHeightM: number | null;
  swellHeightM: number | null;
  weatherCode: number;
}

interface CacheEntry {
  data: WeatherReading;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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
