import type { AgentFinding } from '../../src/types';
import { getTideInfo } from '../dataSources/openMeteo';

const SOURCE_NAME = 'Open-Meteo Marine (modeled sea level)';
const SOURCE_URL = 'https://open-meteo.com';

function formatTime(iso: string | null): string {
  if (!iso) return 'unknown time';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export async function runTideAgent(lat: number, lon: number): Promise<AgentFinding> {
  const timestamp = new Date().toISOString();

  try {
    const tide = await getTideInfo(lat, lon);
    if (tide.currentHeightM === null || !tide.next) {
      throw new Error('No tide data available for this location');
    }

    const nextLabel = `${tide.next.type === 'high' ? 'High' : 'Low'} tide at ${formatTime(tide.next.time)} (${tide.next.heightM.toFixed(2)}m)`;
    const followingLabel = tide.following
      ? `, then ${tide.following.type === 'high' ? 'high' : 'low'} tide at ${formatTime(tide.following.time)} (${tide.following.heightM.toFixed(2)}m)`
      : '';

    return {
      agentName: 'Tide & Sea Level Agent',
      type: 'tide',
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence: 80,
      metric: 'Tide',
      value: nextLabel,
      rawFindings: `Current sea level is ${tide.currentHeightM.toFixed(2)}m above mean. Next: ${nextLabel}${followingLabel}. Modeled tidal prediction, not a tide-gauge observation.`,
      status: 'completed',
    };
  } catch (err) {
    return {
      agentName: 'Tide & Sea Level Agent',
      type: 'tide',
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence: 0,
      metric: 'Tide',
      value: 'Unavailable',
      rawFindings: `Data fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      status: 'warning',
    };
  }
}
