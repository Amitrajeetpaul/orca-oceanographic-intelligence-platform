import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

// Copernicus Marine Service: Met Office OSTIA global L4 SST, daily NRT.
// https://data.marine.copernicus.eu/product/SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001
const DATASET_ID = 'METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2';
const VARIABLE = 'analysed_sst';

export interface CopernicusReading {
  value: number | null; // Celsius
  degraded: boolean;
}

interface CacheEntry {
  reading: CopernicusReading;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
// Copernicus NRT SST updates roughly daily; a long TTL avoids hammering a slow
// CLI subprocess on every chat message for the same region.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

function hasCredentials(): boolean {
  return !!process.env.COPERNICUSMARINE_SERVICE_USERNAME && !!process.env.COPERNICUSMARINE_SERVICE_PASSWORD;
}

async function fetchViaCli(lat: number, lon: number): Promise<number | null> {
  const half = 0.1;
  const tmpDir = path.join(os.tmpdir(), `orca-cm-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
  await mkdir(tmpDir, { recursive: true });

  // NRT SST typically lags 1-2 days behind "now" — without a date range the
  // CLI happily returns the dataset's *entire* multi-year history (thousands
  // of rows) for this bbox, so bound it to a short trailing window and take
  // the most recent date within it.
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

  try {
    await execFileAsync(
      'copernicusmarine',
      [
        'subset',
        '-i', DATASET_ID,
        '-v', VARIABLE,
        '-x', String(lon - half),
        '-X', String(lon + half),
        '-y', String(lat - half),
        '-Y', String(lat + half),
        '-t', start.toISOString(),
        '-T', now.toISOString(),
        '--file-format', 'csv',
        '-o', tmpDir,
        '-f', 'sst.csv',
        '--overwrite',
        '--disable-progress-bar',
        '--username', process.env.COPERNICUSMARINE_SERVICE_USERNAME!,
        '--password', process.env.COPERNICUSMARINE_SERVICE_PASSWORD!,
      ],
      { timeout: 45000 }
    );

    const csv = await readFile(path.join(tmpDir, 'sst.csv'), 'utf-8');
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return null;

    const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const timeIdx = header.indexOf('time');
    const valueIdx = header.indexOf(VARIABLE);
    if (valueIdx === -1 || timeIdx === -1) return null;

    const rows = lines.slice(1).map((line) => line.split(','));
    const mostRecentDate = rows.reduce((max, r) => (r[timeIdx] > max ? r[timeIdx] : max), rows[0][timeIdx]);
    const latestValues = rows
      .filter((r) => r[timeIdx] === mostRecentDate)
      .map((r) => parseFloat(r[valueIdx]))
      .filter((v) => !Number.isNaN(v));

    if (latestValues.length === 0) return null;
    const avgKelvin = latestValues.reduce((sum, v) => sum + v, 0) / latestValues.length;
    return avgKelvin - 273.15;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getSstAt(lat: number, lon: number): Promise<CopernicusReading> {
  const key = `${lat.toFixed(1)}:${lon.toFixed(1)}`;
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
    const value = await fetchViaCli(lat, lon);
    const reading: CopernicusReading = { value, degraded: value === null };
    cache.set(key, { reading, fetchedAt: Date.now() });
    return reading;
  } catch (err) {
    console.warn('Copernicus Marine fetch failed:', err instanceof Error ? err.message : err);
    const reading: CopernicusReading = { value: null, degraded: true };
    cache.set(key, { reading, fetchedAt: Date.now() });
    return reading;
  }
}
