import { getAllRegions } from './regions';
import { getGridValue, derivePfzPotential } from './dataSources/incoisWms';
import { getWeather } from './dataSources/openMeteo';
import { checkGeofence } from './dataSources/eez';
import { getActiveCyclonesNearIndia, findNearbyCycloneFromList } from './dataSources/gdacs';

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
  nearbyCycloneName: string | null;
}

// Scans every known coastal region in parallel using the same live INCOIS
// SST/chlorophyll grid, Open-Meteo weather, and VLIZ EEZ sources already
// used elsewhere — powers "which regions look good" / "which zones should
// be avoided" style questions that span the whole coast rather than one
// named place.
export async function scanAllRegions(): Promise<RegionScanResult[]> {
  const regions = getAllRegions();
  // Fetched once and reused per region (cheap distance math only) rather
  // than a redundant network call per region.
  const cyclones = await getActiveCyclonesNearIndia();

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
      const nearbyCyclone = findNearbyCycloneFromList(coords.lat, coords.lon, cyclones);
      const hazardous = (wave !== null && wave > 2) || (windKts !== null && windKts > 20) || !!nearbyCyclone;

      let hazardReason: string | null = null;
      if (hazardous) {
        const parts: string[] = [];
        if (nearbyCyclone) parts.push(`Cyclone ${nearbyCyclone.cyclone.name} ~${Math.round(nearbyCyclone.distanceKm)}km away`);
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
        nearbyCycloneName: nearbyCyclone?.cyclone.name ?? null,
      };
    })
  );

  return results;
}
