import type { AgentFinding } from '../../src/types';
import { getWeather } from '../dataSources/openMeteo';

const SOURCE_NAME = 'Open-Meteo Marine & Weather Forecast';
const SOURCE_URL = 'https://open-meteo.com';

export async function runWeatherAgent(lat: number, lon: number): Promise<AgentFinding> {
  const timestamp = new Date().toISOString();

  try {
    const w = await getWeather(lat, lon);
    const windKts = w.windSpeedKmh / 1.852;
    const hazardous = (w.waveHeightM !== null && w.waveHeightM > 2) || windKts > 20;
    const waveText = w.waveHeightM !== null ? `${w.waveHeightM.toFixed(1)}m wave` : 'wave data unavailable';
    const swellText = w.swellHeightM !== null ? `, ${w.swellHeightM.toFixed(1)}m swell` : '';

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
      }`,
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
