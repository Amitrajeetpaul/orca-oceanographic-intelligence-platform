import type { AgentFinding } from '../../src/types';
import { getSstAt } from '../dataSources/copernicus';
import { getGridValue } from '../dataSources/incoisWms';

const COPERNICUS_SOURCE_NAME = 'Copernicus Marine Service (OSTIA SST L4, NRT)';
const COPERNICUS_SOURCE_URL = 'https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001';
const INCOIS_SOURCE_NAME = 'INCOIS PFZ-TUNA SST (live satellite composite)';
const INCOIS_SOURCE_URL = 'https://incois.gov.in/geoportal/MFASPFZ/index.html';

export async function runTemperatureAgent(lat: number, lon: number): Promise<AgentFinding> {
  const timestamp = new Date().toISOString();

  try {
    const copernicus = await getSstAt(lat, lon);

    if (copernicus.value !== null) {
      return {
        agentName: 'Temperature Agent',
        type: 'temp',
        sourceName: COPERNICUS_SOURCE_NAME,
        sourceUrl: COPERNICUS_SOURCE_URL,
        timestamp,
        confidence: 95,
        metric: 'Sea Surface Temperature',
        value: `${copernicus.value.toFixed(1)}°C`,
        rawFindings: `Live Copernicus Marine satellite-derived sea surface temperature at this location is ${copernicus.value.toFixed(1)}°C.`,
        status: 'completed',
      };
    }

    // Copernicus unavailable (no credentials configured, or the fetch failed) —
    // fall back to INCOIS's live grid rather than reporting unavailable outright.
    const incois = await getGridValue('sst', lat, lon);
    if (incois.value === null) {
      return {
        agentName: 'Temperature Agent',
        type: 'temp',
        sourceName: COPERNICUS_SOURCE_NAME,
        sourceUrl: COPERNICUS_SOURCE_URL,
        timestamp,
        confidence: 0,
        metric: 'Sea Surface Temperature',
        value: 'Unavailable',
        rawFindings:
          'Copernicus Marine data unavailable (no credentials configured or fetch failed) and no valid INCOIS fallback pixel found near this location. No value is being estimated.',
        status: 'warning',
      };
    }

    const confidence = incois.degraded ? 55 : 75;
    return {
      agentName: 'Temperature Agent',
      type: 'temp',
      sourceName: INCOIS_SOURCE_NAME,
      sourceUrl: INCOIS_SOURCE_URL,
      timestamp,
      confidence,
      metric: 'Sea Surface Temperature',
      value: `${incois.value.toFixed(1)}°C`,
      rawFindings: `Copernicus Marine data unavailable (no credentials configured or fetch failed); falling back to INCOIS's live satellite composite, which reads ${incois.value.toFixed(1)}°C${incois.degraded ? ' from the nearest valid pixel' : ''}.`,
      status: 'warning',
    };
  } catch (err) {
    return {
      agentName: 'Temperature Agent',
      type: 'temp',
      sourceName: COPERNICUS_SOURCE_NAME,
      sourceUrl: COPERNICUS_SOURCE_URL,
      timestamp,
      confidence: 0,
      metric: 'Sea Surface Temperature',
      value: 'Unavailable',
      rawFindings: `Data fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      status: 'warning',
    };
  }
}
