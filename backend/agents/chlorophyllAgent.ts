import type { AgentFinding } from '../../src/types';
import { getGridValue, derivePfzPotential } from '../dataSources/incoisWms';
import { getChlAt, getSstAt } from '../dataSources/copernicus';

const COPERNICUS_SOURCE_NAME = 'Copernicus Marine Service (gap-free ocean colour, NRT)';
const COPERNICUS_SOURCE_URL = 'https://data.marine.copernicus.eu/product/OCEANCOLOUR_GLO_BGC_L4_NRT_009_102';
const INCOIS_SOURCE_NAME = 'INCOIS PFZ-TUNA Chlorophyll (live satellite composite)';
const INCOIS_SOURCE_URL = 'https://incois.gov.in/geoportal/MFASPFZ/index.html';

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

  // INCOIS's raw chlorophyll pass is cloud-blocked at most points; Copernicus's
  // gap-free product is interpolated to avoid that, so it's tried first.
  const [copernicusChl, copernicusSst] = await Promise.all([
    getChlAt(lat, lon),
    getSstAt(lat, lon),
  ]);

  let chlValue: number | null = copernicusChl.value;
  let chlDegraded = copernicusChl.degraded;
  let sourceName = COPERNICUS_SOURCE_NAME;
  let sourceUrl = COPERNICUS_SOURCE_URL;
  let usedIncois = false;

  let sstValue = copernicusSst.value;

  if (chlValue === null) {
    const [incoisChl, incoisSst] = await Promise.all([
      getGridValue('chl', lat, lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
      sstValue === null ? getGridValue('sst', lat, lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })) : null,
    ]);
    chlValue = incoisChl.value;
    chlDegraded = incoisChl.degraded;
    sourceName = INCOIS_SOURCE_NAME;
    sourceUrl = INCOIS_SOURCE_URL;
    usedIncois = true;
    if (sstValue === null && incoisSst) sstValue = incoisSst.value;
  }

  if (chlValue === null) {
    return {
      pfzPotential: 'Low',
      finding: {
        agentName: 'Chlorophyll & PFZ Agent',
        type: 'chlorophyll',
        sourceName,
        sourceUrl,
        timestamp,
        confidence: 0,
        metric: 'Phytoplankton Concentration',
        value: 'Unavailable',
        rawFindings:
          'No valid chlorophyll reading found near this location from either Copernicus (gap-free) or INCOIS — likely a genuine data gap for this exact spot. Fishing-zone potential cannot be derived without this reading.',
        status: 'warning',
      },
    };
  }

  const pfzPotential = derivePfzPotential(sstValue, chlValue);
  const confidence = chlDegraded ? 65 : usedIncois ? 90 : 95;
  return {
    pfzPotential,
    finding: {
      agentName: 'Chlorophyll & PFZ Agent',
      type: 'chlorophyll',
      sourceName,
      sourceUrl,
      timestamp,
      confidence,
      metric: 'Phytoplankton Concentration',
      value: `${chlValue.toFixed(2)} mg/m³`,
      rawFindings: `Live chlorophyll-a concentration is ${chlValue.toFixed(2)} mg/m³${sstValue !== null ? ` at ${sstValue.toFixed(1)}°C SST` : ''}, indicating ${pfzPotential.toLowerCase()} potential for a productive fishing zone (live-data-derived indicator, not the official INCOIS PFZ advisory line).`,
      status: chlDegraded ? 'warning' : 'completed',
    },
  };
}
