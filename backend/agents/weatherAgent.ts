import type { AgentFinding } from '../../src/types';
import { getWeather, getForecastForDay } from '../dataSources/openMeteo';

const SOURCE_NAME = 'Open-Meteo Marine & Weather Forecast';
const SOURCE_URL = 'https://open-meteo.com';

// WMO weather codes for the thunderstorm family (same table used elsewhere
// in this app for the Alerts feed's thunderstorm detection).
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

export async function runWeatherAgent(lat: number, lon: number): Promise<AgentFinding> {
  const timestamp = new Date().toISOString();

  try {
    const w = await getWeather(lat, lon);
    const windKts = w.windSpeedKmh / 1.852;
    const hasThunderstorm = THUNDERSTORM_CODES.has(w.weatherCode);
    const hazardous = (w.waveHeightM !== null && w.waveHeightM > 2) || windKts > 20 || hasThunderstorm;
    const waveText = w.waveHeightM !== null ? `${w.waveHeightM.toFixed(1)}m wave` : 'wave data unavailable';
    const swellText = w.swellHeightM !== null ? `, ${w.swellHeightM.toFixed(1)}m swell` : '';
    // Always stated explicitly (yes or no) — the model needs an explicit
    // "no lightning risk right now" fact to answer honestly, not silence
    // that could be misread as the topic being unavailable/out of scope.
    const lightningText = hasThunderstorm
      ? 'Thunderstorm activity detected in the current forecast — real lightning risk right now.'
      : 'No thunderstorm activity in the current forecast — no lightning risk right now.';

    return {
      agentName: 'Marine Weather & Hazards Agent',
      type: 'weather',
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence: 92,
      metric: 'Wind & Sea State',
      value: `${windKts.toFixed(0)} kts, ${waveText}`,
      rawFindings: `Live forecast: wind ${windKts.toFixed(0)} knots from ${w.windDirectionDeg.toFixed(0)}°, ${waveText}${swellText}.${
        hazardous ? ' Conditions exceed comfortable small-craft thresholds.' : ' Conditions are within typical safe operating range.'
      } ${lightningText}`,
      status: hazardous ? 'warning' : 'completed',
    };
  } catch (err) {
    return {
      agentName: 'Marine Weather & Hazards Agent',
      type: 'weather',
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence: 0,
      metric: 'Wind & Sea State',
      value: 'Unavailable',
      rawFindings: `Data fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      status: 'warning',
    };
  }
}

// Real multi-day forecast, for genuinely future-dated questions ("what
// about tomorrow?") — distinct from runWeatherAgent's "right now" reading.
// No equivalent forecast source exists for SST/chlorophyll, so those
// agents are never swapped out the same way; the orchestrator's evidence
// text makes that split explicit to the model.
export async function runForecastAgent(lat: number, lon: number, daysAhead: number, dateLabel: string): Promise<AgentFinding> {
  const timestamp = new Date().toISOString();

  try {
    const f = await getForecastForDay(lat, lon, daysAhead);
    if (!f) throw new Error('No forecast data returned for that day');

    const windKts = f.windSpeedKmh !== null ? f.windSpeedKmh / 1.852 : null;
    const hasThunderstorm = f.weatherCode !== null && THUNDERSTORM_CODES.has(f.weatherCode);
    const hazardous = (f.waveHeightM !== null && f.waveHeightM > 2) || (windKts !== null && windKts > 20) || hasThunderstorm;
    const windText = windKts !== null ? `${windKts.toFixed(0)} kts forecast wind` : 'wind forecast unavailable';
    const waveText = f.waveHeightM !== null ? `${f.waveHeightM.toFixed(1)}m forecast max wave` : 'wave forecast unavailable';
    const lightningText = hasThunderstorm
      ? 'Thunderstorm activity forecast — real lightning risk.'
      : 'No thunderstorm activity forecast — no lightning risk expected.';

    return {
      agentName: 'Marine Weather & Hazards Agent',
      type: 'weather',
      sourceName: `${SOURCE_NAME} (${daysAhead}-day forecast)`,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence: 80,
      metric: `Forecast for ${dateLabel} (${f.date})`,
      value: `${windText}, ${waveText}`,
      rawFindings: `Forecast for ${dateLabel} (${f.date}): ${windText}, ${waveText}. This is a FORECAST, not a live reading — accuracy decreases the further out the day is.${
        hazardous ? ' Forecast conditions exceed comfortable small-craft thresholds.' : ' Forecast conditions are within typical safe operating range.'
      } ${lightningText}`,
      status: hazardous ? 'warning' : 'completed',
    };
  } catch (err) {
    return {
      agentName: 'Marine Weather & Hazards Agent',
      type: 'weather',
      sourceName: `${SOURCE_NAME} (forecast)`,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence: 0,
      metric: `Forecast for ${dateLabel}`,
      value: 'Unavailable',
      rawFindings: `Forecast fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      status: 'warning',
    };
  }
}
