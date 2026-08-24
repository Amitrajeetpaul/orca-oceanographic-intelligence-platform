import { getGridValue, derivePfzPotential } from './dataSources/incoisWms';

export interface ProbeResult {
  lat: number;
  lon: number;
  sst: { value: number | null; degraded: boolean };
  chl: { value: number | null; degraded: boolean };
  pfzPotential: 'High' | 'Moderate' | 'Low';
}

export async function probePoint(lat: number, lon: number): Promise<ProbeResult> {
  const [sst, chl] = await Promise.all([getGridValue('sst', lat, lon), getGridValue('chl', lat, lon)]);
  const pfzPotential = derivePfzPotential(sst.value, chl.value);

  return {
    lat,
    lon,
    sst: { value: sst.value, degraded: sst.degraded },
    chl: { value: chl.value, degraded: chl.degraded },
    pfzPotential,
  };
}
