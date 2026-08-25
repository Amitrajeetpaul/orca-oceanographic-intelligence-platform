import { getAllRegions } from './regions';
import { getWeather } from './dataSources/openMeteo';

export interface LiveAlert {
  id: string;
  title: string;
  timeAgo: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  description: string;
  location: string;
  meta: string;
  severity: 'High' | 'Moderate' | 'Low' | 'Notice';
  coordinates?: string;
  actionAdvice: string;
  source: string;
}

// Thunderstorm-family WMO weather codes (Open-Meteo uses the WMO code table).
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

// Real hazard alerts, derived live from the same thresholds the weather
// agent and route planner already use (wave>2m or wind>20kts = caution;
// wave>3m or wind>30kts = danger) — not a fabricated bulletin feed. Checks
// every known region in parallel; only regions currently exceeding a
// threshold produce an alert, so a calm day legitimately returns few or none.
export async function getLiveAlerts(): Promise<LiveAlert[]> {
  const regions = getAllRegions();

  const results = await Promise.all(
    regions.map(async ({ name, coords }) => {
      try {
        const w = await getWeather(coords.lat, coords.lon);
        const windKts = w.windSpeedKmh / 1.852;
        const wave = w.waveHeightM;
        const isThunderstorm = THUNDERSTORM_CODES.has(w.weatherCode);

        const isDanger = isThunderstorm || (wave !== null && wave > 3) || windKts > 30;
        const isCaution = !isDanger && ((wave !== null && wave > 2) || windKts > 20);

        if (!isDanger && !isCaution) return null;

        const waveText = wave !== null ? `${wave.toFixed(1)}m waves` : 'wave data unavailable';
        const windText = `${windKts.toFixed(0)}kt winds`;

        let title: string;
        let description: string;
        let actionAdvice: string;

        if (isThunderstorm) {
          title = `Thunderstorm Activity — ${name}`;
          description = `Live forecast reports thunderstorm conditions near ${name}, with ${windText} and ${waveText}.`;
          actionAdvice = 'Avoid launching; lightning risk for small craft. Wait for conditions to clear before heading out.';
        } else if (isDanger) {
          title = `Rough Sea Conditions — ${name}`;
          description = `Live conditions near ${name} show ${waveText} and ${windText}, exceeding safe small-craft thresholds.`;
          actionAdvice = 'Not recommended for small fishing vessels. Delay departure or seek sheltered waters.';
        } else {
          title = `Elevated Sea State — ${name}`;
          description = `Live conditions near ${name} show ${waveText} and ${windText} — above typical calm-day levels.`;
          actionAdvice = 'Exercise caution; check conditions again before departure.';
        }

        const alert: LiveAlert = {
          id: `live-${name.replace(/\s+/g, '-').toLowerCase()}`,
          title,
          timeAgo: 'Live',
          type: isDanger ? 'danger' : 'warning',
          description,
          location: name,
          meta: isThunderstorm ? 'Thunderstorm' : waveText,
          severity: isDanger ? 'High' : 'Moderate',
          coordinates: `${coords.lat.toFixed(2)}° N, ${coords.lon.toFixed(2)}° E`,
          actionAdvice,
          source: 'Open-Meteo Marine & Weather Forecast (live)',
        };
        return alert;
      } catch {
        return null;
      }
    })
  );

  return results.filter((a): a is LiveAlert => a !== null);
}
