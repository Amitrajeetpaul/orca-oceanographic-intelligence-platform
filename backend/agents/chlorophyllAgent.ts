import type { AgentFinding } from '../../src/types';
import { getGridValue, derivePfzPotential } from '../dataSources/incoisWms';

const SOURCE_NAME = 'INCOIS PFZ-TUNA Chlorophyll (live satellite composite)';
const SOURCE_URL = 'https://incois.gov.in/geoportal/MFASPFZ/index.html';

export interface ChlorophyllResult {
  finding: AgentFinding;
  pfzPotential: 'High' | 'Moderate' | 'Low';
}

// INCOIS's actual PFZ advisory line is only published as a per-sector image
// (no structured feed exists), so "potential" here is a transparent,
// low-cost derivation from the same two live signals INCOIS's own method
// relies on — elevated chlorophyll + an optimal thermal band for pelagic
// aggregation — not a pull of the official advisory itself.
export async function runChlorophyllAgent(lat: number, lon: number): Promise<ChlorophyllResult> {
  const timestamp = new Date().toISOString();

  const [chl, sst] = await Promise.all([
    getGridValue('chl', lat, lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
    getGridValue('sst', lat, lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
  ]);

  if (chl.value === null) {
    return {
      pfzPotential: 'Low',
      finding: {
        agentName: 'Chlorophyll & PFZ Agent',
        type: 'chlorophyll',
        sourceName: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        timestamp,
        confidence: 0,
        metric: 'Phytoplankton Concentration',
        value: 'Unavailable',
        rawFindings:
          "No valid chlorophyll pixel found near this location (likely cloud cover in today's satellite pass). Fishing-zone potential cannot be derived without this reading.",
        status: 'warning',
      },
    };
  }

  const pfzPotential = derivePfzPotential(sst.value, chl.value);
  const confidence = chl.degraded ? 65 : 90;
  return {
    pfzPotential,
    finding: {
      agentName: 'Chlorophyll & PFZ Agent',
      type: 'chlorophyll',
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      timestamp,
      confidence,
      metric: 'Phytoplankton Concentration',
      value: `${chl.value.toFixed(2)} mg/m³`,
      rawFindings: `Live chlorophyll-a concentration is ${chl.value.toFixed(2)} mg/m³${sst.value !== null ? ` at ${sst.value.toFixed(1)}°C SST` : ''}, indicating ${pfzPotential.toLowerCase()} potential for a productive fishing zone (live-data-derived indicator, not the official INCOIS PFZ advisory line).`,
      status: chl.degraded ? 'warning' : 'completed',
    },
  };
}
