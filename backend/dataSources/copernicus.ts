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

interface CacheEntry {
  reading: CopernicusReading;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
// Both datasets update roughly daily; a long TTL avoids hammering a slow
// CLI subprocess on every chat message for the same region.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

function hasCredentials(): boolean {
  return !!process.env.COPERNICUSMARINE_SERVICE_USERNAME && !!process.env.COPERNICUSMARINE_SERVICE_PASSWORD;
}

async function fetchViaCli(config: DatasetConfig, lat: number, lon: number): Promise<number | null> {
  const half = 0.1;
  const tmpDir = path.join(os.tmpdir(), `orca-cm-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
  await mkdir(tmpDir, { recursive: true });

  // NRT products typically lag 1-2 days behind "now" — without a date range
  // the CLI happily returns the dataset's *entire* multi-year history
  // (thousands of rows) for this bbox, so bound it to a short trailing
  // window and take the most recent date within it.
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
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
    if (lines.length < 2) return null;

    const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const timeIdx = header.indexOf('time');
    const valueIdx = header.indexOf(config.variable);
    if (valueIdx === -1 || timeIdx === -1) return null;

    const rows = lines.slice(1).map((line) => line.split(','));
    const mostRecentDate = rows.reduce((max, r) => (r[timeIdx] > max ? r[timeIdx] : max), rows[0][timeIdx]);
    const latestValues = rows
      .filter((r) => r[timeIdx] === mostRecentDate)
      .map((r) => parseFloat(r[valueIdx]))
      .filter((v) => !Number.isNaN(v));

    if (latestValues.length === 0) return null;
    const avg = latestValues.reduce((sum, v) => sum + v, 0) / latestValues.length;
    return config.convert ? config.convert(avg) : avg;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getReading(cacheKeyPrefix: string, config: DatasetConfig, lat: number, lon: number): Promise<CopernicusReading> {
  const key = `${cacheKeyPrefix}:${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.reading;
  }

  if (!hasCredentials()) {
    // Never invoke the CLI without credentials — it drops into an
    // interactive username/password prompt on stdin and hangs.
    return { value: null, degraded: true };
  }

  try {
    const value = await fetchViaCli(config, lat, lon);
    const reading: CopernicusReading = { value, degraded: value === null };
    cache.set(key, { reading, fetchedAt: Date.now() });
    return reading;
  } catch (err) {
    const stderr = (err as { stderr?: string })?.stderr;
    console.warn(
      `Copernicus Marine fetch failed (${config.variable}) at ${lat.toFixed(1)},${lon.toFixed(1)}:`,
      err instanceof Error ? err.message : err,
      stderr ? `\n--- stderr ---\n${stderr}` : ''
    );
    const reading: CopernicusReading = { value: null, degraded: true };
    cache.set(key, { reading, fetchedAt: Date.now() });
    return reading;
  }
}

export function getSstAt(lat: number, lon: number): Promise<CopernicusReading> {
  return getReading('sst', SST_CONFIG, lat, lon);
}

export function getChlAt(lat: number, lon: number): Promise<CopernicusReading> {
  return getReading('chl', CHL_CONFIG, lat, lon);
}
