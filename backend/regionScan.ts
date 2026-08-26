import { getAllRegions } from './regions';
import { getGridValue, derivePfzPotential } from './dataSources/incoisWms';
import { getWeather } from './dataSources/openMeteo';
import { checkGeofence } from './dataSources/eez';

export interface RegionScanResult {
  region: string;
  sst: number | null;
  chl: number | null;
  pfzPotential: 'High' | 'Moderate' | 'Low';
  windKts: number | null;
  waveHeightM: number | null;
  hazardous: boolean;
  hazardReason: string | null;
  nearForeignWaters: boolean;
  foreignTerritory: string | null;
}

// Scans every known coastal region in parallel using the same live INCOIS
// SST/chlorophyll grid, Open-Meteo weather, and VLIZ EEZ sources already
// used elsewhere — powers "which regions look good" / "which zones should
// be avoided" style questions that span the whole coast rather than one
// named place.
export async function scanAllRegions(): Promise<RegionScanResult[]> {
  const regions = getAllRegions();

  const results = await Promise.all(
    regions.map(async ({ name, coords }): Promise<RegionScanResult> => {
      const [sstReading, chlReading, weather, geofence] = await Promise.all([
        getGridValue('sst', coords.lat, coords.lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
        getGridValue('chl', coords.lat, coords.lon).catch(() => ({ value: null, offsetDeg: -1, degraded: true })),
        getWeather(coords.lat, coords.lon).catch(() => null),
        checkGeofence(coords.lat, coords.lon).catch(() => null),
      ]);

      const windKts = weather ? weather.windSpeedKmh / 1.852 : null;
      const wave = weather?.waveHeightM ?? null;
      const hazardous = (wave !== null && wave > 2) || (windKts !== null && windKts > 20);

      let hazardReason: string | null = null;
      if (hazardous) {
        const parts: string[] = [];
        if (wave !== null && wave > 2) parts.push(`${wave.toFixed(1)}m waves`);
        if (windKts !== null && windKts > 20) parts.push(`${windKts.toFixed(0)}kt wind`);
        hazardReason = parts.join(', ');
      }

      return {
        region: name,
        sst: sstReading.value,
        chl: chlReading.value,
        pfzPotential: derivePfzPotential(sstReading.value, chlReading.value),
        windKts,
        waveHeightM: wave,
        hazardous,
        hazardReason,
        nearForeignWaters: !!(geofence?.inForeignWaters || geofence?.nearForeignBoundary),
        foreignTerritory: geofence?.currentTerritory || geofence?.nearbyTerritory || null,
      };
    })
  );

  return results;
}
