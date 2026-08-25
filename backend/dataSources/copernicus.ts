import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

interface DatasetConfig {
  datasetId: string;
  variable: string;
  convert?: (raw: number) => number;
}

// Met Office OSTIA global L4 SST, daily NRT.
// https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001
const SST_CONFIG: DatasetConfig = {
  datasetId: 'METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2',
  variable: 'analysed_sst',
  convert: (kelvin) => kelvin - 273.15,
};

// Gap-free ocean colour chlorophyll-a — interpolated to fill cloud-blocked
// pixels, unlike INCOIS's raw satellite pass (which is why most points fail
// on that source but succeed here).
// https://data.marine.copernicus.eu/product/OCEANCOLOUR_GLO_BGC_L4_NRT_009_102
const CHL_CONFIG: DatasetConfig = {
  datasetId: 'cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D',
  variable: 'CHL',
};

export interface CopernicusReading {
  value: number | null;
  degraded: boolean;
}

export interface DailyValue {
  date: string; // YYYY-MM-DD
  value: number;
}

interface ReadingCacheEntry {
  reading: CopernicusReading;
  fetchedAt: number;
}

interface HistoryCacheEntry {
  history: DailyValue[];
  fetchedAt: number;
}

const readingCache = new Map<string, ReadingCacheEntry>();
const historyCache = new Map<string, HistoryCacheEntry>();
// Both datasets update roughly daily; a long TTL avoids hammering a slow
// CLI subprocess on every chat message for the same region.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function hasCredentials(): boolean {
  return !!process.env.COPERNICUSMARINE_SERVICE_USERNAME && !!process.env.COPERNICUSMARINE_SERVICE_PASSWORD;
}

// Pulls a window of daily values for a small bbox around (lat, lon), grouped
// by date and averaged per day (a few 4km-ish pixels per day). Used both for
// the single "latest reading" agents need and the multi-day history charts.
async function fetchDailySeries(config: DatasetConfig, lat: number, lon: number, days: number): Promise<DailyValue[]> {
  const half = 0.1;
  const tmpDir = path.join(os.tmpdir(), `orca-cm-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
  await mkdir(tmpDir, { recursive: true });

  // NRT products typically lag 1-2 days behind "now" — the extra day of
  // padding accounts for that so the requested window isn't clipped short.
  const now = new Date();
  const start = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000);
  const outFile = `${config.variable.toLowerCase()}.csv`;

  try {
    await execFileAsync(
      'copernicusmarine',
      [
        'subset',
        '-i', config.datasetId,
        '-v', config.variable,
        '-x', String(lon - half),
        '-X', String(lon + half),
        '-y', String(lat - half),
        '-Y', String(lat + half),
        '-t', start.toISOString(),
        '-T', now.toISOString(),
        '--file-format', 'csv',
        '-o', tmpDir,
        '-f', outFile,
        '--overwrite',
        '--disable-progress-bar',
        '--username', process.env.COPERNICUSMARINE_SERVICE_USERNAME!,
        '--password', process.env.COPERNICUSMARINE_SERVICE_PASSWORD!,
      ],
      {
        timeout: 60000,
        // Each process only subsets a handful of pixels — it doesn't need
        // numpy/OpenBLAS's default of one thread per host CPU. Left
        // uncapped, concurrent subprocesses (e.g. the startup cache warm-up)
        // collectively try to spawn hundreds of threads and start failing
        // with "pthread_create failed ... Resource temporarily unavailable".
        env: { ...process.env, OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1', MKL_NUM_THREADS: '1' },
      }
    );

    const csv = await readFile(path.join(tmpDir, outFile), 'utf-8');
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const timeIdx = header.indexOf('time');
    const valueIdx = header.indexOf(config.variable);
    if (valueIdx === -1 || timeIdx === -1) return [];

    const byDate = new Map<string, number[]>();
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      const date = cols[timeIdx]?.slice(0, 10);
      const value = parseFloat(cols[valueIdx]);
      if (!date || Number.isNaN(value)) continue;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(value);
    }

    return [...byDate.entries()]
      .map(([date, values]) => {
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return { date, value: config.convert ? config.convert(avg) : avg };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getReading(cacheKeyPrefix: string, config: DatasetConfig, lat: number, lon: number): Promise<CopernicusReading> {
  const key = `${cacheKeyPrefix}:${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const cached = readingCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.reading;
  }

  if (!hasCredentials()) {
    // Never invoke the CLI without credentials — it drops into an
    // interactive username/password prompt on stdin and hangs.
    return { value: null, degraded: true };
  }

  try {
    const series = await fetchDailySeries(config, lat, lon, 6);
    const value = series.length > 0 ? series[series.length - 1].value : null;
    const reading: CopernicusReading = { value, degraded: value === null };
    readingCache.set(key, { reading, fetchedAt: Date.now() });
    return reading;
  } catch (err) {
    const stderr = (err as { stderr?: string })?.stderr;
    console.warn(
      `Copernicus Marine fetch failed (${config.variable}) at ${lat.toFixed(1)},${lon.toFixed(1)}:`,
      err instanceof Error ? err.message : err,
      stderr ? `\n--- stderr ---\n${stderr}` : ''
    );
    const reading: CopernicusReading = { value: null, degraded: true };
    readingCache.set(key, { reading, fetchedAt: Date.now() });
    return reading;
  }
}

async function getHistory(cacheKeyPrefix: string, config: DatasetConfig, lat: number, lon: number, days: number): Promise<DailyValue[]> {
  const key = `${cacheKeyPrefix}:${lat.toFixed(1)}:${lon.toFixed(1)}:${days}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) {
    return cached.history;
  }

  if (!hasCredentials()) return [];

  try {
    const history = await fetchDailySeries(config, lat, lon, days);
    historyCache.set(key, { history, fetchedAt: Date.now() });
    return history;
  } catch (err) {
    const stderr = (err as { stderr?: string })?.stderr;
    console.warn(
      `Copernicus Marine history fetch failed (${config.variable}) at ${lat.toFixed(1)},${lon.toFixed(1)}:`,
      err instanceof Error ? err.message : err,
      stderr ? `\n--- stderr ---\n${stderr}` : ''
    );
    return [];
  }
}

export function getSstAt(lat: number, lon: number): Promise<CopernicusReading> {
  return getReading('sst', SST_CONFIG, lat, lon);
}

export function getChlAt(lat: number, lon: number): Promise<CopernicusReading> {
  return getReading('chl', CHL_CONFIG, lat, lon);
}

export function getSstHistory(lat: number, lon: number, days = 30): Promise<DailyValue[]> {
  return getHistory('sst', SST_CONFIG, lat, lon, days);
}

export function getChlHistory(lat: number, lon: number, days = 30): Promise<DailyValue[]> {
  return getHistory('chl', CHL_CONFIG, lat, lon, days);
}
